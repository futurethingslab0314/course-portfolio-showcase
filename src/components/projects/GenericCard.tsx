import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';

interface GenericCardProps {
  work: StudentWork;
}

export const GenericCard = ({ work }: GenericCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="generic-card-container group"
      >
        <div className="aspect-square overflow-hidden relative">
          <img src={work.mainImage} alt={work.assignmentName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 p-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform">
              <Plus size={20} className="text-black" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg mb-1">{work.assignmentName}</h3>
          <p className="text-xs text-black/40 font-medium mb-3">{work.members.join(', ')}</p>
          <p className="text-sm text-black/60 line-clamp-2">{work.description}</p>
        </div>
      </div>
      
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full hover:bg-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="overflow-y-auto">
                <div className="aspect-square w-full max-w-2xl mx-auto bg-black/5">
                  <img src={work.mainImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                      Quick Prototype
                    </span>
                    <span className="text-black/20 font-mono text-xs">{work.year || '2026'}</span>
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6">{work.assignmentName}</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="md:col-span-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Description</h4>
                      <p className="text-black/70 leading-relaxed text-lg">{work.description}</p>
                      
                      {work.moreImages && work.moreImages.length > 0 && (
                        <div className="mt-12 space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Gallery</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {work.moreImages.map((img, i) => (
                              <img key={i} src={img} alt="" className="rounded-lg w-full aspect-square object-cover" referrerPolicy="no-referrer" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-4">Team Members</h4>
                        <div className="space-y-3">
                          {work.members.map((m, i) => (
                            <div key={m} className="flex justify-between items-baseline border-b border-black/5 pb-1">
                              <p className="text-sm font-medium text-black/80">{m}</p>
                              <p className="text-[10px] font-mono text-black/20">M1121011{i}</p>
                            </div>
                          ))}
                        </div>
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
