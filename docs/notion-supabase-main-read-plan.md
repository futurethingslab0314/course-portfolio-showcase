# Notion 編輯 + Supabase 主讀取：完整方案與實作步驟

搭配文件：

1. 本文件：跨平台設定與觀念說明。
2. 工程執行計畫：`docs/notion-supabase-cloudflare-implementation-plan.md`（改網站程式時請看這份）。

## 1. 目標與原則

本方案的核心是：

1. `Notion` 保持為內容編輯來源（老師/同學持續在 Notion 改資料、上傳圖片、調整欄位）。
2. `Supabase` 成為網站主要讀取資料庫（網站不直接依賴 Notion 即時查詢）。
3. 透過同步流程，把 Notion 內容轉成穩定結構後寫入 Supabase。

這樣可以同時保留 Notion 的編輯體驗，並得到更穩定、可擴充（語意搜尋）的網站資料層。

## 2. 為什麼這樣做

### 現況（直接讀 Notion）

1. 優點：改了 Notion 幾乎立刻可被讀到。
2. 風險：受 Notion API 限流、權限、API 暫時故障影響。
3. 風險：資料查詢性能與複雜查詢能力不如資料庫。

### 目標架構（Notion -> Supabase）

1. 優點：網站查詢更穩定、速度更好。
2. 優點：可以做向量搜尋（pgvector）與 SQL 條件查詢混合。
3. 成本：多一條同步管線要維護。
4. 代價：資料是「最終一致」，不是每次編輯 0 秒同步。

## 3. 架構圖（邏輯）

```text
編輯者 -> Notion (Courses / Projects / Source DB)
            |
            | 同步（手動按鈕、Webhook、或排程）
            v
      Backend Sync Worker
            |
            | normalize + field mapping + upsert
            v
      Supabase Postgres (+ pgvector)
            |
            | 網站 API 主要讀取
            v
          Frontend
```

## 4. 你需要先準備的帳號與金鑰

1. Notion integration token（`NOTION_TOKEN`）。
2. Notion 三類 DB（Courses、Projects、各 Source Database）並授權給 integration。
3. Supabase 專案（拿到 `Project URL`、`secret key (sb_secret...)`、`DB password`）。
4. （做語意搜尋時）OpenAI API key（產生 embeddings）。

## 4.1 平台分工總覽（先看這段再開始）

| 平台 | 你在這裡做什麼 | 對應章節 |
|---|---|---|
| Notion | 建 integration、分享 DB 權限、維護內容欄位 | 5, 10 |
| Supabase | 建專案、建表、確認資料可寫入 | 6 |
| Cloudflare R2 | 建 bucket、開公開網址、建立 Access Keys | 14.3, 14.4 |
| Railway（部署） | 設定環境變數、重啟部署、切 feature flag | 7, 9, 14.3 |
| Backend 程式碼（本專案） | 實作 sync、mapping、upsert、失敗重試 | 8, 10, 14.6, 14.8 |

## 4.2 依平台執行順序（給不熟多平台設定的人）

1. 先做 Notion：完成第 5 章（integration + 分享權限）。
2. 再做 Supabase：完成第 6 章（建表 SQL）。
3. 再做 Cloudflare：完成第 14.3、14.4（R2 金鑰與公開網址）。
4. 再做 Railway：填第 7 章與第 14.3 的 env variables。
5. 最後做 Backend：依第 8、10、14.6 實作同步並驗證。

## 5. Notion 端設定（一步一步）

平台：`Notion`

## 5.1 建立 Integration

1. 進入 [Notion Integrations](https://www.notion.so/profile/integrations)。
2. 點 `New integration`。
3. 設定名稱，例如 `course-portfolio-sync`。
4. 建立後複製 Internal Integration Token（通常是 `ntn_...`）。
5. 這就是你的 `NOTION_TOKEN`。

## 5.2 把 Integration 分享到資料庫

每個要讀取的資料庫都要分享，不只 Courses/Projects。

1. 打開 `Courses` DB 頁面。
2. 點右上 `Share`。
3. 邀請剛建立的 integration。
4. 對 `Projects` DB 重複一次。
5. 對每一個 `Source Database` 都重複一次。

若漏掉其中任一個，後端會出現 `403` 或 `404` 類型錯誤。

## 5.3 Notion 欄位規格（建議）

請延續你目前專案的欄位策略：

1. Courses：`Slug`, `CourseName`, `CourseSummary`, `CoverImage`, `Projects(relation)`。
2. Projects：`ProjectName`, `ProjectDescription`, `TabName`, `Order`, `SourceDatabaseId`, `UiPattern`, `FieldMapping`, `Course(relation)`。
3. Source DB：依你目前 mapping 規格維持，不強迫每個 DB 欄位同名，但必須可被 `FieldMapping` 對到。

## 5.4 圖片欄位注意事項

Notion 檔案型圖片連結可能是短期簽名 URL，會過期。

可選策略：

1. 短期先沿用 Notion URL（最快上線，但可能遇到過期）。
2. 正式建議：同步時把圖片轉存到 Supabase Storage，再把公開 URL 存入資料表。

## 6. Supabase 端設定（一步一步）

平台：`Supabase`

## 6.1 建立專案

1. 登入 [Supabase](https://supabase.com/)。
2. `New project`。
3. 選組織、區域（盡量靠近主要使用者）。
4. 設定 DB 密碼並記錄。
5. 建立完成後，到 `Settings -> API` 複製：
   1. `Project URL`。
   2. `secret key (sb_secret...)`（僅可放在後端，建議優先使用）。
   3. `service_role`（legacy）可保留做相容用途，但新實作建議以 `sb_secret` 為主。

## 6.2 建立資料表與 extension

在 Supabase SQL Editor 執行以下 SQL。

```sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  slug text unique not null,
  course_name text not null,
  course_summary text,
  cover_image_url text,
  notion_last_edited_time timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courses_slug on public.courses(slug);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  project_name text not null,
  project_description text,
  tab_name text,
  "order" int not null default 0,
  source_database_id text,
  ui_pattern text not null default 'generic-card',
  field_mapping jsonb not null default '{}'::jsonb,
  notion_last_edited_time timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_course_order on public.projects(course_id, "order");
create index if not exists idx_projects_source_db on public.projects(source_database_id);

create table if not exists public.student_works (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text unique not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_database_id text,
  assignment_name text not null default 'Untitled Assignment',
  members text[] not null default '{}',
  description text,
  main_image_url text,
  blog_content jsonb,
  metadata jsonb not null default '{}'::jsonb,
  notion_last_edited_time timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_works_project on public.student_works(project_id);
create index if not exists idx_works_source_db on public.student_works(source_database_id);

create table if not exists public.work_embeddings (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.student_works(id) on delete cascade,
  chunk_index int not null default 0,
  chunk_text text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique(work_id, chunk_index)
);

create index if not exists idx_work_embeddings_work_id on public.work_embeddings(work_id);
create index if not exists idx_work_embeddings_vector
  on public.work_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  entity_type text not null,
  entity_notion_id text,
  status text not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_run_id on public.sync_logs(run_id);
```

## 6.3 權限策略（先簡化，再進階）

你目前架構是網站經由後端 API 讀資料，建議：

1. 後端用 `secret key (sb_secret...)` 存取 Supabase。
2. `sb_secret` 只放伺服器環境變數，不能出現在前端。
3. `service_role` 視為 legacy key，除非你有既有相容需求，不建議新流程優先採用。
4. 前端不要直接連 Supabase（先由 API 統一讀取）。

這樣可先避免你一開始就要管理複雜 RLS policy。

## 7. 後端環境變數設定

平台：`Railway（或你的部署平台）`

在你 server 環境增加以下變數：

```env
# Notion
NOTION_TOKEN=ntn_xxx
NOTION_DB_COURSES_ID=xxx
NOTION_DB_PROJECTS_ID=xxx
NOTION_API_VERSION=2022-06-28

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxx

# Embedding (可選)
OPENAI_API_KEY=sk-xxxx
EMBEDDING_MODEL=text-embedding-3-small

# Feature flag
READ_FROM_SUPABASE=true
```

## 8. 同步流程設計（建議分三段）

平台：`Backend 程式碼 + Railway 觸發`

本章節主要是「後端程式實作」，不是在 Notion 或 Supabase 後台點幾個按鈕就完成。

每一段都標示你要在哪裡做：

1. Notion：確認資料與權限。
2. Supabase：確認資料表可寫入。
3. Backend（你的專案程式）：真正執行同步邏輯。
4. 部署平台（Railway/Vercel 等）：設定環境變數與排程。

## 8.1 Full Sync（第一次）

在哪裡做：

1. Notion：確認 Courses/Projects/Source DB 都已分享給 integration。
2. Supabase：確認第 6.2 的資料表已建立。
3. Backend：寫一支 `full sync` 程式或 API。
4. Backend：依序執行「讀 Notion -> normalize -> upsert Supabase」。
5. Backend：寫 `sync_logs`。
6. 部署平台：觸發一次 full sync（手動呼叫 API 或跑 script）。

## 8.2 Incremental Sync（平常）

在哪裡做：

1. Notion：可用按鈕/Webhook 事件觸發（若你已有 webhook 流程）。
2. Backend：建立 `sync one project` / `sync one course` API。
3. Backend：只同步受影響資料，避免每次全量重跑。
4. Supabase：以 `notion_page_id` 做 upsert key（資料表與 SQL 邏輯）。
5. 部署平台：設定排程（可選）做定時補同步。

## 8.3 Embedding Sync（語意）

在哪裡做：

1. Backend：挑要向量化文本（`description` + `blog_content`）。
2. Backend：呼叫 embedding API 並在內容更新時重算。
3. Supabase：更新 `work_embeddings`。
4. 部署平台：可把 embedding 重算獨立成背景工作，避免拖慢主同步。

## 9. 網站切換步驟（低風險）

平台：`Backend 程式碼 + Railway`

本章節也主要在 Backend 與部署平台進行，不是在 Notion/Supabase UI 完成。

在哪裡做：

1. Backend：保留舊 Notion 讀取程式，不先刪除。
2. Backend：新增 Supabase 讀取程式（同樣回傳 `CoursePayload`）。
3. 部署平台：以 `READ_FROM_SUPABASE` 環境變數切換來源。
4. Backend + 測試環境：比對同 slug 的 payload 一致性。
5. 部署平台：先在 staging 或小流量切換。
6. 觀察後再全量切換到 Supabase。

## 10. Notion 與 Supabase 欄位對應

平台：`Notion + Backend 程式碼 + Supabase`

本章節是「規格 + 後端 mapping 程式」工作。

你需要做的不是在 UI 逐欄手動綁定，而是：

1. Notion：欄位名稱符合規格（或至少可被你目前 alias/mapping 規則辨識）。
2. Backend：在 normalize/mapping 程式中維護對應邏輯。
3. Supabase：欄位型別與命名和 mapping 輸出一致。

## 10.1 Courses

1. `Slug` -> `courses.slug`
2. `CourseName|Name|Title` -> `courses.course_name`
3. `CourseSummary|Summary|Description` -> `courses.course_summary`
4. `CoverImage|Cover` -> `courses.cover_image_url`
5. `Notion page id` -> `courses.notion_page_id`

## 10.2 Projects

1. `ProjectName|Name|Title` -> `projects.project_name`
2. `ProjectDescription|Description` -> `projects.project_description`
3. `TabName|Tab` -> `projects.tab_name`
4. `Order` -> `projects.order`
5. `SourceDatabaseId|SourceDB` -> `projects.source_database_id`
6. `UiPattern|DisplayStyle|Pattern` -> `projects.ui_pattern`
7. `FieldMapping` -> `projects.field_mapping`
8. `Course relation` -> `projects.course_id`

## 10.3 Student Works

1. `normalized assignmentName` -> `student_works.assignment_name`
2. `normalized members[]` -> `student_works.members`
3. `normalized description` -> `student_works.description`
4. `normalized mainImage` -> `student_works.main_image_url`
5. `normalized blogContent[]` -> `student_works.blog_content`
6. 其餘擴展欄位 -> `student_works.metadata`

## 10.4 快速檢查清單（你現在就可做）

1. Notion：Courses/Projects/Source DB 是否都已分享 integration。
2. Supabase：第 6.2 SQL 是否已成功執行完成。
3. Backend：是否已有一個可手動觸發的 sync 入口。
4. Backend：sync 後是否可在 `courses/projects/student_works` 查到資料。
5. 部署平台：`READ_FROM_SUPABASE` 是否已可切換。

## 10.5 平台別待辦清單（可逐項打勾）

### Notion

1. 建好 integration 並拿到 `NOTION_TOKEN`。
2. `Courses`、`Projects`、所有 `Source Database` 都已分享給 integration。
3. 欄位命名可被現有 mapping 規則辨識（Slug、SourceDatabaseId、UiPattern 等）。

### Supabase

1. 已建立 project，拿到 `SUPABASE_URL` 與 `SUPABASE_SECRET_KEY`。
2. 第 6.2 SQL 全部執行成功。
3. 可在 Table Editor 看見 `courses/projects/student_works/work_embeddings/sync_logs`。

### Cloudflare R2

1. 已建立 bucket（`R2_BUCKET`）。
2. 已建立 R2 Access Key（不是一般 Account API token）。
3. 已啟用 `Public Development URL`（或完成 Custom Domain）。
4. 已取得 `R2_PUBLIC_BASE_URL`（`https://...r2.dev` 或自訂網域）。

### Railway（部署平台）

1. 已設定 Notion/Supabase/R2 相關 env variables。
2. 已設定 `IMAGE_BACKEND=r2`、`IMAGE_SYNC_ENABLED=true`。
3. 已重新部署使新 env 生效。

### Backend 程式碼

1. 已有 full sync / incremental sync 可手動觸發。
2. 已實作 Notion 圖片下載 -> R2 上傳 -> Supabase URL 回寫。
3. 已有失敗重試與 `sync_logs` 記錄。

## 11. 常見錯誤與排查

1. `401 Unauthorized`：Notion token 錯誤。
2. `403 Forbidden`：Notion DB 沒分享給 integration。
3. `404`：DB ID 錯、或 integration 沒權限導致偽 404。
4. `429`：Notion rate limit，需重試與節流。
5. Supabase 寫入失敗：多半是 key 用成 anon key、或 schema 欄位型別不一致。

## 12. 建議的實施時程

1. Day 1：建 Supabase 專案 + 建表 + 設定 env。
2. Day 2：完成 Full Sync API。
3. Day 3：完成 Supabase 讀取 API 並與 Notion 結果比對。
4. Day 4：加上 embedding + 相似查詢 API。
5. Day 5：切換正式站主要讀 Supabase。

## 13. 最小可行版本（MVP）

若要最快上線，先做這 4 件事：

1. 先不做向量搜尋，只做 `courses/projects/student_works` 三表。
2. 先不搬圖片到 Storage，先沿用現有 URL。
3. 先做手動同步按鈕，不做 webhook。
4. 先由後端讀 Supabase，不讓前端直連。

這樣你可以先把網站穩定切到 Supabase，再逐步加語意搜尋與自動同步。

## 14. 圖片改用 Cloudflare R2：製作計畫書（Notion 上傳 -> R2 -> Supabase 存連結）

平台：`Cloudflare R2 + Railway + Backend 程式碼 + Supabase`

本章節是「只把圖片改放 Cloudflare，文字與結構化資料仍在 Supabase」的落地計畫。

## 14.1 方案定位

1. Notion 仍是編輯入口，使用者照常在 Notion 上傳圖片。
2. 同步程序讀到 Notion 圖片後，下載並上傳到 Cloudflare R2。
3. 圖片最終 URL（R2 或自訂網域）寫回 Supabase `student_works.main_image_url`（或 `metadata.images`）。
4. 前端仍只讀 Supabase，不直接讀 Notion 圖片 URL。

## 14.2 為什麼要這樣做

1. Notion 檔案 URL 是臨時簽名連結，會過期，不適合長期對外展示。
2. R2 針對圖片流量通常較有成本優勢，且可搭配 Cloudflare CDN。
3. 保持「資料單一讀取來源」：前端維持讀 Supabase，不增加前端複雜度。

## 14.3 需要新增的設定

在後端環境變數新增：

```env
# Cloudflare R2
R2_ACCOUNT_ID=xxxx
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
R2_BUCKET=course-portfolio-media
R2_PUBLIC_BASE_URL=https://media.your-domain.com

# 圖片同步策略
IMAGE_BACKEND=r2
IMAGE_SYNC_ENABLED=true
```

說明：

1. `R2_ACCOUNT_ID`：Cloudflare 帳號 ID（Dashboard 右側常可看到）。
2. `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`：R2 API Token 建立後會拿到的一組金鑰。
3. `R2_BUCKET`：你建立的 R2 bucket 名稱，程式會用它上傳圖片。
4. `R2_PUBLIC_BASE_URL`：給前端使用的公開網域，建議用自訂網域（例如 `https://media.your-domain.com`）。
5. `IMAGE_BACKEND`：保留切換圖片後端儲存的彈性（例如未來切回 Supabase Storage）。
6. `IMAGE_SYNC_ENABLED`：可快速關閉圖片上傳流程，用於排錯。

## 14.3.1 檔名與路徑命名規範（建議先定好）

請在實作前先固定命名，避免日後難以清理：

1. bucket：`course-portfolio-media`
2. key pattern：`courses/{course_slug}/projects/{project_notion_id}/{work_notion_id}-{hash}.{ext}`
3. 檔名 hash：建議 `sha256` 前 12-16 碼
4. metadata：至少記 `source=notion`, `notion_page_id`, `synced_at`

## 14.4 Cloudflare 端設定步驟

以下是「不熟 Cloudflare」也可照著做的步驟。

## 14.4.0 先釐清：你要建立哪一種 Token

Cloudflare 常見會看到兩種，名稱很像，但用途不同：

1. `Manage account -> Account API tokens`  
   用途：管理 Cloudflare 帳號資源（DNS、Zone、Workers 等）。  
   不是這個流程的首選，不建議用來當 R2 S3 上傳憑證。
2. `R2 API tokens / Access Keys`  
   用途：給 S3 相容 API 上傳下載物件（你現在要用的）。

本文件後續提到的 `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`，都指第 2 種。

## 14.4.1 建立 R2 Bucket

1. 進入 Cloudflare Dashboard。
2. 左側選 `R2`。
3. 點 `Create bucket`。
4. 名稱填：`course-portfolio-media`（或你想要的固定名稱）。
5. Region 若可選，選離主要使用者較近的區域。
6. 建立後記下 bucket 名稱，對應到 `R2_BUCKET`。

## 14.4.2 建立可程式上傳的 API 金鑰（R2 Access Keys）

1. 優先從 `R2` 頁面進入 `Manage R2 API Tokens`（有些介面會寫成 `Access Keys`）。
2. 點 `Create API token` 或 `Create access key`。
3. 權限選最小化：
   1. Bucket 範圍：只給 `course-portfolio-media`
   2. 權限：`Object Read` + `Object Write`
4. 建立後複製：
   1. Access Key ID -> `R2_ACCESS_KEY_ID`
   2. Secret Access Key -> `R2_SECRET_ACCESS_KEY`
5. 注意：Secret 只顯示一次，立即存到密碼管理器。
6. 若你只看得到 `Manage account -> Account API tokens` 這頁，請返回 `R2` 產品頁再找 R2 專用 token 入口；不要直接用 Account API token 取代。

建立後常會看到 3 個值，差別如下：

1. `Token value`  
   用於 Cloudflare 管理 API（帳號與設定管理）。  
   不是本流程（S3 client 上傳圖片）的主要憑證，可先不使用。
2. `Access Key ID`  
   S3 client 連線帳號，對應到 `R2_ACCESS_KEY_ID`。
3. `Secret Access Key`  
   S3 client 連線密碼，對應到 `R2_SECRET_ACCESS_KEY`。

本專案「Notion 圖片 -> R2 -> Supabase」流程實際需要的是：

1. `S3 API endpoint`（bucket settings 裡可看到）
2. `Access Key ID`
3. `Secret Access Key`

也就是說，`Token value` 可保存備用，但不是目前圖片同步流程必要值。

## 14.4.3 取得 Account ID

1. Dashboard 右側或 `Workers & Pages -> Overview` 可找到 `Account ID`。
2. 複製到 `R2_ACCOUNT_ID`。

## 14.4.4 設定公開讀取方式（先用 Public Development URL，再升級 Custom Domain）

如果你剛開始設定、尚未準備自有網域，建議先走 `Public Development URL`：

1. 進入 bucket 的 `Settings`。
2. 左側點 `Public Development URL`。
3. 右側按 `Enable`（你的畫面會看到這個按鈕）。
4. 啟用後會出現 `https://...r2.dev`。
5. 把此網址填到 `R2_PUBLIC_BASE_URL`。

這是最快可用做法，適合先把同步流程跑通。

正式環境建議再升級成 `Custom Domains`：

1. 同一頁的 `Custom Domains` 區塊按 `Add` 或 `Connect Domain`。
2. 綁定你可控制的子網域（例如 `media.your-domain.com`）。
3. 完成 DNS 驗證後，把 `R2_PUBLIC_BASE_URL` 從 `r2.dev` 改成自訂網域。

注意：

1. `Public Development URL (r2.dev)` 可先用，但不建議長期作為品牌正式網址。
2. `R2_PUBLIC_BASE_URL` 不要填你的 Railway 網站網址；它必須是「R2 圖片網域」。

## 14.4.5 CORS 設定（只在瀏覽器直傳時需要）

若你的流程是「後端下載 Notion 圖片後再上傳 R2」，通常不需要 CORS。

只有在前端會直接呼叫 R2 時，才設定 CORS，例如：

```json
[
  {
    "AllowedOrigins": ["https://your-frontend-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 14.4.6 Cache 與回源建議

1. 在 Cloudflare 設 Cache Rule，針對 `media.your-domain.com/*`。
2. 建議 `Cache TTL` 至少 7-30 天。
3. 若檔名有 hash（建議有），可加 `immutable` 思路，避免重複回源。
4. 內容更新時不要覆蓋同檔名，改用新 hash 檔名，最簡單穩定。

## 14.4.7 成本與風險控制

1. 先做 hash 去重，避免重複上傳同圖。
2. 設定 lifecycle（例如未引用檔 30 天後清理）。
3. 同步流程記錄每次上傳檔案大小與 key，方便查流量異常。

## 14.4.8 連線驗證清單（設定後立刻測）

1. 用後端程式上傳一張測試圖到 `test/healthcheck.png`。
2. 在 R2 bucket 中看得到該物件。
3. 開啟 `R2_PUBLIC_BASE_URL/test/healthcheck.png` 可讀到圖片。
4. 把此 URL 手動寫入 Supabase 任一測試列，前端能正常顯示。
5. 刪除測試圖後，確認 404 行為正常。

## 14.5 Supabase 端資料欄位建議（不必大改）

沿用現有欄位即可：

1. `student_works.main_image_url`：主圖 URL（改存 R2 URL）。
2. `student_works.metadata`：可存額外圖片陣列與來源資訊，例如：
   1. `metadata.images[]`
   2. `metadata.image_source = \"r2\"`
   3. `metadata.image_key`

如果你要追蹤每張圖的去重與生命週期，可加一張表：

```sql
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  notion_file_url text,
  source_page_id text,
  r2_key text unique not null,
  public_url text not null,
  content_hash text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 14.6 同步流程（核心）

每次同步某個 student work 時：

1. 從 Notion 取圖片 URL（`files` 屬性或 block image）。
2. 後端下載圖片二進位內容。
3. 計算 `sha1` 或 `sha256`（做去重與檔名版本控制）。
4. 產生 R2 key，例如：  
   `courses/{course_slug}/projects/{project_notion_id}/{work_notion_id}-{hash}.jpg`
5. 上傳到 R2（設定 `Content-Type` 與 `Cache-Control`）。
6. 產生公開 URL：`{R2_PUBLIC_BASE_URL}/{r2_key}`。
7. 寫回 Supabase：
   1. `student_works.main_image_url = public_url`
   2. `metadata.image_key = r2_key`
   3. `last_synced_at = now()`
8. 寫 `sync_logs`（成功/失敗與錯誤訊息）。

## 14.7 增量同步與覆蓋規則

1. 若 Notion 圖片未變更（hash 相同），跳過上傳，直接沿用舊 URL。
2. 若圖片有更新（hash 不同），上傳新 key，更新 Supabase URL。
3. 舊圖刪除策略可擇一：
   1. 保留舊檔（安全、可回滾，成本較高）。
   2. 延遲刪除（例如 30 天後清理未引用檔）。

## 14.8 失敗處理策略

1. R2 上傳失敗：不要中斷整筆課程同步，該 work 記 warning 並保留舊圖 URL。
2. Notion URL 過期下載失敗：標記待重試。
3. Supabase 寫入失敗：可重試 1-3 次，最終寫入 `sync_logs` 供人工排查。

## 14.9 實作里程碑（建議）

1. Milestone 1：完成 R2 bucket + API token + 後端連線測試。
2. Milestone 2：完成單張主圖同步（Notion -> R2 -> Supabase URL）。
3. Milestone 3：完成批次同步與 hash 去重。
4. Milestone 4：套用到 blog 內文圖片。
5. Milestone 5：上線後監控 7 天（失敗率、同步時間、流量成本）。

## 14.10 驗收清單

1. Notion 新增/替換圖片後，網站顯示的 URL 為 `R2_PUBLIC_BASE_URL` 網域。
2. 同步重跑不會重複上傳同一張圖（hash 去重生效）。
3. 任一 work 圖片同步失敗不會造成整個 course API 失敗。
4. `sync_logs` 可查到每次圖片同步結果。
5. 前端不需要改資料來源，仍只讀 Supabase payload。
