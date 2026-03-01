# 執行計畫書：改造現有網站支援 Notion + Supabase + Cloudflare R2

## 0. 這份文件用途

這份文件是「工程執行計畫書」，專注在：

1. 你的現有網站程式碼要改哪些檔案。
2. 每個步驟在哪個平台做（Notion / Supabase / Cloudflare / Railway / Backend）。
3. 如何分階段上線，避免一次改太多導致中斷。

搭配閱讀：

1. 設定手冊：`docs/notion-supabase-main-read-plan.md`
2. 本文件：負責「實際改站」順序與驗收。

## 1. 改造目標（Definition of Done）

完成後應達成：

1. Notion 仍是內容編輯來源。
2. 網站 API 主要讀 Supabase，不再即時依賴 Notion 查詢。
3. 圖片來源為 Cloudflare R2 URL（`r2.dev` 或 custom domain）。
4. 發生單筆圖片同步失敗時，不會讓整個課程 API 崩潰。
5. 可透過環境變數快速切換資料來源（Supabase / Notion fallback）。

## 2. 平台分工

1. Notion：內容編輯、欄位維護、DB 權限分享。
2. Supabase：結構化資料儲存、向量資料儲存（可後補）。
3. Cloudflare R2：圖片物件儲存與公開 URL。
4. Railway：環境變數管理、部署、觸發同步工作。
5. Backend 程式碼（本專案）：同步流程與 API 讀取邏輯。

## 3. 變更範圍（程式碼）

以下是本次建議會改動的區域：

1. `server/services/notion.ts`  
   保留 Notion 讀取邏輯，作為同步來源與 fallback。
2. `server/services/generator.ts`  
   擴充為可讀 Supabase（或新增 supabase generator service）。
3. `server/index.ts`  
   加入 sync 觸發端點、讀取來源切換邏輯（feature flag）。
4. `server/services/` 新增：
   1. `supabase.ts`（Supabase 寫入/讀取）
   2. `imageStoreR2.ts`（R2 上傳與 URL 生成）
   3. `syncToSupabase.ts`（Notion -> normalize -> R2 -> Supabase 主流程）
5. `src/data/courseData.ts`  
   前端維持不變，仍只打 `/api/course/:slug`；由後端決定來源。
6. `shared/contracts.ts`（必要時）  
   補上同步狀態或圖片來源欄位定義。

## 4. 分階段執行（推薦）

## Phase A：環境就緒（平台設定，不改 UI）

平台：

1. Notion
2. Supabase
3. Cloudflare R2
4. Railway

工作：

1. Notion integration 與 DB 分享完成。
2. Supabase SQL 建表完成。
3. R2 bucket + Access Keys + Public Development URL 完成。
4. Railway env vars 全部填入。

驗收：

1. 能從後端讀到 Notion 課程資料。
2. 能用後端把測試檔上傳到 R2 並開啟公開 URL。
3. 能在 Supabase 手動寫入/查詢一筆測試資料。

## Phase B：建立同步管線（核心）

平台：

1. Backend 程式碼
2. Railway（觸發）

工作：

1. 新增 `syncToSupabase` 流程：
   1. 讀 Notion（course -> projects -> source db records）
   2. 套既有 normalize/mapping
   3. 圖片下載並上傳 R2
   4. URL 回寫到 payload
   5. upsert 到 Supabase
2. 新增一個手動觸發 API（例如 `POST /api/admin/sync-course`）。
3. 寫 `sync_logs`（成功/失敗/警告）。

驗收：

1. 觸發一次 sync 後，Supabase 三張主表有資料。
2. `student_works.main_image_url` 為 R2 網域（不是 Notion 臨時網址）。
3. 單筆圖片失敗不影響其他作品同步。

## Phase C：網站讀取切換（低風險）

平台：

1. Backend 程式碼
2. Railway

工作：

1. 實作 `loadCoursePayloadBySlug` 對應的後端來源切換：
   1. `READ_FROM_SUPABASE=true`：讀 Supabase
   2. `READ_FROM_SUPABASE=false`：沿用 Notion 舊流程
2. 保留 fallback（讀 Supabase 失敗可退回 Notion 或現有 fallback）。

驗收：

1. 同一個 slug，Supabase 與 Notion payload 結構一致。
2. 前端不改 UI 即可正常顯示。

## Phase D：增量同步與營運化

平台：

1. Backend 程式碼
2. Railway
3. Notion（可選按鈕觸發）

工作：

1. 提供 `sync one project` / `sync one source db` API。
2. 排程補同步（例如每 15-60 分鐘）。
3. 可選：Notion button 或 webhook 觸發同步端點。

驗收：

1. 新增/修改作品可在可接受時間內出現在網站。
2. sync log 可追蹤每次更新與失敗原因。

## 5. Railway 變數清單（最終版）

必要：

1. `NOTION_TOKEN`
2. `NOTION_DB_COURSES_ID`
3. `NOTION_DB_PROJECTS_ID`
4. `NOTION_API_VERSION=2022-06-28`
5. `SUPABASE_URL`
6. `SUPABASE_SECRET_KEY`
7. `R2_ACCOUNT_ID`
8. `R2_ACCESS_KEY_ID`
9. `R2_SECRET_ACCESS_KEY`
10. `R2_BUCKET`
11. `R2_PUBLIC_BASE_URL`
12. `IMAGE_BACKEND=r2`
13. `IMAGE_SYNC_ENABLED=true`
14. `READ_FROM_SUPABASE=false`（先比對，確認後改 true）

可選：

1. `OPENAI_API_KEY`
2. `EMBEDDING_MODEL=text-embedding-3-small`

## 6. Notion Button 是否必要

結論：不是必要。

建議順序：

1. 先完成手動 API 同步（最快驗證流程）。
2. 確認穩定後再加 Notion button/webhook 觸發。

## 7. 風險與避免方式

1. 圖片 URL 過期：  
   避免方式：同步時即下載 Notion 圖片，不在前端直接用 Notion URL。
2. 同步失敗造成資料不完整：  
   避免方式：寫 `sync_logs`、支援重試、單筆失敗不拖垮全量。
3. 一次切換全部讀取來源風險高：  
   避免方式：用 `READ_FROM_SUPABASE` 分階段切換。

## 8. 實作順序建議（你現在就能照做）

1. 先完成 Phase A（平台設定）。
2. 我們一起做 Phase B（實作 sync）。
3. 再做 Phase C（切讀取來源）。
4. 最後做 Phase D（自動化觸發）。

## 9. 本次決策：新檔案 vs 修改原檔

建議採用：

1. `docs/notion-supabase-main-read-plan.md`：保留為「設定手冊」。
2. `docs/notion-supabase-cloudflare-implementation-plan.md`：作為「工程執行計畫書」。

這樣最清楚，因為一份教你設定平台，一份教你改網站程式，角色不混在一起。
