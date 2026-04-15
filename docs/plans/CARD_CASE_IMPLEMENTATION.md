# CardCase Template Implementation Plan

本文件詳細說明了 `CardCase` 模板的設計架構、核心程式碼實作以及相關檔案配置。此模板專為案例研究 (Case Study) 設計，具備視覺化的專案瀏覽器與專業的 A4 橫向列印功能。

---

## 1. 核心檔案清單 (Core Files)

| 檔案路徑 | 職責說明 |
| :--- | :--- |
| `src/types.ts` | 定義 `StudentWork` 的擴充欄位（如 `interactionPart`, `targetUser` 等）與 `Project` 的 `displayStyle`。 |
| `src/components/projects/CardCase.tsx` | **卡片組件**。負責滿版影像背景、資訊疊加層以及 Hover 動態效果。 |
| `src/components/templates/CourseDetailTemplate.tsx` | **模板邏輯中心**。實作專案瀏覽器 (Project Browser) 的切換邏輯與 A4 橫向列印函數 `handlePrintCardCase`。 |
| `src/App.tsx` | 將 `card-case` 顯示樣式映射至 `CardCase` 組件。 |
| `src/mockData.ts` | 提供測試用的專案與卡片資料。 |

---

## 2. 資料結構 (Data Structure)

在 `src/types.ts` 中新增的關鍵欄位：

```typescript
export interface StudentWork {
  // ... 基礎欄位
  interactionPart?: string; // 互動部位圖示 URL
  targetUser?: string;      // 目標對象
  designTeam?: string;      // 設計團隊
  foundBy?: string;         // 蒐集者
  memberDetails?: { name: string; id: string }[]; // 小組成員姓名與學號
}
```

---

## 3. 視覺設計規範 (Design Specification)

### 3.1 卡片視覺 (Card Visuals)
- **背景**：`object-cover` 滿版影像。
- **疊加層**：底部使用 `bg-gradient-to-t` (Black 90% -> Transparent) 確保文字讀取。
- **毛玻璃效果**：標籤與圖示背景使用 `backdrop-blur-md`。
- **字體**：標題使用 `text-lg font-bold`，元數據使用 `text-[10px] tracking-widest`。

### 3.2 專案瀏覽器 (Project Browser)
- **封面模式**：`aspect-[21/9]` 的大尺寸封面，點擊後觸發 `setIsProjectEntered(true)`。
- **列表模式**：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` 的響應式網格。

---

## 4. 重點程式碼實作 (Key Implementation)

### 4.1 A4 橫向列印邏輯
位於 `CourseDetailTemplate.tsx`，核心在於 CSS 的 `@page` 設定與網格佈局：

```javascript
const handlePrintCardCase = () => {
  const htmlContent = `
    <style>
      @page { size: A4 landscape; margin: 0; }
      .page {
        width: 297mm; height: 210mm;
        display: grid;
        grid-template-columns: repeat(4, 1fr); /* 4 欄 */
        grid-template-rows: repeat(2, 1fr);    /* 2 列 */
        gap: 5mm;
        padding: 10mm;
      }
      .card { border: 1px solid #000; position: relative; }
      .details { font-size: 9pt; } /* 嚴格遵守 9pt 限制 */
    </style>
    <body>
      <!-- 每頁 8 張卡片的循環邏輯 -->
    </body>
  `;
  // ... 開啟新視窗並執行 window.print()
};
```

### 4.2 條件式渲染 (Conditional Rendering)
在模板中使用 `isProjectEntered` 狀態來切換介面：

```tsx
{/* 封面模式 */}
{activeProject?.displayStyle === 'card-case' && !isProjectEntered && (
  <ProjectCover onClick={() => setIsProjectEntered(true)} />
)}

{/* 卡片列表模式 */}
{activeProject?.displayStyle === 'card-case' && isProjectEntered && (
  <CardGrid works={filteredWorks} />
)}
```

---

## 6. 跨平台移植與資料整合 (Portability & Data Integration)

如果您希望將此視覺模板遷移至其他網站（例如串接 Notion Database），請參考以下架構建議，以確保「視覺組件」與「資料來源」解耦。

### 6.1 核心遷移組件
只需複製以下檔案即可在其他 React 專案中使用該視覺：
- `src/components/projects/CardCase.tsx` (視覺靈魂)
- `src/lib/utils.ts` (Tailwind 工具函數)

### 6.2 資料適配器模式 (Adapter Pattern)
為了保留資料轉換的空間，建議在串接外部 API（如 Notion）時，建立一個適配器函數，將外部資料格式轉換為 `CardCase` 預期的 `StudentWork` 介面。

**範例：Notion 資料轉換邏輯**
```typescript
// 將 Notion API 回傳的複雜 JSON 轉換為 CardCase 格式
const mapExternalDataToCardCase = (externalItem: any): StudentWork => {
  return {
    id: externalItem.id,
    assignmentName: externalItem.properties.Title.title[0].plain_text, // 映射名稱
    mainImage: externalItem.cover?.url || externalItem.properties.Image.url, // 映射滿版背景
    interactionPart: externalItem.icon?.url, // 映射圓形圖示
    targetUser: externalItem.properties.Target.select.name,
    designTeam: externalItem.properties.Team.rich_text[0].plain_text,
    year: externalItem.properties.Year.number.toString(),
    tags: externalItem.properties.Tags.multi_select.map((s: any) => s.name),
    foundBy: externalItem.properties.Collector.rich_text[0].plain_text
  };
};
```

### 6.3 實作建議
1. **保持 UI 純粹**：不要在 `CardCase.tsx` 內直接撰寫 API 呼叫邏輯。
2. **集中管理轉換**：在資料進入頁面組件之前，統一通過適配器函數處理。
3. **列印邏輯移植**：若需移植列印功能，請將 `handlePrintCardCase` 函數封裝為獨立的 Service，並傳入已轉換好的資料陣列。
