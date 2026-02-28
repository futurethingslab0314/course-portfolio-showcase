import React from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';
import { TechnicalDataCard } from '../TechnicalDataCard';
import { memberRows } from '../../lib/memberRows';

interface CardSpecProps {
  work: StudentWork;
  zoomedImage: string | null;
  setZoomedImage: (img: string | null) => void;
}

export const CardSpec = ({ work, zoomedImage, setZoomedImage }: CardSpecProps) => {
  const specCards = (work.dataSpecs ?? []).filter((card) => Boolean(card?.trim()));
  const members = memberRows(work);

  return (
    <div className="card-spec-grid">
      <div 
        className="relative aspect-square overflow-hidden rounded-lg cursor-zoom-in group"
        onClick={() => setZoomedImage(work.mainImage)}
      >
        <img src={work.mainImage} alt={work.assignmentName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="text-white" size={24} />
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-4 mb-4">
          <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
            {work.assignmentName}
          </span>
          <span className="text-black/20 font-mono text-xs">{work.year}</span>
        </div>
        <h2 className="text-5xl font-bold tracking-tighter mb-4">{work.assignmentName.split('：')[1] || work.assignmentName}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-8">
          {members.map((member, i) => (
            <div key={`${member.name}-${i}`} className="flex gap-2 items-baseline">
              <span className="text-black/80 text-sm font-medium">{member.name}</span>
              {member.studentId ? (
                <span className="text-[10px] font-mono text-black/20">{member.studentId}</span>
              ) : null}
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mb-12">
          {work.tags?.map(tag => (
            <span key={tag} className="text-[10px] font-bold text-cyan-500 border border-cyan-500/30 px-2 py-1 uppercase tracking-wider rounded">
              {tag}
            </span>
          ))}
        </div>

        <div className="mb-12">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Project Overview</h4>
          <p className="text-black/70 leading-relaxed">{work.description}</p>
        </div>

        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-6">Interactive Data Card Spec</h4>
          <div className="grid grid-cols-1 gap-4">
            {specCards.length ? (
              specCards.map((card, index) => (
                <div key={`${work.id}-spec-card-${index}`}>
                  <TechnicalDataCard content={card} />
                </div>
              ))
            ) : (
              <TechnicalDataCard content="No spec cards found." />
            )}
          </div>
        </div>
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomedImage === work.mainImage && (
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
              className="relative w-full max-w-5xl aspect-square rounded-2xl overflow-hidden shadow-2xl"
            >
              <img 
                src={work.mainImage} 
                alt="" 
                className="w-full h-full object-cover" 
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
