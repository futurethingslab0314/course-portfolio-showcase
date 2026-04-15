import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Project, StudentWork } from '../../types';
import { cn } from '../../lib/utils';
import { DataMatrix } from '../projects/DataMatrix';
import { Header } from '../Header';
import { Footer } from '../Footer';
import { Filter, Star, ChevronDown, Download } from 'lucide-react';
import { collectKeywordTags, collectThemeTags, filterAndSortWorksForDisplay } from './courseDetailViewModel';
import { buildCardCasePrintHtml, collectCardCaseMemberNames, filterCardCaseWorksByStudent, getCardCaseAvailableYears, getCardCaseStudentLabel } from './cardCaseUtils';

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

const groupCardGradients = [
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

function groupCardBackground(group: string): string {
  return groupCardGradients[hashString(group) % groupCardGradients.length];
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
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [starredOnly, setStarredOnly] = useState<boolean>(false);
  const [selectedThemeTag, setSelectedThemeTag] = useState<string>('ALL');
  const [selectedKeywordTag, setSelectedKeywordTag] = useState<string>('ALL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCardCaseGroup, setSelectedCardCaseGroup] = useState<string | undefined>(undefined);
  const [selectedCardCaseStudent, setSelectedCardCaseStudent] = useState<string | undefined>(undefined);

  const isCardCaseProject = activeProject?.displayStyle === 'card-case';
  const isCardCaseGroupView = isCardCaseProject && !selectedCardCaseGroup;
  const supportsThemeFilter = activeProject?.displayStyle === 'blog-post' || activeProject?.displayStyle === 'activity-event';
  const supportsKeywordFilter = activeProject?.displayStyle === 'gallery-story';

  const availableThemeTags = useMemo(() => ['ALL', ...collectThemeTags(works)], [works]);
  const availableKeywordTags = useMemo(() => ['ALL', ...collectKeywordTags(works)], [works]);

  const filteredWorks = useMemo(
    () => {
      if (isCardCaseProject) return works;
      return filterAndSortWorksForDisplay(works, {
        displayStyle: activeProject?.displayStyle,
        selectedYear,
        selectedThemeTag,
        selectedKeywordTag,
        starredOnly,
      });
    },
    [works, isCardCaseProject, activeProject?.displayStyle, selectedYear, selectedThemeTag, selectedKeywordTag, starredOnly],
  );

  const cardCaseGroupWorks = useMemo(
    () => {
      const groupWorks = filteredWorks.filter((work) => work.cardCaseRecordType === 'group');
      if (selectedYear === 'ALL') return groupWorks;
      return groupWorks.filter((work) => work.year === selectedYear);
    },
    [filteredWorks, selectedYear],
  );

  const cardCaseWorks = useMemo(
    () => filteredWorks.filter((work) => work.cardCaseRecordType === 'case'),
    [filteredWorks],
  );

  const activeCardCaseGroup = useMemo(
    () => cardCaseGroupWorks.find((work) => work.group === selectedCardCaseGroup),
    [cardCaseGroupWorks, selectedCardCaseGroup],
  );

  const visibleCardCaseWorks = useMemo(
    () => cardCaseWorks.filter((work) => work.group === selectedCardCaseGroup),
    [cardCaseWorks, selectedCardCaseGroup],
  );

  const cardCaseStudentNames = useMemo(
    () => collectCardCaseMemberNames(visibleCardCaseWorks),
    [visibleCardCaseWorks],
  );

  const filteredVisibleCardCaseWorks = useMemo(
    () => filterCardCaseWorksByStudent(visibleCardCaseWorks, selectedCardCaseStudent),
    [visibleCardCaseWorks, selectedCardCaseStudent],
  );

  const availableYears = useMemo(() => {
    if (isCardCaseProject) {
      return getCardCaseAvailableYears(works);
    }
    const years = new Set(works.map((work) => work.year).filter(Boolean));
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [works, isCardCaseProject]);

  useEffect(() => {
    setSelectedCardCaseGroup(undefined);
  }, [activeProjectId]);

  useEffect(() => {
    setSelectedCardCaseStudent(undefined);
  }, [selectedCardCaseGroup]);

  useEffect(() => {
    if (selectedCardCaseGroup && !cardCaseGroupWorks.some((work) => work.group === selectedCardCaseGroup)) {
      setSelectedCardCaseGroup(undefined);
    }
  }, [cardCaseGroupWorks, selectedCardCaseGroup]);

  const summaryLabel = isCardCaseProject
    ? selectedCardCaseGroup
      ? `Showing ${filteredVisibleCardCaseWorks.length} cases`
      : `Showing ${cardCaseGroupWorks.length} groups`
    : `Showing ${filteredWorks.length} works`;

  const handlePrintCardCase = () => {
    if (!filteredVisibleCardCaseWorks.length) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    const title = activeCardCaseGroup?.group || selectedCardCaseGroup || activeProject?.projectName || 'Card Case';
    printWindow.document.open();
    printWindow.document.write(buildCardCasePrintHtml(filteredVisibleCardCaseWorks, title));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

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

      <div
        className={cn(
          'sticky top-[124px] md:top-[73px] z-50 bg-white/80 backdrop-blur-xl border-b border-black/5',
          !isMobileMenuOpen && 'hidden md:block',
        )}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="hidden md:flex gap-12 overflow-x-auto no-scrollbar py-6">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  setSelectedYear('ALL');
                  setStarredOnly(false);
                  setSelectedThemeTag('ALL');
                  setSelectedKeywordTag('ALL');
                  setSelectedCardCaseGroup(undefined);
                }}
                className={cn(
                  'text-[11px] font-bold uppercase tracking-[0.3em] whitespace-nowrap transition-all relative py-2',
                  activeProjectId === project.id ? 'text-black' : 'text-black/30 hover:text-black/50',
                )}
              >
                {project.tabName}
                {activeProjectId === project.id && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                )}
              </button>
            ))}
          </div>
        </div>

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
                      setSelectedThemeTag('ALL');
                      setSelectedKeywordTag('ALL');
                      setSelectedCardCaseGroup(undefined);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'w-full text-left py-4 px-4 rounded-xl transition-all flex items-center justify-between',
                      activeProjectId === project.id ? 'bg-black text-white' : 'text-black/40 hover:bg-black/5',
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em]">{project.tabName}</span>
                    <span className="text-[10px] font-mono opacity-40">0{index + 1}</span>
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
          <div className="text-[10px] font-bold uppercase tracking-widest text-black/20">{summaryLabel}</div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 mb-12 py-6 border-y border-black/5">
          {(!isCardCaseProject || isCardCaseGroupView) && (
            <div className="flex items-center justify-between md:justify-start gap-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Filter size={12} />
                <span>Filter by Year</span>
              </div>
              <div className="relative group">
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[120px]"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {!isCardCaseProject && (
            <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Star size={12} />
                <span>Recommendation</span>
              </div>
              <div className="relative group">
                <select
                  value={starredOnly ? 'STARRED' : 'ALL'}
                  onChange={(event) => setStarredOnly(event.target.value === 'STARRED')}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[160px]"
                >
                  <option value="ALL">All Works</option>
                  <option value="STARRED">★ Recommended Only</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {supportsThemeFilter && (
            <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Filter size={12} />
                <span>Theme Tag</span>
              </div>
              <div className="relative group">
                <select
                  value={selectedThemeTag}
                  onChange={(event) => setSelectedThemeTag(event.target.value)}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[140px]"
                >
                  {availableThemeTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {supportsKeywordFilter && (
            <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Filter size={12} />
                <span>Keyword Tag</span>
              </div>
              <div className="relative group">
                <select
                  value={selectedKeywordTag}
                  onChange={(event) => setSelectedKeywordTag(event.target.value)}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[140px]"
                >
                  {availableKeywordTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {isCardCaseProject && selectedCardCaseGroup && (
            <div className="flex items-center gap-2 md:pl-8 md:border-l border-black/5 md:ml-auto">
              <button
                type="button"
                onClick={handlePrintCardCase}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black/80 transition-all"
              >
                <Download size={14} />
                <span>Print Cards (A4)</span>
              </button>
            </div>
          )}
        </div>

        {isCardCaseProject && !selectedCardCaseGroup ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {cardCaseGroupWorks.map((groupWork) => (
              <motion.button
                key={groupWork.id}
                type="button"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedCardCaseGroup(groupWork.group)}
                className="relative overflow-hidden rounded-3xl text-left min-h-[360px] group border border-black/5 shadow-sm hover:shadow-xl transition-all"
                style={{ background: groupCardBackground(groupWork.group || groupWork.assignmentName) }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-between p-8 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mb-3">Group Project</div>
                      <h3 className="text-3xl font-bold tracking-tight leading-tight">{groupWork.group || groupWork.assignmentName}</h3>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest">
                      {groupWork.caseIds?.length || 0} Cases
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">Members</div>
                      <div className="flex flex-wrap gap-2">
                        {(groupWork.memberDetails || []).map((member, index) => (
                          <span key={`${member.name}-${index}`} className="px-3 py-2 rounded-full bg-white/12 backdrop-blur-md text-xs font-semibold">
                            {member.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Year</div>
                        <div className="text-lg font-bold">{groupWork.year || 'N/A'}</div>
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70 group-hover:translate-x-1 transition-transform">
                        Enter Group
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : isCardCaseProject ? (
          <>
            <div className="mb-12 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setSelectedCardCaseGroup(undefined)}
                className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
              >
                ← Back to Group List
              </button>
              <div className="text-[10px] font-bold uppercase tracking-widest text-black/20">
                {activeCardCaseGroup?.group || selectedCardCaseGroup}
              </div>
            </div>

            {activeCardCaseGroup && (
              <div className="mb-12 p-8 bg-black/[0.03] rounded-3xl border border-black/5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/35 mb-4">Group Members</div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedCardCaseStudent(undefined)}
                        className={cn(
                          'bg-white px-4 py-3 rounded-2xl border shadow-sm text-left transition-colors',
                          !selectedCardCaseStudent ? 'border-black text-black' : 'border-black/5 text-black/50 hover:text-black',
                        )}
                      >
                        <div className="text-sm font-bold">All Students</div>
                        <div className="text-[10px] font-mono mt-1">{visibleCardCaseWorks.length} cards</div>
                      </button>
                      {(activeCardCaseGroup.memberDetails || []).map((member, index) => (
                        <button
                          type="button"
                          key={`${member.name}-${index}`}
                          onClick={() => setSelectedCardCaseStudent(member.name)}
                          className={cn(
                            'bg-white px-4 py-3 rounded-2xl border shadow-sm text-left transition-colors',
                            selectedCardCaseStudent === member.name ? 'border-black text-black' : 'border-black/5 text-black/60 hover:text-black',
                          )}
                        >
                          <div className="text-sm font-bold">{member.name}</div>
                          <div className="text-[10px] font-mono text-black/40 mt-1">{member.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col justify-end lg:items-end">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/35 mb-2">Collection</div>
                    <div className="text-3xl font-bold tracking-tight">{activeCardCaseGroup.group || activeCardCaseGroup.assignmentName}</div>
                    <div className="text-[11px] font-bold text-black/40 mt-2 uppercase tracking-widest">
                      {filteredVisibleCardCaseWorks.length} cases • Academic Year {activeCardCaseGroup.year || 'N/A'}
                    </div>
                    {selectedCardCaseStudent && (
                      <div className="text-[11px] font-bold text-black/50 mt-2 uppercase tracking-widest">
                        Filtered by {selectedCardCaseStudent}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {filteredVisibleCardCaseWorks.map((work) => (
                <div key={work.id} className="space-y-3">
                  <StudentWorkItem work={work} style="card-case" />
                  <div className="px-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">Student</div>
                    <div className="text-sm font-semibold text-black/70">{getCardCaseStudentLabel(work)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : activeProject?.displayStyle === 'data-matrix' ? (
          <DataMatrix works={filteredWorks} />
        ) : (
          <div
            className={cn(
              'grid gap-12',
              activeProject?.displayStyle === 'generic-card' || activeProject?.displayStyle === 'blog-post'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                : activeProject?.displayStyle === 'activity-event'
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : 'grid-cols-1',
            )}
          >
            {filteredWorks.map((work) => (
              <StudentWorkItem key={work.id} work={work} style={activeProject?.displayStyle || 'generic-card'} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};
