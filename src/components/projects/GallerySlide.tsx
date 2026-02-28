import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';
import { memberRows } from '../../lib/memberRows';

interface GallerySlideProps {
  work: StudentWork;
}

export const GallerySlide = ({ work }: GallerySlideProps) => {
  const allImages = [work.mainImage, ...(work.moreImages || [])];
  const members = memberRows(work);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % allImages.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + allImages.length) % allImages.length);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      prevSlide();
    }
  };

  return (
    <div className="gallery-slide-container" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        {/* Left Side: Content */}
        <div className="lg:col-span-5">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-600">Visual Narrative</h4>
              <span className="text-black/20 font-mono text-xs tracking-widest">/ {work.year || '2026'}</span>
            </div>
            <h2 className="text-6xl font-bold tracking-tighter mb-8 leading-[0.9]">{work.assignmentName}</h2>
            <p className="text-xl text-black/60 leading-relaxed font-serif italic mb-12">{work.description}</p>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-6">Project Contributors</h4>
              <div className="space-y-3">
                {members.map((member, i) => (
                  <div key={`${member.name}-${i}`} className="flex justify-between items-baseline border-b border-black/5 pb-2">
                    <span className="text-lg font-medium text-black/80">{member.name}</span>
                    {member.studentId ? (
                      <span className="text-xs font-mono text-black/30">{member.studentId}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Slider */}
        <div className="lg:col-span-7 relative group">
          <div 
            className="aspect-[4/3] rounded-3xl overflow-hidden bg-black/5 shadow-2xl cursor-zoom-in"
            onClick={() => setIsZoomed(true)}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={currentSlide}
                src={allImages[currentSlide]}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </AnimatePresence>
          </div>

          {/* Slider Controls */}
          {allImages.length > 1 && (
            <>
              <div className="absolute inset-y-0 left-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                  className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white transition-all"
                >
                  <ChevronLeft size={24} />
                </button>
              </div>
              <div className="absolute inset-y-0 right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                  className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-white transition-all"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
              
              {/* Indicators */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      currentSlide === i ? "w-8 bg-white" : "w-2 bg-white/40"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsZoomed(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-6xl aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl"
            >
              <img 
                src={allImages[currentSlide]} 
                alt="" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
              <button 
                onClick={() => setIsZoomed(false)}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors"
              >
                <X size={24} />
              </button>

              {/* Modal Controls */}
              {allImages.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center transition-all"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center transition-all"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
