# 快問快答｜多人連線競賽版

已加入房間 QR Code 與可分享的加入連結。使用 Node.js、Express、Socket.IO；主持人建立房間後，玩家掃描 QR Code 或輸入 5 位房間代碼即可加入。

## 功能
- 最多 100 位玩家加入同一房間（實際承載量取決於主機資源）
- 主持人建立房間、設定每題作答秒數
- 題庫自訂：最多 50 題，每題 2～4 個選項
- 玩家免註冊加入
- 即時同步出題、倒數計時、每題限答一次
- 答對得分，較快答對可獲得少量速度加分
- 顯示作答人數、即時分數與最終排行榜
- 主持人控制公布答案及下一題
- QR Code 直接帶入房間代碼

## 本機測試
1. 安裝 Node.js 18 或更新版本。
2. 解壓縮專案。
3. 在專案資料夾開啟終端機，執行 `npm install`。
4. 執行 `npm start`。
5. 開啟 `http://localhost:3000`。

同一個 Wi-Fi 的其他裝置可用主辦電腦的區域網路 IP 加上 `:3000` 連線；防火牆需允許連線。

## 部署成公開網站（Render 範例）
專案已附 `render.yaml`，設定為 Render Node Web Service，使用 Singapore 區域及 Free 方案設定。

1. 將解壓縮後的整個專案上傳到自己的 GitHub repository。
2. 登入 Render，選擇建立新的 Blueprint，連結剛上傳的 repository。
3. Render 讀取根目錄的 `render.yaml`，確認服務設定後建立部署。
4. 部署完成後，Render 會提供 `https://你的服務名稱.onrender.com` 公開網址。
5. 用該網址開啟網站，主持人建立房間後即可分享 QR Code。

Render 官方文件：
- Node/Express 部署：https://render.com/docs/deploy-node-express-app
- WebSocket 支援：https://render.com/docs/websocket
- Blueprint 設定：https://render.com/docs/blueprint-spec

提醒：部署平台可能要求登入及授權 GitHub。免費服務可能休眠或有資源限制，正式活動前請先用預計人數實測；100 人是此版本的應用程式房間人數上限，不代表免費主機保證可同時承載 100 條連線。

## 重要限制
- 房間與分數目前存於伺服器記憶體，伺服器重啟後房間會消失。
- 主持人離線時房間會關閉。
- 此版本為單一伺服器架構；若要多台伺服器擴充，需加入 Socket.IO adapter 與共享儲存。
- QR Code 使用線上 QRCode.js CDN；玩家仍可用房間代碼手動加入。


## 一鍵部署到 Render（公開網址）
1. 建立 GitHub 帳號，新增一個 Repository，將此專案解壓後的所有檔案上傳。
2. 登入 Render，選擇建立新的 Web Service，連結剛才的 GitHub Repository。
3. Render 會讀取專案內的 `render.yaml`；若需手動設定，Runtime 選 Node，Build Command 填 `npm install`，Start Command 填 `npm start`。
4. 部署完成後，Render 會提供一個 `https://...onrender.com` 公開網址。
5. 用該網址開啟網站，建立房間後會自動產生 QR Code。玩家掃描即可開啟加入頁面，輸入名稱後加入。

注意：免費方案可能在閒置後休眠，第一次開啟可能需要等待服務喚醒。正式活動前請先測試所有手機能否加入，並以預計參加人數進行壓力測試。Render 的方案、費用與限制可能調整，部署前請查看其最新說明。
