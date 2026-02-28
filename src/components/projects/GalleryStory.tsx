import React from 'react';
import { ChevronDown, Plus, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';
import { memberRows } from '../../lib/memberRows';

interface GalleryStoryProps {
  work: StudentWork;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  zoomedImage: string | null;
  setZoomedImage: (img: string | null) => void;
}

export const GalleryStory = ({ work, isExpanded, setIsExpanded, zoomedImage, setZoomedImage }: GalleryStoryProps) => {
  const members = memberRows(work);
  const storyButtons = (work.storyButtons ?? []).filter((button) => button.label && button.url);

  return (
    <div className="gallery-story-container">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div
          className="aspect-[4/3] bg-black/5 rounded-lg overflow-hidden cursor-zoom-in group relative"
          onClick={() => setZoomedImage(work.mainImage)}
        >
          <img src={work.mainImage} alt={work.assignmentName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <Plus size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded">
              主題二：EVERYDAY TRACKING
            </span>
            <span className="text-black/20 font-mono text-xs uppercase tracking-widest">Class of {work.year}</span>
          </div>
          <h2 className="text-6xl font-bold tracking-tighter mb-6">{work.assignmentName}</h2>
          <p className="text-black/60 text-sm mb-8 line-clamp-3">{work.description}</p>

          <div className="mb-8">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Project Team</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {members.map((member, i) => (
                <div key={`${member.name}-${i}`} className="flex gap-2 items-baseline">
                  <span className="text-black/80 font-medium">{member.name}</span>
                  {member.studentId ? (
                    <span className="text-[10px] font-mono text-black/20">{member.studentId}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Keywords Tag</h4>
            <div className="flex gap-2">
              {work.methodologies?.map(m => (
                <span key={m} className="text-[10px] font-bold text-purple-600 bg-purple-50 px-3 py-1 uppercase tracking-wider rounded border border-purple-100">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {storyButtons.length > 0 && (
            <div className="mb-10">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Project Links</h4>
              <div className="flex flex-col gap-3">
                {storyButtons.map((button, index) => (
                  <a
                    key={`${button.label}-inline-${index}`}
                    href={button.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-4 bg-white border border-black/10 rounded-xl group hover:border-blue-600 transition-all shadow-sm hover:shadow-blue-600/10"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black group-hover:text-blue-600">{button.label}</span>
                    <ExternalLink size={14} className="text-black/20 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 text-blue-600 text-[11px] font-bold uppercase tracking-[0.2em] group"
          >
            <div className="h-[1px] w-8 bg-blue-600 group-hover:w-12 transition-all" />
            {isExpanded ? 'Collapse Case Study' : 'Expand Case Study'}
            <ChevronDown size={16} className={cn("transition-transform duration-300", isExpanded && "rotate-180")} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-16 pt-16 border-t border-black/5">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/30 mb-8">Insight & Discovery</h4>
                <p className="text-black/70 italic leading-relaxed text-sm whitespace-pre-wrap">
                  {work.description}
                </p>

                <div className="mt-12">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/30 mb-8">Contributors</h4>
                  <div className="space-y-4">
                    {members.map((member, i) => (
                      <div key={`${member.name}-expanded-${i}`} className="flex justify-between text-sm font-medium">
                        <span className="text-black/80">{member.name}</span>
                        {member.studentId ? (
                          <span className="text-black/20 font-mono">{member.studentId}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="lg:col-span-2">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/30 mb-8">Process Documentation</h4>
                <div className="grid grid-cols-2 gap-4">
                  {work.moreImages?.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setZoomedImage(img)}
                      className={cn(
                        "rounded-lg overflow-hidden bg-black/5 cursor-zoom-in group relative",
                        i === 0 && "col-span-2 aspect-video",
                        i > 0 && "aspect-square"
                      )}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Plus size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Modal for Gallery */}
      <AnimatePresence>
        {zoomedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-6xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-black"
            >
              <img
                src={zoomedImage}
                alt=""
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
