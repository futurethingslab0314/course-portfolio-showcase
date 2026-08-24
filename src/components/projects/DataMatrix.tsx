import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Grid, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudentWork } from '../../types';
import { memberRows } from '../../lib/memberRows';
import { cn } from '../../lib/utils';

interface DataMatrixProps {
  works: StudentWork[];
}

type ViewMode = 'coordinate' | 'categorized';

const ROW_COUNT = 16;
const COLUMN_COUNT = 30;

const getYearValue = (year?: string): number => {
  if (!year) {
    return 0;
  }
  const yearMatch = year.match(/\d{4}/);
  if (yearMatch) {
    return Number(yearMatch[0]);
  }
  const fallback = Number(year);
  return Number.isNaN(fallback) ? 0 : fallback;
};

const parseGridLocation = (gridLocation?: string): { row: number; col: number } => {
  if (!gridLocation) {
    return { row: Number.MAX_SAFE_INTEGER, col: Number.MAX_SAFE_INTEGER };
  }

  const match = gridLocation.trim().toUpperCase().match(/^([A-P])(\d{1,2})$/);
  if (!match) {
    return { row: Number.MAX_SAFE_INTEGER, col: Number.MAX_SAFE_INTEGER };
  }

  return {
    row: match[1].charCodeAt(0) - 65,
    col: Number(match[2]) - 1,
  };
};

export const DataMatrix = ({ works }: DataMatrixProps) => {
  const [selectedWork, setSelectedWork] = useState<StudentWork | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('coordinate');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    works.forEach((work) => {
      work.tags?.forEach((tag) => tagSet.add(tag));
    });
    return ['ALL', ...Array.from(tagSet).sort((a, b) => a.localeCompare(b))];
  }, [works]);

  const filteredWorks = useMemo(() => {
    if (selectedTag === 'ALL') {
      return works;
    }
    return works.filter((work) => work.tags?.includes(selectedTag));
  }, [works, selectedTag]);

  const worksByLocation = useMemo(() => {
    const locationMap = new Map<string, StudentWork[]>();
    filteredWorks.forEach((work) => {
      if (work.gridLocation) {
        const existingWorks = locationMap.get(work.gridLocation) || [];
        existingWorks.push(work);
        locationMap.set(work.gridLocation, existingWorks);
      }
    });
    locationMap.forEach((locationWorks, location) => {
      locationMap.set(
        location,
        [...locationWorks].sort((a, b) => {
          const yearDiff = getYearValue(b.year) - getYearValue(a.year);
          if (yearDiff !== 0) {
            return yearDiff;
          }
          return a.id.localeCompare(b.id);
        })
      );
    });
    return locationMap;
  }, [filteredWorks]);

  const coordinateGrid = useMemo(
    () =>
      Array.from({ length: ROW_COUNT }, (_, rowIndex) =>
        Array.from({ length: COLUMN_COUNT }, (_, colIndex) => {
          const location = `${String.fromCharCode(65 + rowIndex)}${colIndex + 1}`;
          const locationWorks = worksByLocation.get(location);
          return locationWorks?.[0];
        })
      ),
    [worksByLocation]
  );

  const categorizedWorks = useMemo(() => {
    const groups: Record<string, StudentWork[]> = {};
    filteredWorks.forEach((work) => {
      const primaryTag = work.tags?.[0] || 'Uncategorized';
      if (!groups[primaryTag]) {
        groups[primaryTag] = [];
      }
      groups[primaryTag].push(work);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, tagWorks]) => [
        tag,
        [...tagWorks].sort((a, b) => {
          const aLocation = parseGridLocation(a.gridLocation);
          const bLocation = parseGridLocation(b.gridLocation);
          const rowDiff = aLocation.row - bLocation.row;
          if (rowDiff !== 0) {
            return rowDiff;
          }
          const colDiff = aLocation.col - bLocation.col;
          if (colDiff !== 0) {
            return colDiff;
          }
          const yearDiff = getYearValue(b.year) - getYearValue(a.year);
          if (yearDiff !== 0) {
            return yearDiff;
          }
          return a.id.localeCompare(b.id);
        }),
      ]) as [string, StudentWork[]][];
  }, [filteredWorks]);

  useEffect(() => {
    if (!selectedWork) {
      return;
    }
    const stillVisible = filteredWorks.some((work) => work.id === selectedWork.id);
    if (!stillVisible) {
      setSelectedWork(null);
    }
  }, [filteredWorks, selectedWork]);

  const selectedMembers = selectedWork ? memberRows(selectedWork) : [];
  const selectedLocationWorks = useMemo(() => {
    if (!selectedWork) {
      return [];
    }
    if (!selectedWork.gridLocation) {
      return [selectedWork];
    }
    return worksByLocation.get(selectedWork.gridLocation) || [selectedWork];
  }, [selectedWork, worksByLocation]);
  const selectedLocationIndex = selectedWork
    ? Math.max(
        0,
        selectedLocationWorks.findIndex((work) => work.id === selectedWork.id)
      )
    : 0;
  const hasMultiplePages = selectedLocationWorks.length > 1;
  const canGoPrev = hasMultiplePages && selectedLocationIndex > 0;
  const canGoNext = hasMultiplePages && selectedLocationIndex < selectedLocationWorks.length - 1;

  return (
    <div className="py-12">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-4xl font-bold tracking-tighter mb-2">Data Matrix</h3>
          <p className="text-black/40 font-mono text-xs uppercase tracking-widest">Coordinate System: A-P x 1-30</p>
        </div>

        <div className="flex items-center gap-4 self-start lg:self-auto">
          <div className="flex bg-black/5 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('coordinate')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'coordinate' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black/60'
              )}
              aria-label="Coordinate view"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('categorized')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'categorized' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black/60'
              )}
              aria-label="Categorized view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-black/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-black/5" />
              <span>Empty</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-black" />
              <span>Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={cn(
                'px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] border transition-colors whitespace-nowrap',
                selectedTag === tag
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black/50 border-black/10 hover:text-black hover:border-black/30'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'coordinate' ? (
          <motion.div
            key="coordinate-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-x-auto pb-8"
          >
            <div className="inline-block min-w-full border-t border-l border-black/5">
              {coordinateGrid.map((row, rowIndex) => (
                <div key={rowIndex} className="flex">
                  <div className="w-8 h-8 flex items-center justify-center bg-black/[0.02] border-r border-b border-black/5 text-[10px] font-mono text-black/20 shrink-0">
                    {String.fromCharCode(65 + rowIndex)}
                  </div>
                  {row.map((work, colIndex) => (
                    <div
                      key={colIndex}
                      className="data-matrix-cell border-r border-b group"
                      onClick={() => work && setSelectedWork(work)}
                    >
                      {work ? (
                        <motion.div layoutId={`matrix-${work.id}`} className="relative w-full h-full">
                          <img
                            src={work.mainImage}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Plus size={12} className="text-white opacity-0 group-hover:opacity-100" />
                          </div>
                        </motion.div>
                      ) : (
                        <div className="w-full h-full bg-black/[0.01]" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex">
                <div className="w-8 h-8 shrink-0" />
                {Array.from({ length: COLUMN_COUNT }).map((_, index) => (
                  <div key={index} className="w-8 h-8 flex items-center justify-center text-[10px] font-mono text-black/20">
                    {index + 1}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="categorized-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-12"
          >
            {categorizedWorks.length > 0 ? (
              categorizedWorks.map(([tag, tagWorks]) => (
                <section key={tag} className="space-y-4">
                  <div className="border-b border-black/10 pb-3 flex items-center justify-between gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-black/70">{tag}</h4>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-black/30">
                      {tagWorks.length} works
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-4">
                    {tagWorks.map((work) => (
                      <motion.button
                        key={work.id}
                        type="button"
                        layoutId={`matrix-${work.id}`}
                        onClick={() => setSelectedWork(work)}
                        className="aspect-square relative group cursor-pointer overflow-hidden bg-black/5 text-left"
                      >
                        <img
                          src={work.mainImage}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center p-4">
                          <Plus size={20} className="text-white opacity-0 group-hover:opacity-100 mb-2" />
                          <p className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 uppercase tracking-widest text-center leading-tight">
                            {work.assignmentName}
                          </p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="py-16 text-center text-black/40 text-sm">No works found for the selected filter.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
                    <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                      Matrix Entry: {selectedWork.gridLocation || 'N/A'}
                    </span>
                    <span className="text-black/20 font-mono text-xs">{selectedWork.year || '2026'}</span>
                  </div>
                  {hasMultiplePages ? (
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        disabled={!canGoPrev}
                        onClick={() => canGoPrev && setSelectedWork(selectedLocationWorks[selectedLocationIndex - 1])}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors',
                          canGoPrev
                            ? 'border-black/20 text-black/60 hover:border-black/40 hover:text-black'
                            : 'border-black/10 text-black/20 cursor-not-allowed'
                        )}
                      >
                        <ChevronLeft size={12} />
                        Prev
                      </button>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-black/30">
                        Page {selectedLocationIndex + 1}/{selectedLocationWorks.length}
                      </span>
                      <button
                        type="button"
                        disabled={!canGoNext}
                        onClick={() => canGoNext && setSelectedWork(selectedLocationWorks[selectedLocationIndex + 1])}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors',
                          canGoNext
                            ? 'border-black/20 text-black/60 hover:border-black/40 hover:text-black'
                            : 'border-black/10 text-black/20 cursor-not-allowed'
                        )}
                      >
                        Next
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  ) : null}

                  <h2 className="text-3xl font-bold tracking-tighter mb-4">{selectedWork.assignmentName}</h2>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Description</h4>
                      <p className="text-black/70 leading-relaxed text-base">{selectedWork.description}</p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Team Members</h4>
                      <div className="space-y-2">
                        {selectedMembers.map((member, index) => (
                          <div key={`${member.name}-${index}`} className="flex justify-between items-baseline border-b border-black/5 pb-1">
                            <p className="text-sm font-medium text-black/80">{member.name}</p>
                            {member.studentId ? <p className="text-[10px] font-mono text-black/20">{member.studentId}</p> : null}
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
