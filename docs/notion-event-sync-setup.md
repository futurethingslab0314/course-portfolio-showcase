# Notion 變更通知同步

一般「同步變更」只處理已收到的 Notion 通知。未變更的作品不向 Notion 逐筆讀取；不重下載未變更的圖片。同一作品的多個通知會合併，並讀取最新狀態，以支援修改、刪除、還原與移動。關聯案例使用先前保存的來源頁面重建，只寫入實際改變的作品。文字或文章段落改動不會重新下載同一來源圖片。

## 啟用順序

1. 在 Supabase SQL Editor 執行 `sql/2026-10-23-notion-event-sync.sql`。三張資料表啟用 RLS，僅服務端 service role 可以讀寫；兩個 RPC 同樣限制為 service role。既有課程與作品資料表不變。
2. 部署程式，保留現有 Notion、Supabase、R2 與 Admin 環境變數。新增一個隨機的 `NOTION_WEBHOOK_SETUP_SECRET`（例如用 `openssl rand -hex 32` 產生），並建議設定 `NOTION_WEBHOOK_INTEGRATION_ID` 為目前 Notion integration ID。不要將金鑰放入前端環境變數或版本控制。
3. 在目前用於讀取課程資料的 Notion integration/connection 中開啟 Webhooks，建立訂閱：`https://<網站網域>/api/notion/events?setup=<上述隨機字串>`。連線必須有課程、分頁與所有來源及關聯資料庫的讀取權限。
4. 訂閱 API 版本使用 **2022-06-28**，與目前伺服器的 `NOTION_API_VERSION` 保持一致。現有資料讀取使用舊版 database API，不要只修改版本設定。訂閱：`page.created`、`page.properties_updated`、`page.content_updated`、`page.deleted`、`page.undeleted`、`page.moved`；以及 `database.schema_updated`、`database.deleted`、`database.undeleted`、`database.moved`。接收器亦辨識新版本對應的 data_source 結構事件，但完整 API 升級不在此次範圍內。
5. 登入網站 Admin，展開右下角「Notion 變更通知設定」。將接收到的驗證碼貼回 Notion 的 Verify subscription。接收器不公開或記錄驗證碼，重送握手也不能覆寫既有驗證碼。初次設定若收到了錯誤 token，請在 SQL Editor 移除 `notion_sync_settings` 中 `verification_token` 這一列後重新握手。輪替後清除 `last_received_at` 並重做測試。
6. 在 Notion 修改一筆測試作品，等通知送達，再點「重新檢查通知設定」。必須看到最近收到通知的時間。
7. 每個需要使用變更同步的分頁執行一次「完整比對」，建立完整來源快照。之後日常使用「同步變更」。完整比對保留首次初始化、通知中斷補查、欄位對應及資料庫結構調整用途。整門課程的舊同步 API 仍存在，但不建立分頁的事件同步快照。

## 使用與驗收

- 改一個字：只讀取該頁，更新該作品；同圖沿用原 R2 及縮圖。
- 修改文章內文：重新讀該篇內文；其他文章使用保存內容，不重新讀取。
- 新增、換圖、刪圖：只處理變更作品中的新圖片。
- 刪除最後一件作品：只刪該 ID，不進行部分資料的整頁清理。
- 還原或移動作品：以最新頁面狀態重建，不依過時通知直接刪除。
- 案例、學生及身體部位關聯資料變動：快照中已知的相關頁面同樣會追蹤；新關聯會在受影響的來源頁更新時讀取。
- 沒收到變更：顯示「目前沒有收到新的變更」，不宣稱所有 Notion 內容已一致。通知通常一分鐘內送達，官方說應在五分鐘內送達。
- 同步期間的新通知：保留至下一次同步。失敗不推進 checkpoint；重試可能重寫已成功的變更，但不會忽略未完成項目。
- 伺服器重啟：通知、來源快照與 checkpoint 均存在 Supabase。尚在執行中的 UI job 不會恢復；重新按同步即可重新處理未完成變更。
- 課程或分頁設定、資料庫結構有變動：一般 Sync 提示執行完整比對，避免套用過期欄位對應。

## 運作限制

通知不是即時的，也不能保證中斷後永遠補送。端點在資料持久化失敗時回傳 503，讓 Notion 重試；收到並存妥才回覆成功。若 Notion 訂閱停用或服務長時間中斷，使用完整比對補查。若剛編輯完立即按同步，可能尚未收到該事件，需稍後再按。

維持目前 **單一同步服務實例** 部署：既有同步鎖是程序內序列化，沒有跨副本鎖。事件表使用唯一 event_id 去重；寫入事件和讀取 watermark 透過 PostgreSQL 交易鎖同步，避免跳過尚未提交的事件。事件表與快照含來源內容，應按既有資料保護政策備份；目前不自動清除事件，以免清掉尚未被其他分頁消化的通知。

撤回 Notion 權限造成的 404 不會被當作一般更新的刪除；明確刪除通知遇到 404 才依刪除處理。接收器驗證原始 request body 的 HMAC-SHA256 簽章，不能放在全域 express.json() 後面。

## 官方參考

- [建立訂閱與驗證簽章](https://developers.notion.com/reference/webhooks)
- [事件種類、通知延遲、重試與順序](https://developers.notion.com/reference/webhooks-events-delivery)
