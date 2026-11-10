const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const rooms = new Map();
const MAX_PLAYERS = 100;
const DEFAULT_QUESTIONS = [
  { q: "台灣最高的山是哪一座？", options: ["玉山", "雪山", "阿里山", "合歡山"], answer: 0 },
  { q: "一年有幾個月？", options: ["10 個月", "11 個月", "12 個月", "13 個月"], answer: 2 },
  { q: "下列哪一個是哺乳類動物？", options: ["企鵝", "海豚", "鱷魚", "青蛙"], answer: 1 }
];

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result;
  do {
    result = Array.from({length: 5}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  } while (rooms.has(result));
  return result;
}
function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, answered: p.answered
  })).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name, "zh-Hant"));
}
function broadcastPlayers(roomCode) {
  const room = rooms.get(roomCode);
  if (room) io.to(roomCode).emit("players", publicPlayers(room));
}
function cleanName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 16);
}
function cleanQuestions(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) return null;
  const result = [];
  for (const item of input) {
    const q = String(item.q || "").trim().slice(0, 240);
    const options = Array.isArray(item.options) ? item.options.map(x => String(x || "").trim().slice(0, 100)).filter(Boolean) : [];
    const answer = Number(item.answer);
    if (!q || options.length < 2 || options.length > 4 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
    result.push({q, options, answer});
  }
  return result;
}
function roomState(room) {
  return { status: room.status, current: room.current, total: room.questions.length,
    question: room.status === "question" ? {
      q: room.questions[room.current].q,
      options: room.questions[room.current].options,
      number: room.current + 1,
      total: room.questions.length,
      endsAt: room.endsAt
    } : null };
}
function finishQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.status !== "question") return;
  clearTimeout(room.timer);
  room.status = "reveal";
  const q = room.questions[room.current];
  io.to(roomCode).emit("reveal", { correct: q.answer, correctText: q.options[q.answer], players: publicPlayers(room) });
  broadcastPlayers(roomCode);
}
function startQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.current >= room.questions.length) return;
  room.status = "question";
  room.players.forEach(p => p.answered = false);
  room.endsAt = Date.now() + room.seconds * 1000;
  const q = room.questions[room.current];
  io.to(roomCode).emit("question", {
    q: q.q, options: q.options, number: room.current + 1,
    total: room.questions.length, seconds: room.seconds, endsAt: room.endsAt
  });
  broadcastPlayers(roomCode);
  room.timer = setTimeout(() => finishQuestion(roomCode), room.seconds * 1000);
}

io.on("connection", socket => {
  socket.on("createRoom", ({hostName, questions, seconds}, cb) => {
    const valid = cleanQuestions(questions);
    if (!valid) return cb?.({error:"題庫格式不正確，請確認至少有 1 題，每題有 2～4 個選項及正確答案。"});
    const roomCode = code();
    const room = {
      hostId: socket.id, hostName: cleanName(hostName) || "主持人",
      players: new Map(), questions: valid, seconds: Math.max(5, Math.min(60, Number(seconds) || 15)),
      current: 0, status: "lobby", timer: null, endsAt: null
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = "host";
    cb?.({roomCode, players: []});
  });

  socket.on("joinRoom", ({roomCode, name}, cb) => {
    roomCode = String(roomCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    const playerName = cleanName(name);
    if (!room) return cb?.({error:"找不到這個房間，請確認代碼。"});
    if (!playerName) return cb?.({error:"請輸入玩家名稱。"});
    if (room.status !== "lobby") return cb?.({error:"遊戲已經開始，暫時不能加入。"});
    if (room.players.size >= MAX_PLAYERS) return cb?.({error:`房間已達 ${MAX_PLAYERS} 人上限。`});
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase()))
      return cb?.({error:"這個名稱已有人使用，請換一個名稱。"});
    room.players.set(socket.id, {id:socket.id, name:playerName, score:0, answered:false});
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = "player";
    cb?.({roomCode, name:playerName});
    broadcastPlayers(roomCode);
  });

  socket.on("startGame", cb => {
    const roomCode = socket.data.roomCode, room = rooms.get(roomCode);
    if (!room || socket.id !== room.hostId) return cb?.({error:"只有主持人可以開始遊戲。"});
    if (room.players.size < 1) return cb?.({error:"至少需要 1 位玩家加入。"});
    room.current = 0;
    room.players.forEach(p => p.score = 0);
    startQuestion(roomCode);
    cb?.({ok:true});
  });

  socket.on("submitAnswer", ({choice}, cb) => {
    const roomCode = socket.data.roomCode, room = rooms.get(roomCode);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== "question" || !player) return cb?.({error:"目前不是作答時間。"});
    if (player.answered) return cb?.({error:"你已經回答過這題了。"});
    const q = room.questions[room.current];
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return cb?.({error:"答案無效。"});
    player.answered = true;
    const correct = choice === q.answer;
    if (correct) {
      const remaining = Math.max(0, room.endsAt - Date.now());
      player.score += 100 + Math.round(remaining / room.seconds / 10);
    }
    cb?.({
  ok: true,
  correct,
  correctChoice: q.answer,
  correctText: q.options[q.answer]
});
    io.to(roomCode).emit("answerCount", {
      answered: [...room.players.values()].filter(p => p.answered).length,
      total: room.players.size
    });
    broadcastPlayers(roomCode);
    if ([...room.players.values()].every(p => p.answered)) finishQuestion(roomCode);
  });

  socket.on("nextQuestion", cb => {
    const roomCode = socket.data.roomCode, room = rooms.get(roomCode);
    if (!room || socket.id !== room.hostId || room.status !== "reveal") return cb?.({error:"目前無法進入下一題。"});
    room.current++;
    if (room.current >= room.questions.length) {
      room.status = "finished";
      io.to(roomCode).emit("gameOver", {players: publicPlayers(room)});
      return cb?.({ok:true, finished:true});
    }
    startQuestion(roomCode);
    cb?.({ok:true});
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode, room = rooms.get(roomCode);
    if (!room) return;
    if (socket.id === room.hostId) {
      clearTimeout(room.timer);
      io.to(roomCode).emit("roomClosed");
      rooms.delete(roomCode);
    } else {
      room.players.delete(socket.id);
      broadcastPlayers(roomCode);
      if (room.status === "question" && room.players.size && [...room.players.values()].every(p => p.answered)) finishQuestion(roomCode);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Quiz server running on port ${PORT}`));
