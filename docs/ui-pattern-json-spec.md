# UiPattern JSON 與欄位規格（v1）

本文件整理目前專案支援的 5 種 `UiPattern`：
- `card-spec`
- `data-matrix`
- `gallery-slide`
- `gallery-story`
- `generic-card`

來源依據：
- `shared/contracts.ts`（UiPattern enum）
- `src/types.ts`（`StudentWork` 結構）
- `src/components/projects/*.tsx`（各 pattern 實際使用欄位）

## 1. 通用 JSON 基底（StudentWork）

```json
{
  "id": "work-001",
  "assignmentName": "作品名稱",
  "members": ["學生A", "學生B"],
  "description": "作品描述",
  "mainImage": "https://example.com/main.jpg",
  "moreImages": ["https://example.com/1.jpg", "https://example.com/2.jpg"],
  "url": "https://example.com/project",
  "video": "https://example.com/video.mp4",
  "tags": ["Data", "IoT"],
  "year": "2026",
  "isStarred": true,
  "methodologies": ["Interview", "Journey Map"],
  "dataSpecs": [
    "[timestamp] 2026/02/02 10:00",
    "[location] 廚房門把"
  ],
  "sourceDatabaseId": "notion-db-abc123",
  "gridLocation": "A1"
}
```

## 2. 欄位規格（全域）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | string | 是 | 單筆作品唯一值 |
| `assignmentName` | string | 是 | 作品標題 |
| `members` | string[] | 是 | 成員名單 |
| `description` | string | 是 | 作品敘述 |
| `mainImage` | string(URL) | 是 | 主圖 |
| `sourceDatabaseId` | string | 是 | 來源資料庫 ID |
| `moreImages` | string[] | 否 | 額外圖片 |
| `url` | string(URL) | 否 | 外部連結 |
| `video` | string(URL) | 否 | 影片連結 |
| `tags` | string[] | 否 | 標籤 |
| `year` | string | 否 | 年份（目前前端以字串處理） |
| `isStarred` | boolean | 否 | 推薦標記 |
| `methodologies` | string[] | 否 | 方法標籤 |
| `dataSpecs` | string[] | 否 | 技術資料卡內容（每個字串 = 一張 spec 卡） |
| `gridLocation` | string | 否 | 矩陣座標（如 `A1`） |

## 3. 五種 UiPattern JSON 範例與規格

### 3.1 `generic-card`

Project 設定：
```json
{
  "displayStyle": "generic-card"
}
```

Work 最小可用 JSON：
```json
{
  "id": "work-generic-001",
  "assignmentName": "Color on the Road",
  "members": ["測試人員", "測試人員2"],
  "description": "作品簡介",
  "mainImage": "https://example.com/main.jpg",
  "sourceDatabaseId": "db-color-road"
}
```

欄位重點：
- 必填：`assignmentName`, `members`, `description`, `mainImage`
- 建議：`moreImages`, `year`

### 3.2 `gallery-slide`

Project 設定：
```json
{
  "displayStyle": "gallery-slide"
}
```

Work 最小可用 JSON：
```json
{
  "id": "work-slide-001",
  "assignmentName": "Visual Narrative Project",
  "members": ["學生A", "學生B"],
  "description": "敘事型作品說明",
  "mainImage": "https://example.com/hero.jpg",
  "moreImages": [
    "https://example.com/slide-1.jpg",
    "https://example.com/slide-2.jpg"
  ],
  "year": "2026",
  "sourceDatabaseId": "db-gallery-slide"
}
```

欄位重點：
- 必填：`assignmentName`, `members`, `description`, `mainImage`
- 建議：`moreImages`（可形成輪播）, `year`

### 3.3 `gallery-story`

Project 設定：
```json
{
  "displayStyle": "gallery-story"
}
```

Work 最小可用 JSON：
```json
{
  "id": "work-story-001",
  "assignmentName": "主題一",
  "members": ["學生A", "學生B"],
  "description": "故事型專案摘要",
  "mainImage": "https://example.com/story-main.jpg",
  "moreImages": [
    "https://example.com/story-1.jpg",
    "https://example.com/story-2.jpg"
  ],
  "methodologies": ["Interview", "Mapping"],
  "url": "https://example.com/project",
  "year": "2026",
  "sourceDatabaseId": "db-gallery-story"
}
```

欄位重點：
- 必填：`assignmentName`, `members`, `description`, `mainImage`
- 建議：`moreImages`, `methodologies`, `url`, `year`

### 3.4 `card-spec`

Project 設定：
```json
{
  "displayStyle": "card-spec"
}
```

Work 最小可用 JSON：
```json
{
  "id": "work-spec-001",
  "assignmentName": "Data Card: Door Sensor",
  "members": ["學生A", "學生B"],
  "description": "技術導向作品摘要",
  "mainImage": "https://example.com/spec-main.jpg",
  "tags": ["Sensor", "IoT"],
  "year": "2026",
  "dataSpecs": [
    "[timestamp] 2026/02/02 10:00",
    "[location] 廚房門把",
    "[data value] 1"
  ],
  "sourceDatabaseId": "db-card-spec"
}
```

欄位重點：
- 必填：`assignmentName`, `members`, `description`, `mainImage`
- 強烈建議：`dataSpecs`（`card-spec` 的核心，`string[]`）
- 自動推論：來源欄位名含 `card`（例如 `datacard01`, `card02`）會自動收進 `dataSpecs`
- 建議：`tags`, `year`

### 3.5 `data-matrix`

Project 設定：
```json
{
  "displayStyle": "data-matrix"
}
```

Work 最小可用 JSON：
```json
{
  "id": "work-matrix-001",
  "assignmentName": "Matrix Item 01",
  "members": ["學生A"],
  "description": "矩陣格點資料",
  "mainImage": "https://example.com/matrix.jpg",
  "gridLocation": "C12",
  "year": "2026",
  "sourceDatabaseId": "db-data-matrix"
}
```

欄位重點：
- 必填：`assignmentName`, `members`, `description`, `mainImage`
- 強制需求：`gridLocation`（`data-matrix` pattern）
- 建議：`year`

## 4. Pattern 驗證規則（建議給 AI + Skill 使用）

- 共通最低門檻：
  - `assignmentName` 不可為空
  - `mainImage` 不可為空
- `data-matrix`：
  - 需有 `gridLocation`（格式建議 `A1` 到 `P30`）
- `card-spec`：
  - 建議 `dataSpecs.length > 0`
- 其他 pattern：
  - 無額外硬性欄位，但建議補齊 `members`、`description`、`year`

## 5. 與 FieldMapping 對接建議

- 先把來源 DB 欄位映射到上述通用基底，再交給 `displayStyle` 決定渲染 pattern。
- `FieldMapping` 建議至少覆蓋：
  - `assignmentName`, `members`, `description`, `mainImage`
- 依 pattern 補充：
  - `data-matrix` 補 `gridLocation`
  - `card-spec` 補 `dataSpecs`
  - `gallery-*` 補 `moreImages`
