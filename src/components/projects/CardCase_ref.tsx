import React from 'react';
import { motion } from 'motion/react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';

interface CardCaseProps {
  work: StudentWork;
  isPrintMode?: boolean;
}

export const CardCase = ({ work, isPrintMode = false }: CardCaseProps) => {
  return (
    <motion.div
      layout
      className={cn(
        "relative flex flex-col overflow-hidden group border border-black/5",
        isPrintMode ? "w-full h-full" : "aspect-[3/4] shadow-sm hover:shadow-xl transition-all duration-500"
      )}
      style={{
        fontSize: isPrintMode ? '9pt' : 'inherit'
      }}
    >
      {/* Full-bleed Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={work.mainImage}
          alt={work.assignmentName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        {/* Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-20 flex flex-col h-full p-5 text-white">
        {/* Top Section: Interaction & Target User */}
        <div className="flex items-start gap-3 mb-auto">
          <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0 bg-white/10 backdrop-blur-md overflow-hidden">
            {work.interactionPart ? (
              <img src={work.interactionPart} alt="Interaction" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>
          <div className="flex flex-col pt-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 leading-none mb-1">Target User</span>
            <span className="text-[11px] font-bold leading-tight">{work.targetUser || 'N/A'}</span>
          </div>
        </div>

        {/* Bottom Section: Details */}
        <div className="space-y-2">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold leading-tight mb-1 group-hover:text-white transition-colors">
              {work.assignmentName}
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
              <span>{work.year}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>{work.designTeam || 'N/A'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {(work.tags || []).map((tag, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-white/10 backdrop-blur-md border border-white/10 rounded text-[9px] font-bold uppercase tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {work.foundBy && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Found By</span>
              <span className="text-[10px] font-bold text-white/80">{work.foundBy}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
