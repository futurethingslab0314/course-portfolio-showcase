import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';

interface CardCaseProps {
  work: StudentWork;
  isPrintMode?: boolean;
}

const fallbackGradients = [
  'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
  'linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #4338ca 0%, #22c55e 100%)',
  'linear-gradient(135deg, #d97706 0%, #facc15 100%)',
  'linear-gradient(135deg, #1d4ed8 0%, #a855f7 100%)',
];

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function fallbackBackgroundForWork(work: StudentWork): string {
  const seed = `${work.group || ''}:${work.assignmentName}:${work.id}`;
  return fallbackGradients[hashString(seed) % fallbackGradients.length];
}

export const CardCase = ({ work, isPrintMode = false }: CardCaseProps) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const hasMainImage = Boolean(work.mainImage);
  const hasInteractionPart = Boolean(work.interactionPart);
  const hasTargetUser = Boolean(work.targetUser?.trim());
  const hasDesignTeam = Boolean(work.designTeam?.trim());
  const hasFoundBy = Boolean(work.foundBy?.trim());
  const hasTopMeta = hasInteractionPart || hasTargetUser;

  useEffect(() => {
    if (!isImageModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isImageModalOpen]);

  return (
    <>
      <motion.button
        type="button"
        layout
        onClick={() => {
          if (!isPrintMode && hasMainImage) {
            setIsImageModalOpen(true);
          }
        }}
        className={cn(
          'relative flex flex-col overflow-hidden group border border-black/5 text-left',
          isPrintMode ? 'w-full h-full' : 'aspect-[3/4] shadow-sm hover:shadow-xl transition-all duration-500',
          !isPrintMode && hasMainImage && 'cursor-zoom-in',
        )}
        style={{
          fontSize: isPrintMode ? '9pt' : 'inherit',
        }}
      >
        <div className="absolute inset-0 z-0">
          {hasMainImage ? (
            <img
              src={work.mainImage}
              alt={work.assignmentName}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full" style={{ background: fallbackBackgroundForWork(work) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
        </div>

        <div className="relative z-20 flex flex-col h-full p-5 text-white">
          {hasTopMeta ? (
            <div className="flex items-start gap-3 mb-auto">
              {hasInteractionPart ? (
                <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0 bg-white/10 backdrop-blur-md overflow-hidden">
                  <img src={work.interactionPart} alt="Body part icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-12 h-12 shrink-0" />
              )}
              {hasTargetUser ? (
                <div className="flex flex-col pt-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 leading-none mb-1">Target User</span>
                  <span className="text-[11px] font-bold leading-tight">{work.targetUser}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mb-auto" />
          )}

          <div className="space-y-2">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold leading-tight mb-1 group-hover:text-white transition-colors">
                {work.assignmentName}
              </h3>
              {(work.year || hasDesignTeam) && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
                  {work.year ? <span>{work.year}</span> : null}
                  {work.year && hasDesignTeam ? <span className="w-1 h-1 rounded-full bg-white/30" /> : null}
                  {hasDesignTeam ? <span>{work.designTeam}</span> : null}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="flex flex-wrap gap-1.5">
                {(work.tags || []).map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="px-2 py-0.5 bg-white/10 backdrop-blur-md border border-white/10 rounded text-[9px] font-bold uppercase tracking-wider"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {hasFoundBy && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Found By</span>
                <span className="text-[10px] font-bold text-white/80">{work.foundBy}</span>
              </div>
            )}
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {isImageModalOpen && hasMainImage && !isPrintMode && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImageModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              aria-label="Close image preview"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="absolute top-4 right-4 z-20 rounded-full bg-white/90 p-2 text-black shadow-lg hover:bg-white"
                aria-label="Close image preview"
              >
                <X size={18} />
              </button>
              <div className="bg-black">
                <img
                  src={work.mainImage}
                  alt={work.assignmentName}
                  className="max-h-[90vh] w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
