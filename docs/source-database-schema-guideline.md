# Source Database ID 新增規範（Notion）

版本：v1  
更新日：2026-02-27

本文件定義「未來新增 `SourceDatabaseId` 時」每個來源資料庫應具備的欄位規格，確保可自動 mapping 到既有 `UiPattern`，且不需修改前端 UI。

## 1. 命名原則

1. 優先使用本文件的「標準欄位名稱」。
2. 欄位名稱請保持英文、大小寫固定，避免同義名稱散落（例如同時出現 `Name`、`Title`、`ProjectName`）。
3. 一個來源 DB 只維護一套欄位語意，不要重複放同意義欄位。

## 2. 共同必要欄位（所有 Source DB 都要有）

這些欄位會對應到 `StudentWork` 的最低可用資料。

| 標準欄位名稱（Notion） | 對應 StudentWork | Notion 屬性型別（建議） | 必要 | 說明 |
|---|---|---|---|---|
| `AssignmentName` | `assignmentName` | `title` 或 `rich_text` | 是 | 作品標題 |
| `Members` | `members` | `multi_select`（或 `people`） | 是 | 成員名單 |
| `StudentName` | `members` | `multi_select`（或 `people`） | 建議（可取代 `Members`） | 成員姓名（與 `StudentID` 依順序配對） |
| `Description` | `description` | `rich_text` | 是 | 作品敘述 |
| `MainImage` | `mainImage` | `files`（建議）或 `url` | 是 | 主圖 URL |

備註：
- `id` 由 Notion page id 自動帶入。
- `sourceDatabaseId` 由 Project 層級提供，不需在 Source DB 內重複建立。

## 3. Optional 欄位（建議）

| 標準欄位名稱（Notion） | 對應 StudentWork | Notion 屬性型別（建議） | 是否可選 | 用途 |
|---|---|---|---|---|
| `MoreImages` | `moreImages` | `files` | 可選 | 額外圖片、輪播圖 |
| `URL` | `url` | `url` | 可選 | 外部專案連結 |
| `Video` | `video` | `url` | 可選 | 影片連結 |
| `Tags` | `tags` | `multi_select` | 可選 | 分類/標籤 |
| `Year` | `year` | `select` 或 `rich_text` | 可選 | 年份/學期 |
| `IsStarred` | `isStarred` | `checkbox` | 可選 | 精選標記 |
| `Methodologies` | `methodologies` | `multi_select` | 可選 | 方法論標籤 |
| `DataSpecs` | `dataSpecs` | `rich_text`（每筆為一張卡片文字）或 `multi_select` | 可選 | 技術資料卡文字內容 |
| `StudentID` | `studentIds` | `multi_select` 或 `rich_text` | 可選（建議） | 成員學號（與 `StudentName`/`Members` 依順序對應） |
| `GridLocation` | `gridLocation` | `rich_text` 或 `select` | 可選（某些 pattern 必要） | 矩陣座標（例如 `A1`） |

## 4. UiPattern 套用規則表

| UiPattern | 共同必要欄位（都要有） | Pattern 額外必要欄位 | Pattern 建議欄位 | 何時適用 |
|---|---|---|---|---|
| `generic-card` | `AssignmentName`, `Members`, `Description`, `MainImage` | 無 | `MoreImages`, `Year`, `Tags` | 一般卡片展示，無特殊資料結構 |
| `gallery-slide` | 同上 | 無 | `MoreImages`（至少 1 筆） | 以多圖輪播為主 |
| `gallery-story` | 同上 | 無 | `MoreImages`, `Methodologies`, `URL` | 有敘事段落、方法脈絡 |
| `card-spec` | 同上 | 無（但建議視為準必要） | `DataSpecs` 或任何欄位名含 `card`（至少 1 筆） | 有技術量測/規格資料 |
| `data-matrix` | 同上 | `GridLocation` | `Year`, `Tags` | 需要放進矩陣座標格位 |

## 5. UiPattern Template 資料結構整理（名稱 / 屬性 / 用途）

以下以 5 種 `UiPattern template` 為主，整理實際 mapping 時會用到的資料結構。

### 5.1 `generic-card`

| 名稱 | 屬性 | 用途 |
|---|---|---|
| `Project.DisplayStyle` | `generic-card` | 指定前端以一般卡片樣式渲染。 |
| `StudentWork.Core` | `AssignmentName`, `Members`, `Description`, `MainImage` | 提供卡片標題、成員、摘要、主視覺。 |
| `StudentWork.MemberPair` | `StudentName` + `StudentID` | 依陣列順序對應姓名與學號顯示。 |
| `StudentWork.Optional` | `MoreImages`, `Year`, `Tags`, `URL` | 補充更多圖片、年份、分類與外部連結。 |

### 5.2 `gallery-slide`

| 名稱 | 屬性 | 用途 |
|---|---|---|
| `Project.DisplayStyle` | `gallery-slide` | 指定前端以多圖輪播樣式渲染。 |
| `StudentWork.Core` | `AssignmentName`, `Members`, `Description`, `MainImage` | 提供輪播卡片的基本資訊。 |
| `StudentWork.MemberPair` | `StudentName` + `StudentID` | 依陣列順序對應姓名與學號顯示。 |
| `StudentWork.Gallery` | `MoreImages` | 提供輪播用圖片陣列（建議至少 1 筆）。 |
| `StudentWork.Optional` | `Year`, `Tags`, `URL` | 補充時間、分類與外部連結。 |

### 5.3 `gallery-story`

| 名稱 | 屬性 | 用途 |
|---|---|---|
| `Project.DisplayStyle` | `gallery-story` | 指定前端以故事/敘事型畫廊渲染。 |
| `StudentWork.Core` | `AssignmentName`, `Members`, `Description`, `MainImage` | 提供故事卡片基本內容。 |
| `StudentWork.MemberPair` | `StudentName` + `StudentID` | 依陣列順序對應姓名與學號顯示。 |
| `StudentWork.Story` | `MoreImages`, `Methodologies` | 提供故事圖片序列與方法脈絡標籤。 |
| `StudentWork.Optional` | `URL`, `Year`, `Tags` | 補充延伸閱讀、年份與分類。 |

### 5.4 `card-spec`

| 名稱 | 屬性 | 用途 |
|---|---|---|
| `Project.DisplayStyle` | `card-spec` | 指定前端以規格卡（Data Card）渲染。 |
| `StudentWork.Core` | `AssignmentName`, `Members`, `Description`, `MainImage` | 提供規格卡基本專案資訊。 |
| `StudentWork.MemberPair` | `StudentName` + `StudentID` | 依陣列順序對應姓名與學號顯示。 |
| `StudentWork.Specs` | `DataSpecs[]`（`string[]`） | 每個字串代表一張獨立 spec 卡內容。 |
| `Source.AutoDetect` | `card*` 欄位（例如 `datacard01`, `card02`） | 來源欄位名稱只要含 `card`，即自動收進 `dataSpecs`。 |
| `StudentWork.Optional` | `Tags`, `Year`, `URL`, `MoreImages` | 補充分類、年份、連結與延伸圖片。 |

### 5.5 `data-matrix`

| 名稱 | 屬性 | 用途 |
|---|---|---|
| `Project.DisplayStyle` | `data-matrix` | 指定前端以矩陣格點樣式渲染。 |
| `StudentWork.Core` | `AssignmentName`, `Members`, `Description`, `MainImage` | 提供矩陣格點基本內容。 |
| `StudentWork.MemberPair` | `StudentName` + `StudentID` | 依陣列順序對應姓名與學號顯示。 |
| `StudentWork.Matrix` | `GridLocation` | 指定資料落在矩陣中的座標位置（例如 `A1`）。 |
| `StudentWork.Optional` | `Year`, `Tags`, `URL`, `MoreImages` | 補充時間、分類與延伸資訊。 |


## 6. 欄位訊號 -> 可推論 UiPattern（自動判斷）

| 偵測到的欄位訊號 | 優先推論 UiPattern |
|---|---|
| 有 `GridLocation`（或欄位名含 `grid`/`cell`） | `data-matrix` |
| 有 `DataSpecs` 或任何欄位名含 `card` | `card-spec` |
| 有 `MoreImages`（或欄位名含 `gallery`） | `gallery-slide` |
| 有 `Methodologies`、`Story` 類欄位 | `gallery-story` |
| 以上都不明確 | `generic-card`（fallback） |

## 7. 建議建立模板（可直接複製）

最小可用（MVP）欄位：
1. `AssignmentName` (`title`)
2. `Members` (`multi_select`)
3. `Description` (`rich_text`)
4. `MainImage` (`files`)

進階建議：
1. `MoreImages` (`files`)
2. `Tags` (`multi_select`)
3. `Year` (`select`)
4. `Methodologies` (`multi_select`)
5. `URL` (`url`)
6. `DataSpecs` (`rich_text`) 或 `datacard01`/`datacard02`... (`rich_text`)
7. `GridLocation` (`rich_text`)

## 8. 驗收檢查清單（新增 SourceDatabaseId 時）

1. 共同必要欄位 4 項是否都存在。
2. `MainImage` 是否能輸出有效 URL（`files` 最穩定）。
3. 若要用 `data-matrix`，是否有 `GridLocation` 且格式一致（建議 `A1` 形式）。
4. 若要用 `card-spec`，是否有 `DataSpecs` 或任何命名含 `card` 的欄位可供轉成 spec 卡。
5. Project 資料列中的 `SourceDatabaseId`、`UiPattern`、`FieldMapping` 是否已同步。
6. 跑一次 mapping sync 後，是否無高風險 warning（required field missing）。
