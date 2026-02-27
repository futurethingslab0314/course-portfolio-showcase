import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';

interface DataMatrixProps {
  works: StudentWork[];
}

export const DataMatrix = ({ works }: DataMatrixProps) => {
  const [selectedWork, setSelectedWork] = useState<StudentWork | null>(null);

  const grid = Array.from({ length: 16 }, (_, r) => 
    Array.from({ length: 30 }, (_, c) => {
      const location = `${String.fromCharCode(65 + r)}${c + 1}`;
      return works.find(w => w.gridLocation === location);
    })
  );

  return (
    <div className="py-12">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h3 className="text-4xl font-bold tracking-tighter mb-2">Data Matrix</h3>
          <p className="text-black/40 font-mono text-xs uppercase tracking-widest">Coordinate System: A-P x 1-30</p>
        </div>
        <div className="flex gap-8 text-[10px] font-bold uppercase tracking-widest text-black/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-black/5" />
            <span>Empty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600" />
            <span>Active</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-8">
        <div className="inline-block min-w-full border-t border-l border-black/5">
          {grid.map((row, r) => (
            <div key={r} className="flex">
              <div className="w-8 h-8 flex items-center justify-center bg-black/[0.02] border-r border-b border-black/5 text-[10px] font-mono text-black/20 shrink-0">
                {String.fromCharCode(65 + r)}
              </div>
              {row.map((work, c) => (
                <div 
                  key={c} 
                  className="data-matrix-cell border-r border-b group"
                  onClick={() => work && setSelectedWork(work)}
                >
                  {work ? (
                    <>
                      <img src={work.mainImage} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/20 transition-colors flex items-center justify-center">
                        <Plus size={12} className="text-white opacity-0 group-hover:opacity-100" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-black/[0.01]" />
                  )}
                </div>
              ))}
            </div>
          ))}
          <div className="flex">
            <div className="w-8 h-8 shrink-0" />
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-8 h-8 flex items-center justify-center text-[10px] font-mono text-black/20">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedWork && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWork(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <button 
                onClick={() => setSelectedWork(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full hover:bg-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="overflow-y-auto">
                <div className="aspect-square w-full bg-black/5">
                  <img src={selectedWork.mainImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                      Matrix Entry: {selectedWork.gridLocation}
                    </span>
                    <span className="text-black/20 font-mono text-xs">{selectedWork.year || '2026'}</span>
                  </div>
                  
                  <h2 className="text-3xl font-bold tracking-tighter mb-4">{selectedWork.assignmentName}</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Description</h4>
                      <p className="text-black/70 leading-relaxed text-base">{selectedWork.description}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Team Members</h4>
                      <div className="space-y-2">
                        {selectedWork.members.map((m, i) => (
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
