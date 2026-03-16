# Data Matrix 修正案 (Data Matrix Amendment)

本文件紀錄了 Data Matrix 組件的重大更新，包含功能增強、版面調整及程式碼實作細節。

---

## 1. 重大功能更新 (Major Features)

### A. 雙模式視圖切換 (Dual View Mode)
新增了 `viewMode` 狀態，允許使用者在兩種不同的邏輯下瀏覽作品：
- **座標模式 (Coordinate Mode)**：維持原始的 16x30 網格，精確對應 `gridLocation` (A1-P30)。
- **分類模式 (Categorized Mode)**：根據作品的 **主題標籤 (Theme Tags)** 進行分組排列。

### B. 主題標籤篩選器 (Theme Filter)
在矩陣上方新增了動態篩選列：
- 自動從數據中提取所有不重複的 `tags`。
- 支援「全選 (ALL)」與單一主題篩選。
- 篩選結果會同步套用於兩種視圖模式。

---

## 2. 版面與風格設計 (Layout & Style)

### A. 分類網格設計
- **標題區隔**：每個主題區塊上方設有大寫、寬間距的標題，並配有細線裝飾與數量統計。
- **縮圖放大**：相較於座標網格的固定小尺寸，分類模式下的縮圖採用響應式網格（`grid-cols-2` 到 `lg:grid-cols-8`），視覺衝擊力更強。
- **懸停效果**：懸停時會顯示黑色半透明遮罩、加號圖示及作品名稱。

### B. 動態過渡動畫
- 使用 `framer-motion` 的 `layoutId` 功能，確保在切換視圖或篩選標籤時，作品方塊能以平滑的物理動畫移動，而非瞬間跳變。

---

## 3. 核心程式碼實作 (Core Implementation)

### A. 數據分類邏輯 (Categorization Logic)
```typescript
const categorizedWorks = useMemo(() => {
  const groups: Record<string, StudentWork[]> = {};
  filteredWorks.forEach(work => {
    // 以第一個標籤作為主要分類依據
    const primaryTag = work.tags?.[0] || 'Uncategorized';
    if (!groups[primaryTag]) groups[primaryTag] = [];
    groups[primaryTag].push(work);
  });
  return groups;
}, [filteredWorks]);
```

### B. 視圖切換組件 (View Toggle UI)
```tsx
<div className="flex bg-black/5 p-1 rounded-lg">
  <button 
    onClick={() => setViewMode('coordinate')}
    className={cn(
      "p-1.5 rounded-md transition-all",
      viewMode === 'coordinate' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black/60"
    )}
  >
    <Grid size={16} />
  </button>
  <button 
    onClick={() => setViewMode('categorized')}
    className={cn(
      "p-1.5 rounded-md transition-all",
      viewMode === 'categorized' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black/60"
    )}
  >
    <LayoutGrid size={16} />
  </button>
</div>
```

### C. 分類網格渲染 (Categorized Grid Rendering)
```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
  {works.map(work => (
    <motion.div
      key={work.id}
      layoutId={`matrix-${work.id}`}
      className="aspect-square relative group cursor-pointer overflow-hidden bg-black/5"
      onClick={() => setSelectedWork(work)}
    >
      <img src={work.mainImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center p-4">
        <Plus size={20} className="text-white opacity-0 group-hover:opacity-100 mb-2" />
        <p className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 uppercase tracking-widest">
          {work.assignmentName}
        </p>
      </div>
    </motion.div>
  ))}
</div>
```

---

## 4. 數據結構調整 (Data Structure Adjustments)

為了支援上述功能，`STUDENT_WORKS` 中的矩陣作品已補充以下屬性：
- `tags`: 陣列，用於主題分類與篩選。
- `gridLocation`: 保持不變，用於座標模式定位。

---
*文件更新日期：2026-03-04*
