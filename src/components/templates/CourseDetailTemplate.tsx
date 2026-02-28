import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Course, Project, StudentWork } from '../../types';
import { cn } from '../../lib/utils';
import { DataMatrix } from '../projects/DataMatrix';
import { Header } from '../Header';
import { Footer } from '../Footer';
import { Filter, Star, ChevronDown, Menu, X as CloseIcon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

interface CourseDetailTemplateProps {
  course: Course;
  projects: Project[];
  activeProjectId: string | undefined;
  setActiveProjectId: (id: string) => void;
  works: StudentWork[];
  StudentWorkItem: React.ComponentType<{ work: StudentWork; style: Project['displayStyle'] }>;
  onSyncData?: () => void;
  isSyncing?: boolean;
}

export const CourseDetailTemplate = ({ 
  course, 
  projects, 
  activeProjectId, 
  setActiveProjectId, 
  works, 
  StudentWorkItem,
  onSyncData,
  isSyncing,
}: CourseDetailTemplateProps) => {
  const activeProject = projects.find(p => p.id === activeProjectId);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [starredOnly, setStarredOnly] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set(works.map(w => w.year).filter(Boolean));
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [works]);

  const filteredWorks = useMemo(() => {
    let result = works;
    if (selectedYear !== 'ALL') {
      result = result.filter(w => w.year === selectedYear);
    }
    if (starredOnly) {
      result = result.filter(w => w.isStarred);
    }
    return result;
  }, [works, selectedYear, starredOnly]);

  return (
    <div className="min-h-screen bg-white">
      <Header 
        title={course.courseName} 
        titleLink={`/course/${course.slug || course.id}`}
        showBackButton={true} 
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMenuOpen={isMobileMenuOpen}
        onSyncData={onSyncData}
        isSyncing={isSyncing}
      />
      
      {/* Sticky Tabs - Positioned right below Header */}
      <div className={cn(
        "sticky top-[124px] md:top-[73px] z-50 bg-white/80 backdrop-blur-xl border-b border-black/5",
        !isMobileMenuOpen && "hidden md:block"
      )}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Desktop Tabs */}
          <div className="hidden md:flex gap-12 overflow-x-auto no-scrollbar py-6">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setSelectedYear('ALL'); // Reset filter when switching projects
                  setStarredOnly(false);
                }}
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.3em] whitespace-nowrap transition-all relative py-2",
                  activeProjectId === project.id ? "text-black" : "text-black/30 hover:text-black/50"
                )}
              >
                {project.tabName}
                {activeProjectId === project.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-black"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Menu List */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-black/5 overflow-hidden"
            >
              <div className="px-6 py-4 space-y-1">
                {projects.map((project, index) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setActiveProjectId(project.id);
                      setSelectedYear('ALL');
                      setStarredOnly(false);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full text-left py-4 px-4 rounded-xl transition-all flex items-center justify-between",
                      activeProjectId === project.id 
                        ? "bg-black text-white" 
                        : "text-black/40 hover:bg-black/5"
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                      {project.tabName}
                    </span>
                    <span className="text-[10px] font-mono opacity-40">
                      0{index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">{activeProject?.projectName}</h2>
            <p className="text-black/50 max-w-2xl font-medium text-base md:text-lg">{activeProject?.projectDescription}</p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-black/20">
            Showing {filteredWorks.length} works
          </div>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 mb-12 py-6 border-y border-black/5">
          <div className="flex items-center justify-between md:justify-start gap-6">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
              <Filter size={12} />
              <span>Filter by Year</span>
            </div>
            <div className="relative group">
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[120px]"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
              <Star size={12} />
              <span>Recommendation</span>
            </div>
            <div className="relative group">
              <select 
                value={starredOnly ? 'STARRED' : 'ALL'}
                onChange={(e) => setStarredOnly(e.target.value === 'STARRED')}
                className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[160px]"
              >
                <option value="ALL">All Works</option>
                <option value="STARRED">★ Recommended Only</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
            </div>
          </div>
        </div>

        {activeProject?.displayStyle === 'data-matrix' ? (
          <DataMatrix works={filteredWorks} />
        ) : (
          <div className={cn(
            "grid gap-12",
            activeProject?.displayStyle === 'generic-card' || activeProject?.displayStyle === 'blog-post'
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              : "grid-cols-1"
          )}>
            {filteredWorks.map(work => (
              <StudentWorkItem 
                key={work.id} 
                work={work} 
                style={activeProject?.displayStyle || 'generic-card'} 
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};
