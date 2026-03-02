# 人類操作手冊（完整版）：Notion + Supabase + Cloudflare + Railway

這份文件是給「人」操作的完整手冊。  
你只需要照步驟執行平台設定，不需要先看程式碼。

AI 對應文件：`docs/notion-supabase-cloudflare-implementation-plan.md`

---

## A. 全局目標

你要達成的架構：

1. Notion：內容編輯來源（老師/同學編輯資料、圖片、文字）。
2. Supabase：網站主要讀取資料庫。
3. Cloudflare R2：圖片存放與公開 URL。
4. Railway：部署後端與排程同步。

---

## B. 先備資料（先整理好）

1. Notion integration token（`NOTION_TOKEN`）。
2. Notion `Courses` / `Projects` / 所有 `Source Database`。
3. Supabase `Project URL` + `secret key (sb_secret...)`。
4. Cloudflare `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + bucket。
5. Railway 專案可編輯 Variables。

---

## C. Notion 設定（平台：Notion）

## C.1 建立 Integration

1. 進入 Notion Integrations。
2. 建立 integration（例如 `course-portfolio-sync`）。
3. 複製 token（`ntn_...`）保存。

## C.2 分享 DB 權限（必要）

把 integration 分享到：

1. `Courses`
2. `Projects`
3. 每一個 `Source Database`

## C.3 Courses 欄位（必要）

1. `Slug`（文字）
2. `Projects`（relation）
3. `Status`（保留給 generate 結果，會被寫入 `generated/failed`）
4. `PublishedStatus`（checkbox，新增）

`PublishedStatus` 規則：

1. 勾選：此課程可被 `publish=true` 同步。
2. 未勾選：視為不發布。

---

## D. Supabase 設定（平台：Supabase）

## D.1 建立專案與 key

1. 建立 project。
2. `Settings -> API` 取得：
   1. `Project URL` -> `SUPABASE_URL`
   2. `secret key (sb_secret...)` -> `SUPABASE_SECRET_KEY`

注意：後端不要用 publishable key。

## D.2 建表 SQL（若尚未做）

在 Supabase `SQL Editor -> New query` 貼上以下完整 SQL 後執行：

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

## D.3 既有專案追加欄位（Phase E 必做）

在 `SQL Editor -> New query` 貼上：

```sql
alter table public.courses
add column if not exists is_active boolean not null default true;

alter table public.courses
add column if not exists is_published boolean not null default false;

alter table public.courses
add column if not exists notion_last_edited_time timestamptz;
```

說明：

1. 這是新增欄位，不是新增 table。
2. 有 `if not exists`，可重跑。

---

## E. Cloudflare R2 設定（平台：Cloudflare）

## E.1 建立 bucket

1. 進入 `R2`。
2. 建立 bucket（例：`course-portfolio-media`）。
3. 記下 bucket 名稱 -> `R2_BUCKET`。

## E.2 先釐清 token 類型

你會看到兩種：

1. Account API token：管理 Cloudflare 帳號資源。
2. R2 Access Keys：S3 client 上傳下載用（本流程主要用這個）。

## E.3 建立 R2 Access Keys（必要）

1. 在 R2 入口建立 token / access key。
2. 權限：指定 bucket 的 `Object Read + Object Write`。
3. 記下：
   1. `Access Key ID` -> `R2_ACCESS_KEY_ID`
   2. `Secret Access Key` -> `R2_SECRET_ACCESS_KEY`

建立後常看到三個值差異：

1. `Token value`：管理 API 用，可留存備用。
2. `Access Key ID`：S3 帳號。
3. `Secret Access Key`：S3 密碼。

本流程實際必要：`S3 endpoint + Access Key ID + Secret Access Key`。

## E.4 啟用公開 URL（先用開發 URL）

1. 打開 bucket `Settings`。
2. 左側選 `Public Development URL`。
3. 按 `Enable`。
4. 取得 `https://...r2.dev`。
5. 這個值填到 `R2_PUBLIC_BASE_URL`。

注意：

1. 不要把 Railway 網址填成 `R2_PUBLIC_BASE_URL`。
2. 後續可升級成 `Custom Domain`（例 `media.your-domain.com`）。

## E.5 CORS 何時需要

如果流程是 `Notion -> Backend -> R2`，通常不需要 CORS。  
只有前端瀏覽器直傳 R2 才要設定。

---

## F. Railway 設定（平台：Railway）

## F.1 後端 service variables

```env
NOTION_TOKEN=
NOTION_DB_COURSES_ID=
NOTION_DB_PROJECTS_ID=
NOTION_API_VERSION=2022-06-28

SUPABASE_URL=
SUPABASE_SECRET_KEY=
READ_FROM_SUPABASE=true

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
IMAGE_BACKEND=r2
IMAGE_SYNC_ENABLED=true

COURSE_LINK_SYNC_SECRET=
```

設定後重新部署。

---

## G. 驗證流程

## G.1 手動同步（terminal）

```bash
curl -X POST "https://course-portfolio-showcase-production.up.railway.app/api/admin/sync-course-supabase" \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: <COURSE_LINK_SYNC_SECRET>" \
  -d '{"slug":"<YOUR_COURSE_SLUG>"}'
```

成功應看到：

1. `ok:true`
2. `workUpserted > 0`
3. `imageUploaded > 0`

## G.2 資料驗證

1. Supabase `student_works.main_image_url` 是 R2 URL。
2. `moreImages` 也為 R2 URL（存在 metadata）。
3. 前台頁面圖片可正常顯示。

---

## H. 自動化（先簡後進階）

## H.1 先上 Railway Cron（單課程）

1. 建立 empty service
2. Settings/ Deploy 找到Cron Schedule
3. 設定時間
4. 至Deploy/ Custom Start Command: 

node -e "fetch('https://course-portfolio-showcase-production.up.railway.app/api/admin/sync-all-courses-supabase',{method:'POST',headers:{'Content-Type':'application/json','x-sync-secret':process.env.COURSE_LINK_SYNC_SECRET},body:JSON.stringify({updated_only:true,publish:true,deactivate:true})}).then(async r=>{const t=await r.text();console.log(t);if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})"

5. 至Variables / 設定 COURSE_LINK_SYNC_SECRET / value與原本相同


## H.2 進階：sync-all（由 AI 後端實作）

支援：

1. `updated_only=true`
2. `publish=true`（讀 `PublishedStatus`）
3. `deactivate=true`（`is_active=false`）

## H.3 較安全版 Notion Button（立即同步，不暴露主 secret）

這一節是「按下 Notion button 就立即同步」，且比直接把主 secret 放 URL 更安全。

### H.3.1 新增欄位（Notion）

在 `Courses` DB 新增：

1. `SyncToken`（Text）
2. `Sync Now`（Button）

`Slug` 欄位沿用既有欄位，不需新增。

### H.3.2 新增資料表（Supabase）

在 `SQL Editor -> New query` 執行：

```sql
create table if not exists public.course_sync_tokens (
  id uuid primary key default gen_random_uuid(),
  course_slug text not null unique,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### H.3.3 建立與填入 token（人要做）

1. 每門課生成一組高強度 token（建議 32 字元以上）。
2. 在 Notion 該課程列填入 `SyncToken`。
3. 同時寫入 Supabase `course_sync_tokens`：
   1. `course_slug` = 該課程 `Slug`
   2. `token` = 相同 token
   3. `is_active` = `true`

### H.3.4 設定 Button URL

`Sync Now` 按鈕 action 選 `Open URL`，URL 使用該列欄位值：

```text
https://course-portfolio-showcase-production.up.railway.app/api/admin/sync-course-button?slug={{Slug}}&token={{SyncToken}}
```

若 Notion button 無法插欄位變數，改用 Formula 先組 URL，再由按鈕開啟。

### H.3.5 為什麼更安全

1. 不再把全域 `COURSE_LINK_SYNC_SECRET` 放在 Notion URL。
2. 每門課各自 token，洩漏只影響單一課程。
3. 可以單獨停用某課程 token（`is_active=false`）。

---

## I. 常見錯誤

1. Notion 403/404：DB 未 share integration。
2. Supabase 寫入失敗：key 用錯（拿到 publishable key）。
3. R2 上傳失敗：Access Keys 權限錯或 bucket 名稱錯。
4. 圖片網址填錯：`R2_PUBLIC_BASE_URL` 填成 Railway URL。

---

## J. 人類完成清單

1. [ ] Notion integration 已建立
2. [ ] Notion 三層 DB 已分享權限
3. [ ] `PublishedStatus` 已建立（checkbox）
4. [ ] Supabase 建表完成
5. [ ] `courses` 追加欄位 SQL 已執行
6. [ ] R2 bucket + access keys + public URL 已完成
7. [ ] Railway variables 完整，並重新部署
8. [ ] 手動同步回傳 `ok:true`
9. [ ] 前台顯示正常、圖片來自 R2
