# Source Database Schema Guideline（Notion）

版本：v2  
更新日：2026-02-28

本文件目標：
- 先快速理解 5 種 `UiPattern template` 的資料結構需求。
- 再提供每個 datasource DB 該準備的「必要 / Optional」欄位建議。
- 讓新增 `SourceDatabaseId` 時，能直接 mapping 到既有前端，不改 UI。

---

## A. 先看 Template：5 種 UiPattern 資料結構

### A1. `generic-card`

用途：一般卡片展示（無特殊結構）。

| 類別 | 欄位 | 必要性 | 說明 |
|---|---|---|---|
| Core | `assignmentName`, `members`, `description`, `mainImage` | 必要 | 最低可渲染卡片資料 |
| Member Pair | `studentIds` | 建議 | 與 `members` 依順序配對（可不填） |
| Optional | `year`, `tags`, `moreImages`, `url` | 可選 | 補充資訊 |

---

### A2. `gallery-slide`

用途：多圖輪播型展示。

| 類別 | 欄位 | 必要性 | 說明 |
|---|---|---|---|
| Core | `assignmentName`, `members`, `description`, `mainImage` | 必要 | 基本內容 |
| Gallery | `moreImages` | 建議 | 輪播圖片（建議至少 1 筆） |
| Member Pair | `studentIds` | 建議 | 與 `members` 依順序配對 |
| Optional | `year`, `tags`, `url` | 可選 | 補充資訊 |

---

### A3. `gallery-story`

用途：敘事型展示。

| 類別 | 欄位 | 必要性 | 說明 |
|---|---|---|---|
| Core | `assignmentName`, `members`, `description`, `mainImage` | 必要 | `description` 會直接用於故事內容區塊 |
| Story | `methodologies`, `moreImages` | 建議 | 方法脈絡與圖像敘事 |
| Member Pair | `studentIds` | 建議 | 與 `members` 依順序配對 |
| Optional | `year`, `tags`, `url` | 可選 | 補充資訊 |

---

### A4. `card-spec`

用途：Data Card / Spec Card 展示。

| 類別 | 欄位 | 必要性 | 說明 |
|---|---|---|---|
| Core | `assignmentName`, `members`, `description`, `mainImage` | 必要 | 基本內容 |
| Specs | `dataSpecs` (`string[]`) | 建議（核心） | 每個字串 = 一張 spec 卡 |
| Auto Detect | `card*` 命名欄位 | 建議 | 例如 `datacard01`, `card02`，會自動收進 `dataSpecs` |
| Member Pair | `studentIds` | 建議 | 與 `members` 依順序配對 |
| Optional | `year`, `tags`, `url`, `moreImages` | 可選 | 補充資訊 |

備註：舊資料若是 `{ label, value, timestamp }` 物件格式，系統會轉成字串卡片內容。

---

### A5. `data-matrix`

用途：矩陣座標展示。

| 類別 | 欄位 | 必要性 | 說明 |
|---|---|---|---|
| Core | `assignmentName`, `members`, `studentIds`, `description`, `mainImage`, `year` | 必要 | `data-matrix` 建議視為最低完整資訊 |
| Matrix | `gridLocation` | 必要（強制） | 例如 `A1`, `C12`；決定作品落在哪個格位 |
| Optional | `tags`, `url`, `moreImages` | 可選 | 補充資訊 |

重點：`gridLocation` 是 `data-matrix` 的關鍵欄位，缺少時不應視為有效 matrix 資料。

---

## B. 再看 Source DB：必要與 Optional 欄位建議

### B1. 所有 datasource DB 的共同必要欄位

| Notion 欄位名稱（建議） | 對應 StudentWork | 型別建議 | 必要 | 說明 |
|---|---|---|---|---|
| `AssignmentName` | `assignmentName` | `title` 或 `rich_text` | 是 | 作品標題 |
| `Members` 或 `StudentName` | `members` | `multi_select` / `people` | 是 | 成員姓名清單 |
| `Description` | `description` | `rich_text` | 是 | 作品描述 |
| `MainImage` | `mainImage` | `files`（優先）或 `url` | 是 | 主圖 |

備註：
- `id` 由 Notion page id 帶入。
- `sourceDatabaseId` 由 project 層提供，不需在 source DB 重複建欄。

---

### B2. 所有 datasource DB 的共同 Optional 欄位

| Notion 欄位名稱（建議） | 對應 StudentWork | 型別建議 | 用途 |
|---|---|---|---|
| `StudentID` | `studentIds` | `multi_select` 或 `rich_text` | 成員學號（與姓名依順序配對） |
| `Year` | `year` | `select` 或 `rich_text` | 年份 |
| `Tags` | `tags` | `multi_select` | 分類標籤 |
| `MoreImages` | `moreImages` | `files` | 額外圖片 |
| `URL` | `url` | `url` | 外部連結 |
| `Video` | `video` | `url` | 影片連結 |
| `Methodologies` | `methodologies` | `multi_select` | 方法論標籤 |
| `DataSpecs` | `dataSpecs` | `rich_text`（字串） | spec 卡內容 |
| `GridLocation` | `gridLocation` | `rich_text` 或 `select` | 矩陣座標 |

---

### B3. 各 template 對 source DB 的補充要求

| UiPattern | 在共同必要欄位之外，需再補的欄位 | 建議補充欄位 |
|---|---|---|
| `generic-card` | 無 | `StudentID`, `Year`, `Tags` |
| `gallery-slide` | 無 | `MoreImages`, `StudentID`, `Year` |
| `gallery-story` | 無 | `Methodologies`, `MoreImages`, `StudentID`, `URL` |
| `card-spec` | `DataSpecs` 或任一 `card*` 欄位（至少 1 筆） | `StudentID`, `Tags`, `Year` |
| `data-matrix` | `GridLocation`（必要）+ `Year` + `StudentID` | `Tags`, `URL` |

---

## C. Mapping 規則（避免常見錯誤）

### C1. 成員姓名 / 學號配對

建議 mapping 寫法：
1. `members = StudentName|string[]`
2. `studentIds = StudentID|string[]`

規則：
- 前端以陣列索引配對 `members[i] <-> studentIds[i]`。
- 請避免把 `StudentID,StudentName` 混寫到同一個 `members` mapping。

### C2. card-spec 自動收集規則

- 來源欄位名稱包含 `card`（不分大小寫）會被收進 `dataSpecs`。
- 例如：`datacard01`, `card_02`, `Card3`。

### C3. data-matrix 座標規則

- `gridLocation` 建議固定格式（例如 `A1` ~ `P30`）。
- 同一個資料集請保持一致格式，避免混用 `A-1`, `a01` 等變體。

---

## D. 快速驗收清單（新增 SourceDatabaseId 時）

1. 共同必要欄位是否完整：`AssignmentName`, `Members/StudentName`, `Description`, `MainImage`。
2. 若有學號需求：`StudentID` 是否可和姓名一一對應。
3. 若使用 `card-spec`：是否有 `DataSpecs` 或任一 `card*` 欄位。
4. 若使用 `data-matrix`：是否有 `gridLocation`，且格式一致。
5. project 資料列的 `SourceDatabaseId`、`UiPattern`、`FieldMapping` 是否同步。
6. 跑 mapping sync 後，是否無 required-field warning。
