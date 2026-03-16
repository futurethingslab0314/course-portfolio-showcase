# GenericCard.tsx 改動說明文件

本文檔記錄了 `GenericCard.tsx` 組件的重大更新，主要包含 **幻燈片功能 (Image Slider)**、**滿版視覺設計 (Full-Width Layout)** 以及 **交互體驗優化**。

---

## 1. 幻燈片邏輯與狀態管理 (Slider Logic)

我們引入了狀態管理來處理多張圖片的切換，並整合了主圖與更多圖片。

### 關鍵程式碼：
```tsx
// 狀態與圖片陣列整合
const [currentImageIndex, setCurrentImageIndex] = useState(0);
const images = [work.mainImage, ...(work.moreImages || [])];

// 切換邏輯
const nextImage = (e: React.MouseEvent) => {
  e.stopPropagation();
  setCurrentImageIndex((prev) => (prev + 1) % images.length);
};

const prevImage = (e: React.MouseEvent) => {
  e.stopPropagation();
  setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
};

// 鍵盤支援 (左右鍵切換, Esc 關閉)
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowRight') nextImage(e as any);
  if (e.key === 'ArrowLeft') prevImage(e as any);
  if (e.key === 'Escape') setIsModalOpen(false);
};
```

---

## 2. 滿版視覺設計 (Full-Width Visuals)

將原本的固定比例圖片改為寬螢幕比例（21:9）並設為滿版，提升沉浸感。

### 關鍵程式碼：
```tsx
{/* 滿版幻燈片區塊 */}
<div className="relative w-full bg-black flex items-center justify-center group/slider overflow-hidden">
  <div className="w-full aspect-video md:aspect-[21/9] relative">
    <AnimatePresence mode="wait">
      <motion.img
        key={currentImageIndex}
        src={images[currentImageIndex]}
        initial={{ opacity: 0, scale: 1.1 }} // 進場動畫：縮放 + 淡入
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full h-full object-cover" // 滿版填滿
        referrerPolicy="no-referrer"
      />
    </AnimatePresence>
  </div>

  {/* 左右切換按鈕 (滑鼠移入時顯示) */}
  {images.length > 1 && (
    <>
      <button onClick={prevImage} className="absolute left-6 ...">
        <ChevronLeft size={32} />
      </button>
      <button onClick={nextImage} className="absolute right-6 ...">
        <ChevronRight size={32} />
      </button>
      
      {/* 底部圓點指示器 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
        {images.map((_, i) => (
          <button key={i} className={`h-1.5 rounded-full ... ${i === currentImageIndex ? 'bg-white w-10' : 'bg-white/30 w-2'}`} />
        ))}
      </div>
    </>
  )}
</div>
```

---

## 3. 彈窗容器與排版優化 (Modal & Typography)

優化了彈窗的尺寸、背景質感以及文字的層次感。

### 關鍵程式碼：
```tsx
// 彈窗容器調整
<motion.div 
  className="relative w-full max-w-6xl bg-white md:rounded-3xl overflow-hidden shadow-2xl h-full md:h-auto max-h-screen md:max-h-[92vh] flex flex-col"
>
  {/* 關閉按鈕改為半透明黑色背景 */}
  <button className="absolute top-6 right-6 z-[110] p-3 bg-black/50 text-white backdrop-blur-md rounded-full ...">
    <X size={24} />
  </button>

// 文字排版升級
<div className="p-8 md:p-16">
  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-10 leading-[0.9]">
    {work.assignmentName}
  </h2>
  
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
    <div className="lg:col-span-8"> {/* 描述佔據左側 8 欄 */}
      <p className="text-xl font-medium text-black/70">{work.description}</p>
    </div>
    <div className="lg:col-span-4"> {/* 成員資訊佔據右側 4 欄 */}
      {/* Collaborators 列表 */}
    </div>
  </div>
</div>
```

---

## 4. 其他改動

- **數據更新**：在 `mockData.ts` 中為 "Quick Prototypes" 的作品增加了 `moreImages` 測試數據。
- **交互細節**：增加了 `tabIndex={0}` 與 `onKeyDown` 事件，讓用戶可以使用鍵盤操作。
- **性能優化**：使用 `AnimatePresence` 的 `mode="wait"` 確保圖片切換時動畫流暢。
