import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StudentWork } from '../../types';
import { ActivityEventCardContent, ActivityEventDetailContent } from './ActivityEventContent';

interface ActivityEventProps {
  work: StudentWork;
  initialModalOpen?: boolean;
}

export function ActivityEvent({ work, initialModalOpen = false }: ActivityEventProps) {
  const [isModalOpen, setIsModalOpen] = useState(initialModalOpen);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const allImages = [work.mainImage, ...(work.moreImages || [])].filter(Boolean);

  useEffect(() => {
    if (!isModalOpen) {
      document.body.style.overflow = 'unset';
      return undefined;
    }

    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
      if (event.key === 'ArrowRight' && allImages.length > 1) {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
      }
      if (event.key === 'ArrowLeft' && allImages.length > 1) {
        setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allImages.length, isModalOpen]);

  return (
    <>
      <motion.div
        layoutId={`activity-card-${work.id}`}
        onClick={() => setIsModalOpen(true)}
        className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-black/5 bg-white transition-all duration-500 hover:shadow-xl"
      >
        <ActivityEventCardContent work={work} />
      </motion.div>

      <AnimatePresence>
        {isModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div layoutId={`activity-card-${work.id}`}>
              <ActivityEventDetailContent
                work={work}
                currentImageIndex={currentImageIndex}
                setCurrentImageIndex={setCurrentImageIndex}
                onClose={() => setIsModalOpen(false)}
              />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
