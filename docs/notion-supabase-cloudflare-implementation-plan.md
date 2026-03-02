# AI 後端執行計畫書（完整版，從 0 開始）：Notion -> Supabase + Cloudflare R2

這份文件給 AI / 後端工程實作。  
重點：不得假設任何既有基礎已完成，需從盤點到交付完整執行。

人類設定手冊：`docs/notion-supabase-main-read-plan.md`

---

## 0. 目標

1. 保持前端 UI 不變。
2. 建立 Notion -> Supabase 的同步主流程。
3. 圖片（`mainImage`, `moreImages`）轉存到 R2，並將 URL 寫入 Supabase。
4. API 支援讀取來源切換（Supabase 為主，Notion fallback）。
5. 建立自動化同步能力（sync-all + `updated_only` + `publish` + `deactivate`）。

---

## 1. Phase 0：現況盤點（不可跳過）

1. 檢查後端入口與現有 API：
   1. `server/index.ts`
   2. `server/services/notion.ts`
   3. `server/services/generator.ts`
2. 檢查型別與契約：
   1. `src/types.ts`
   2. `shared/contracts.ts`
3. 檢查環境變數模板：`.env.example`
4. 檢查是否已有以下檔案，若無則建立：
   1. `server/services/supabase.ts`
   2. `server/services/imageStoreR2.ts`
   3. `server/services/syncToSupabase.ts`

輸出要求：

1. 記錄目前缺少哪些能力（Supabase 讀寫 / R2 上傳 / 同步 API / 讀取切換）。

---

## 2. Phase 1：資料契約落地

## 2.1 欄位映射

Courses：

1. Notion `Slug` -> `courses.slug`
2. Notion `CourseName` -> `courses.course_name`
3. Notion `CourseSummary` -> `courses.course_summary`
4. Notion `CoverImage` -> `courses.cover_image_url`
5. Notion `PublishedStatus` -> `courses.is_published`
6. Notion `last_edited_time` -> `courses.notion_last_edited_time`

Projects：

1. Notion `ProjectName` -> `projects.project_name`
2. Notion `SourceDatabaseId` -> `projects.source_database_id`
3. Notion `UiPattern` -> `projects.ui_pattern`

Student Works：

1. `assignmentName` -> `student_works.assignment_name`
2. `mainImage` -> `student_works.main_image_url`
3. `moreImages` -> `student_works.metadata.moreImages`

## 2.2 必備 Supabase 欄位（依賴）

`courses` 必須可寫：

1. `is_active`
2. `is_published`
3. `notion_last_edited_time`

---

## 3. Phase 2：建立基礎服務（若不存在就新增）

## 3.1 `server/services/supabase.ts`

必備能力：

1. REST API 連線（`SUPABASE_URL` + `SUPABASE_SECRET_KEY`）
2. upsert：
   1. course
   2. projects
   3. student_works
3. read：
   1. `fetchCoursesFromSupabase`
   2. `fetchCoursePayloadBySlugFromSupabase`
4. sync log：`appendSyncLog`
5. Phase E 支援：
   1. `setCoursesInactiveByNotionIds(...)`
   2. checkpoint 讀寫（可先用 `sync_logs` payload 或 `sync_state`）

## 3.2 `server/services/imageStoreR2.ts`

必備能力：

1. 判斷是否啟用 `IMAGE_BACKEND=r2 && IMAGE_SYNC_ENABLED=true`
2. 下載原始圖片 URL
3. 以上傳到 R2（S3 相容簽名）
4. 回傳公開 URL（`R2_PUBLIC_BASE_URL/key`）
5. 失敗拋錯（由上層做警告與降級）

## 3.3 `server/services/syncToSupabase.ts`

必備能力：

1. `syncCourseToSupabase({slug|coursePageId})`
   1. 讀 Notion payload
   2. 上傳 `mainImage`
   3. 上傳 `moreImages[]`
   4. upsert Supabase
   5. append sync log
2. 失敗處理：單張圖片失敗不應中斷整課程同步

---

## 4. Phase 3：接 API 路由與來源切換

## 4.1 `server/index.ts` 新增路由

1. `POST/GET /api/admin/sync-course-supabase`
   1. 支援 `slug` 或 `coursePageId`
   2. 需 `x-sync-secret`

## 4.2 讀取來源切換

1. `/api/course/:slug`
2. `/api/courses`

規則：

1. `READ_FROM_SUPABASE=true` -> 優先讀 Supabase
2. 失敗 fallback Notion，並在 warnings 記錄

---

## 5. Phase 4：sync-all（自動化核心）

## 5.1 Notion metadata 讀取

在 `server/services/notion.ts` 新增：

1. `fetchAllCoursesWithMeta()`
   1. slug
   2. pageId
   3. `PublishedStatus`
   4. `last_edited_time`

## 5.2 sync-all service

在 `server/services/syncToSupabase.ts` 新增：

1. `syncAllCoursesToSupabase({ updated_only, publish, deactivate, dry_run })`

流程：

1. 讀取 Notion 全課程 meta
2. `publish=true` -> 篩 `PublishedStatus=true`
3. `updated_only=true` -> 與 checkpoint 比較，只取有更新課程
4. 逐課程呼叫 `syncCourseToSupabase`
5. `deactivate=true` -> 不在有效集合的 Supabase 課程標 `is_active=false`
6. 回傳 summary

## 5.3 新增 API

在 `server/index.ts` 新增：

1. `POST/GET /api/admin/sync-all-courses-supabase`

---

## 6. Phase 5：環境變數與文件同步

## 6.1 `.env.example` 最低需求

1. Notion：`NOTION_TOKEN`, `NOTION_DB_COURSES_ID`, `NOTION_DB_PROJECTS_ID`
2. Supabase：`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `READ_FROM_SUPABASE`
3. R2：`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `IMAGE_BACKEND`, `IMAGE_SYNC_ENABLED`
4. Admin：`COURSE_LINK_SYNC_SECRET`

## 6.2 sync-all 可選參數（建議）

1. `SYNC_UPDATED_ONLY`
2. `SYNC_PUBLISH_ONLY`
3. `SYNC_DEACTIVATE`

---

## 7. 測試與驗收

## 7.1 必跑檢查

1. `npm run lint`

## 7.2 API 驗證

1. 單課程同步：`/api/admin/sync-course-supabase`
2. 全課程同步：`/api/admin/sync-all-courses-supabase`

## 7.3 DoD

1. 新課程加入 Notion 後，可被 sync-all 自動同步。
2. `publish=true` 時，只同步 `PublishedStatus=true`。
3. `updated_only=true` 時，只同步有變更課程。
4. `deactivate=true` 時，課程會標記 `is_active=false`（不硬刪）。
5. 前台在 `READ_FROM_SUPABASE=true` 正常顯示。
6. `mainImage` + `moreImages` 皆為 R2 URL。

---

## 8. 回滾策略

1. 緊急回滾資料來源：`READ_FROM_SUPABASE=false`
2. 保留 Notion 讀取流程，不直接刪除舊路徑
3. sync 失敗時只記錄 log，不覆蓋已存在可用資料

---

## 9. AI 實作順序（必照）

1. Phase 0 現況盤點與缺口清單
2. Phase 1 契約對齊
3. Phase 2 基礎服務補齊
4. Phase 3 路由與讀取切換
5. Phase 4 sync-all + 三策略
6. Phase 5 env 與文件同步
7. Phase 7 測試驗收
8. 提供 curl 測試指令與變更檔案列表
