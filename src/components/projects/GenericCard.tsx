import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';
import { memberRows } from '../../lib/memberRows';

interface GenericCardProps {
  work: StudentWork;
}

export const GenericCard = ({ work }: GenericCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const members = memberRows(work);

  const images = useMemo(() => {
    const merged = [work.mainImage, ...(work.moreImages ?? [])].filter(Boolean);
    return [...new Set(merged)];
  }, [work.mainImage, work.moreImages]);

  const hasMultipleImages = images.length > 1;

  const openModal = () => {
    setCurrentImageIndex(0);
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const nextImage = useCallback(() => {
    if (!images.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (!images.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (!hasMultipleImages) return;
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, hasMultipleImages, closeModal, nextImage, prevImage]);

  const yearLabel = work.year || 'TBD';
  const memberLabel = members.length ? members.map((m) => m.name).join(', ') : 'Unassigned';

  return (
    <>
      <div onClick={openModal} className="generic-card-container group">
        <div className="aspect-square overflow-hidden relative">
          <img
            src={work.mainImage}
            alt={work.assignmentName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 p-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform">
              <Plus size={20} className="text-black" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg mb-1">{work.assignmentName}</h3>
          <p className="text-xs text-black/40 font-medium mb-3">{memberLabel}</p>
          <p className="text-sm text-black/60 line-clamp-2">{work.description}</p>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-8">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close modal"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-6xl bg-white md:rounded-3xl overflow-hidden shadow-2xl h-full md:h-auto max-h-screen md:max-h-[92vh] flex flex-col"
              tabIndex={0}
              role="dialog"
              aria-modal="true"
              aria-label={work.assignmentName}
            >
              <button
                onClick={closeModal}
                className="absolute top-6 right-6 z-[110] p-3 bg-black/50 text-white backdrop-blur-md rounded-full hover:bg-black/60 transition-colors"
                aria-label="Close"
              >
                <X size={22} />
              </button>

              <div className="overflow-y-auto">
                <div className="relative w-full bg-black flex items-center justify-center group/slider overflow-hidden">
                  <div className="w-full aspect-video md:aspect-[21/9] relative">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={images[currentImageIndex] || work.mainImage}
                        src={images[currentImageIndex] || work.mainImage}
                        alt={`${work.assignmentName} - image ${currentImageIndex + 1}`}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                  </div>

                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-3 md:left-6 z-20 p-2 md:p-3 rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={28} />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-3 md:right-6 z-20 p-2 md:p-3 rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight size={28} />
                      </button>

                      <div className="absolute bottom-5 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 md:gap-3 z-20">
                        {images.map((_, i) => {
                          const active = i === currentImageIndex;
                          return (
                            <button
                              key={`dot-${i}`}
                              onClick={() => setCurrentImageIndex(i)}
                              className={active ? 'h-1.5 rounded-full bg-white w-10 transition-all' : 'h-1.5 rounded-full bg-white/35 w-2 hover:bg-white/55 transition-all'}
                              aria-label={`Go to image ${i + 1}`}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="p-8 md:p-16">
                  <div className="flex items-center gap-4 mb-8">
                    <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                      Quick Prototype
                    </span>
                    <span className="text-black/30 font-mono text-xs">{yearLabel}</span>
                    {work.tags && work.tags.length > 0 && (
                      <span className="text-black/40 text-xs">{work.tags.join(' · ')}</span>
                    )}
                  </div>

                  <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-10 leading-[0.92]">{work.assignmentName}</h2>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    <div className="lg:col-span-8">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Description</h4>
                      <p className="text-black/70 leading-relaxed text-lg">{work.description || 'No description provided.'}</p>
                    </div>

                    <div className="lg:col-span-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Team Members</h4>
                      <div className="space-y-3">
                        {members.length > 0 ? (
                          members.map((member, i) => (
                            <div key={`${member.name}-${i}`} className="flex justify-between items-baseline border-b border-black/5 pb-1.5">
                              <p className="text-sm font-medium text-black/80">{member.name}</p>
                              {member.studentId ? <p className="text-[10px] font-mono text-black/25">{member.studentId}</p> : null}
                            </div>
                          ))
                        ) : (
                          <div className="border-b border-black/5 pb-1.5">
                            <p className="text-sm font-medium text-black/55">Unassigned</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
