import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, Award, BookOpen, Users, Globe, ExternalLink } from 'lucide-react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';

interface ActivityEventProps {
  work: StudentWork;
}

export const ActivityEvent = ({ work }: ActivityEventProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const allImages = [work.mainImage, ...(work.moreImages || [])];

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsModalOpen(false);
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen]);

  return (
    <>
      <motion.div
        layoutId={`activity-card-${work.id}`}
        onClick={() => setIsModalOpen(true)}
        className="group cursor-pointer bg-white border border-black/5 overflow-hidden hover:shadow-xl transition-all duration-500 flex flex-col h-full rounded-xl"
      >
        <div className="aspect-video overflow-hidden relative">
          <img
            src={work.mainImage}
            alt={work.assignmentName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 left-4">
            <span className="bg-black/80 backdrop-blur-md text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-full">
              {work.themeTag || work.tags?.[0] || 'Activity'}
            </span>
          </div>
        </div>
        
        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-center gap-2 text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3">
            <Calendar size={12} />
            <span>{work.year}</span>
            <span className="mx-1">•</span>
            <MapPin size={12} />
            <span>{work.city || 'Global'}, {work.country || 'Remote'}</span>
          </div>
          
          <h3 className="text-xl font-bold tracking-tight mb-3 group-hover:text-black/60 transition-colors line-clamp-2">
            {work.assignmentName}
          </h3>
          
          <p className="text-sm text-black/50 line-clamp-3 font-medium leading-relaxed mb-6 flex-grow">
            {work.description}
          </p>
          
          <div className="pt-4 border-t border-black/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center">
                <Award size={12} className="text-black/40" />
              </div>
              <span className="text-[10px] font-bold text-black/60 uppercase tracking-widest truncate max-w-[150px]">
                {work.grant || 'Self-funded'}
              </span>
            </div>
            <div className="text-[10px] font-bold text-black/30 uppercase tracking-[0.2em]">
              View Details
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />

            <motion.div
              layoutId={`activity-card-${work.id}`}
              className="relative w-full max-w-6xl max-h-[90vh] bg-white overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-2xl"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 z-50 p-2 bg-black/5 hover:bg-black/10 text-black rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              {/* Left Side: Media Gallery */}
              <div className="w-full md:w-3/5 h-[40vh] md:h-auto relative bg-neutral-100 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImageIndex}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    src={allImages[currentImageIndex]}
                    alt={`${work.assignmentName} - ${currentImageIndex}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {allImages.length > 1 && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                    <button
                      onClick={prevImage}
                      className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/20"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/20"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                      {allImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex(idx);
                          }}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            idx === currentImageIndex ? "bg-white w-8" : "bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Right Side: Event Details */}
              <div className="w-full md:w-2/5 overflow-y-auto p-8 md:p-12 bg-white">
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-black text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-[0.2em] rounded-full">
                      {work.themeTag || work.tags?.[0]}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">
                      {work.year}
                    </span>
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-6 leading-tight">
                    {work.assignmentName}
                  </h2>

                  <div className="space-y-4 mb-8">
                    {(work.startDate || work.endDate) && (
                      <div className="flex items-center gap-3 text-black/60">
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                          <Calendar size={14} />
                        </div>
                        <span className="text-sm font-semibold">
                          {work.startDate} {work.endDate ? `— ${work.endDate}` : ''}
                        </span>
                      </div>
                    )}
                    {(work.city || work.country) && (
                      <div className="flex items-center gap-3 text-black/60">
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                          <Globe size={14} />
                        </div>
                        <span className="text-sm font-semibold">
                          {work.city}{work.city && work.country ? ', ' : ''}{work.country}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-black/60 leading-relaxed font-medium text-base">
                    {work.description}
                  </p>
                </div>

                <div className="space-y-8 border-t border-black/5 pt-10">
                  {/* Grant Info */}
                  {work.grant && (
                    <div className="flex gap-5">
                      <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-black/5 flex items-center justify-center shrink-0">
                        <Award size={20} className="text-black/40" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1.5">Grant / Sponsor</h4>
                        <p className="text-sm font-bold text-black/80">{work.grant}</p>
                      </div>
                    </div>
                  )}

                  {/* Publication Info */}
                  {work.publicationName && (
                    <div className="flex gap-5">
                      <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-black/5 flex items-center justify-center shrink-0">
                        <BookOpen size={20} className="text-black/40" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1.5">Publication</h4>
                        <p className="text-sm font-bold text-black/80">{work.publicationName}</p>
                      </div>
                    </div>
                  )}

                  {/* Members / Authors */}
                  {work.members && work.members.length > 0 && (
                    <div className="flex gap-5">
                      <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-black/5 flex items-center justify-center shrink-0">
                        <Users size={20} className="text-black/40" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1.5">Members / Authors</h4>
                        <div className="flex flex-wrap gap-2">
                          {work.members.map(member => (
                            <span key={member} className="text-xs font-bold text-black/70 bg-black/5 px-3 py-1 rounded-md">
                              {member}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* External Link */}
                  {work.url && (
                    <a 
                      href={work.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 w-full py-4 bg-black text-white rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-black/80 transition-all group"
                    >
                      Visit Project
                      <ExternalLink size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
