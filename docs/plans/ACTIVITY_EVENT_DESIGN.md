# Activity & Events Log 模板設計說明書 (Design Specification)

本文件詳細說明了 `ActivityEvent` 模板的設計架構、資料定義、核心代碼實作以及成果紀錄匯出功能。

---

## 1. 資料定義 (Data Definition)

`ActivityEvent` 擴展了基礎的 `StudentWork` 介面，增加了專門用於學術活動與事件紀錄的欄位。

### 1.1 StudentWork 介面擴展
在 `src/types.ts` 中定義的相關欄位：

```typescript
export interface StudentWork {
  // 基礎欄位
  id: string;
  assignmentName: string; // 活動/論文名稱
  members: string[];      // 參與成員/作者
  description: string;    // 活動描述
  mainImage: string;      // 主視覺照片
  moreImages?: string[];  // 更多活動照片
  year?: string;          // 年度
  url?: string;           // 外部連結 (官網/論文下載)

  // Activity Event 專用欄位
  startDate?: string;     // 開始日期 (YYYY-MM-DD)
  endDate?: string;       // 結束日期 (YYYY-MM-DD)
  country?: string;       // 國家
  city?: string;          // 城市
  grant?: string;         // 贊助單位/計畫名稱
  publicationName?: string; // 發表刊物/研討會名稱
  themeTag?: string;      // 活動性質 (例如：Workshop, Conference)
}
```

---

## 2. UI 組件設計 (Component Design)

組件位於 `src/components/projects/ActivityEvent.tsx`，採用兩階段展示邏輯：**卡片預覽** 與 **全螢幕詳情**。

### 2.1 卡片預覽 (Card Preview)
- **視覺重點**：大面積活動照片與性質標籤 (Theme Tag)。
- **元數據**：展示年份、地點 (城市, 國家)。
- **互動**：懸停時照片輕微放大，點擊開啟詳情視窗。

### 2.2 詳情視窗 (Detail Modal)
- **媒體庫**：左側 60% 寬度，支援多圖切換與動畫過場。
- **資訊區塊**：右側 40% 寬度，包含：
  - 活動期間 (Period)
  - 地點 (Location)
  - 贊助單位 (Grant)
  - 發表資訊 (Publication)
  - 成員標籤 (Members)

---

## 3. 成果紀錄匯出功能 (Achievement Record Export)

匯出功能實作於 `CourseDetailTemplate.tsx` 的 `handleExport` 函數中，旨在生成符合 A4 列印標準的專業報告。

### 3.1 核心邏輯
1. **主題分組**：根據 `themeTag` 將過濾後的活動進行分組。
2. **HTML 生成**：動態構建包含 CSS 樣式的 HTML 字串。
3. **A4 排版優化**：
   - 使用 `@page { size: A4; margin: 2.5cm; }` 定義列印邊界。
   - 使用 `page-break-inside: avoid;` 防止活動內容被跨頁切斷。
   - 整合 Google Fonts (Inter & Playfair Display)。

### 3.2 匯出代碼片段 (核心部分)
```javascript
const handleExport = () => {
  // 1. 按主題分組 (Grouping)
  const groupedWorks = {};
  filteredWorks.forEach(work => {
    const theme = work.themeTag || 'Other Activities';
    if (!groupedWorks[theme]) groupedWorks[theme] = [];
    groupedWorks[theme].push(work);
  });

  // 2. 構建 HTML 與 CSS
  const htmlContent = `
    <html>
      <style>
        @page { size: A4; margin: 2.5cm; }
        .theme-section { margin-bottom: 50px; page-break-inside: avoid; }
        .image-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .main-image { grid-column: span 2; aspect-ratio: 21/9; }
      </style>
      <body>
        <!-- 動態生成內容 -->
        ${Object.entries(groupedWorks).map(([theme, items]) => `
          <div class="theme-title">${theme}</div>
          ${items.map(work => `
            <div class="activity-item">
              <h3>${work.assignmentName}</h3>
              <div class="image-gallery">
                <img src="${work.mainImage}" class="main-image" />
              </div>
              <p>${work.description}</p>
            </div>
          `).join('')}
        `).join('')}
      </body>
    </html>
  `;

  // 3. 觸發下載
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = "Achievement_Record.html";
  link.click();
};
```

---

## 4. 資料範例 (Data Example)

以下為 `src/mockData.ts` 中的標準活動資料格式範例：

```json
{
  "id": "sw-18",
  "assignmentName": "CHI 2026: Human-Computer Interaction Conference",
  "members": ["林志明", "陳大文", "Sarah Johnson"],
  "description": "在 CHI 2026 發表關於「情感感測器在遠端協作中的應用」之研究論文。",
  "mainImage": "https://picsum.photos/seed/activity1/1200/800",
  "moreImages": ["https://picsum.photos/seed/activity1-1/1200/800"],
  "year": "2026",
  "themeTag": "Academic Conference",
  "startDate": "2026-05-10",
  "endDate": "2026-05-15",
  "country": "Germany",
  "city": "Hamburg",
  "grant": "National Science and Technology Council (NSTC)",
  "publicationName": "Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems",
  "url": "https://chi2026.acm.org",
  "sourceDatabaseId": "db-activity"
}
```

---

## 5. 使用建議 (Usage Tips)

1. **照片品質**：匯出報告會包含照片，建議上傳解析度至少為 1200px 寬度的圖片以確保列印品質。
2. **列印設定**：下載 HTML 檔案後，使用 Chrome 或 Edge 開啟，按下 `Ctrl+P`，在設定中勾選「背景圖形」以顯示照片與底色。
3. **篩選匯出**：匯出功能會遵循當前 UI 的篩選狀態，使用者可以先篩選「特定年度」或「特定主題」再進行匯出，以生成專屬的年度報告。
