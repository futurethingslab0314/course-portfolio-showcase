# Research Blog 設計與數據結構說明文件

本文檔詳細說明了 **Research Blog (部落格風格)** 版面的設計邏輯、數據結構以及相關屬性定義。

---

## 1. 設計理念 (Design Philosophy)

Research Blog 旨在提供一個沉浸式的閱讀環境，適合展示需要深入紀錄、研究日誌或長篇圖文說明的作品。

### 視覺特點：
- **直角美學 (No R Corners)**：移除所有圓角設定，呈現方正、現代且專業的視覺風格。
- **編輯感排版**：採用大尺寸標題、引言式簡介與寬鬆的行高，提升長篇文章的閱讀舒適度。
- **圖文交織**：支援多段文字與圖片交替出現，模擬真實部落格的敘事節奏。
- **動態篩選**：整合「年份」與「主題 (Topic)」雙重篩選維度，方便用戶快速定位感興趣的內容。

---

## 2. 數據結構定義 (Data Structure)

為了支援部落格風格，我們在 `types.ts` 中擴展了 `StudentWork` 與 `Project` 接口。

### StudentWork 接口擴展
```typescript
export interface StudentWork {
  // ... 其他現有屬性
  tags?: string[]; // 用於主題篩選
  blogContent?: {
    type: 'text' | 'image'; // 內容類型：純文字或圖片
    content: string;        // 文字內容或圖片 URL
    caption?: string;       // 圖片專用的說明文字 (選填)
  }[];
}
```

### Project 接口擴展
```typescript
export interface Project {
  // ... 其他現有屬性
  displayStyle: '...' | 'blog-post'; // 新增 blog-post 顯示模式
}
```

---

## 3. 屬性說明 (Attributes)

### blogContent 屬性詳細說明
`blogContent` 是一個陣列，允許開發者自由定義內容的先後順序：

| 屬性 | 類型 | 說明 |
| :--- | :--- | :--- |
| `type` | `'text' \| 'image'` | 定義該區塊是文字段落還是圖片展示。 |
| `content` | `string` | 若 type 為 `text`，此處填寫文字內容（支援 `\n` 換行）；若為 `image`，則填寫圖片 URL。 |
| `caption` | `string` | (僅限 image) 顯示在圖片下方的斜體說明文字。 |

### 篩選屬性
- **Tags (標籤)**：系統會自動抓取所有作品中的 `tags` 陣列，並在頁面頂部生成動態的「Topic」篩選選單。
- **Year (年份)**：作品的 `year` 屬性用於年份篩選。

---

## 4. 程式碼實作分析 (Code Implementation)

### 4.1 內容渲染邏輯 (BlogPost.tsx)
核心邏輯在於對 `blogContent` 陣列進行遍歷，並根據 `type` 渲染對應的 JSX。

```tsx
{/* Blog Content Sections */}
<div className="space-y-12 mb-16">
  {work.blogContent?.map((section, index) => (
    <div key={index} className="blog-section">
      {section.type === 'text' ? (
        // 文字渲染：支援 \n 換行並轉為多個 <p> 標籤
        <div className="prose prose-lg max-w-none text-black/80 leading-relaxed">
          {section.content.split('\n').map((para, i) => (
            <p key={i} className="mb-4">{para}</p>
          ))}
        </div>
      ) : (
        // 圖片渲染：包含滿版容器與 Caption
        <figure className="my-8">
          <div className="overflow-hidden bg-black/5">
            <img 
              src={section.content} 
              alt={section.caption || ""} 
              className="w-full h-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          {section.caption && (
            <figcaption className="mt-4 text-center text-sm text-black/40 font-medium italic">
              — {section.caption}
            </figcaption>
          )}
        </figure>
      )}
    </div>
  ))}
</div>
```

### 4.2 動態標籤篩選 (CourseDetailTemplate.tsx)
系統會自動提取所有作品的標籤並生成篩選選單。

```tsx
// 提取所有不重複標籤
const availableTags = useMemo(() => {
  const tags = new Set<string>();
  works.forEach(w => {
    w.tags?.forEach(tag => tags.add(tag));
  });
  return ['ALL', ...Array.from(tags).sort()];
}, [works]);

// 執行篩選邏輯
const filteredWorks = useMemo(() => {
  let result = works;
  // ... 年份篩選
  if (selectedTag !== 'ALL') {
    result = result.filter(w => w.tags?.includes(selectedTag));
  }
  // ... 推薦篩選
  return result;
}, [works, selectedYear, selectedTag, starredOnly]);
```

---

## 5. UI 組件架構 (Component Architecture)

### BlogPost.tsx
這是核心顯示組件，其結構如下：
1. **Header Image**：滿版寬螢幕比例 (21:9) 的主視覺圖。
2. **Meta Info**：顯示標籤、年份與作品類型。
3. **Title & Description**：大字體標題與帶有左側邊框的引言式簡介。
4. **Content Loop**：遍歷 `blogContent` 陣列，根據 `type` 渲染對應的文字或圖片區塊。
5. **Footer**：
   - **Contributors**：方正風格的團隊成員標籤與學號。
   - **Action Button**：直角風格的「View Full Project」外部連結按鈕。

---

## 5. 使用範例 (Usage Example)

在 `mockData.ts` 中的配置範例：

```json
{
  "id": "sw-13",
  "assignmentName": "感測器研究日誌",
  "tags": ["RESEARCH", "SENSOR"],
  "blogContent": [
    {
      "type": "text",
      "content": "這是第一段研究文字內容..."
    },
    {
      "type": "image",
      "content": "https://example.com/image.jpg",
      "caption": "這是圖片的說明文字"
    }
  ],
  "sourceDatabaseId": "db-blog"
}
```
