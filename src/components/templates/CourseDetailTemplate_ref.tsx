import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Course, Project, StudentWork } from '../../types';
import { cn } from '../../lib/utils';
import { DataMatrix } from '../projects/DataMatrix';
import { ShopSummaryTable } from '../projects/ShopSummaryTable';
import { Header } from '../Header';
import { Footer } from '../Footer';
import { Filter, Star, ChevronDown, Menu, X as CloseIcon, Tag, Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

interface CourseDetailTemplateProps {
  course: Course;
  projects: Project[];
  activeProjectId: string | undefined;
  setActiveProjectId: (id: string) => void;
  works: StudentWork[];
  StudentWorkItem: React.ComponentType<{ work: StudentWork; style: Project['displayStyle'] }>;
}

export const CourseDetailTemplate = ({ 
  course, 
  projects, 
  activeProjectId, 
  setActiveProjectId, 
  works, 
  StudentWorkItem
}: CourseDetailTemplateProps) => {
  const activeProject = projects.find(p => p.id === activeProjectId);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [selectedThemeTag, setSelectedThemeTag] = useState<string>('ALL');
  const [starredOnly, setStarredOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProjectEntered, setIsProjectEntered] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set(works.map(w => w.year).filter(Boolean));
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [works]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    works.forEach(w => {
      w.tags?.forEach(tag => tags.add(tag));
    });
    return ['ALL', ...Array.from(tags).sort()];
  }, [works]);

  const availableThemeTags = useMemo(() => {
    const themes = new Set(works.map(w => w.themeTag).filter(Boolean));
    return ['ALL', ...Array.from(themes).sort()];
  }, [works]);

  const filteredWorks = useMemo(() => {
    let result = works;
    if (selectedYear !== 'ALL') {
      result = result.filter(w => w.year === selectedYear);
    }
    if (selectedTag !== 'ALL') {
      result = result.filter(w => w.tags?.includes(selectedTag));
    }
    if (selectedThemeTag !== 'ALL') {
      result = result.filter(w => w.themeTag === selectedThemeTag);
    }
    if (starredOnly) {
      result = result.filter(w => w.isStarred);
    }
    return result;
  }, [works, selectedYear, selectedTag, selectedThemeTag, starredOnly]);

  const handleExport = () => {
    if (filteredWorks.length === 0) return;

    // Group by themeTag
    const groupedWorks: { [key: string]: StudentWork[] } = {};
    filteredWorks.forEach(work => {
      const theme = work.themeTag || 'Other Activities';
      if (!groupedWorks[theme]) groupedWorks[theme] = [];
      groupedWorks[theme].push(work);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${activeProject?.projectName || 'Achievement Record'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
          
          body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
          }
          
          @page {
            size: A4;
            margin: 2.5cm;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          
          header {
            border-bottom: 2px solid #000;
            margin-bottom: 40px;
            padding-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          
          .report-title {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            margin: 0;
            letter-spacing: -0.02em;
          }
          
          .export-date {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #666;
          }
          
          .theme-section {
            margin-bottom: 50px;
            page-break-inside: avoid;
          }
          
          .theme-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #999;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
            margin-bottom: 24px;
          }
          
          .activity-item {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          .activity-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
          }
          
          .activity-name {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            flex: 1;
            padding-right: 20px;
          }
          
          .activity-meta {
            font-size: 12px;
            color: #666;
            text-align: right;
            white-space: nowrap;
          }
          
          .activity-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
            font-size: 13px;
          }
          
          .detail-box {
            background: #f9f9f9;
            padding: 12px;
            border-radius: 4px;
          }
          
          .detail-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #999;
            margin-bottom: 4px;
            font-weight: 700;
          }
          
          .detail-value {
            font-weight: 600;
            color: #333;
          }
          
          .description {
            font-size: 14px;
            color: #444;
            margin-bottom: 20px;
            text-align: justify;
          }
          
          .publication {
            font-style: italic;
            font-family: 'Playfair Display', serif;
            color: #000;
            border-left: 3px solid #000;
            padding-left: 16px;
            margin: 16px 0;
            font-size: 15px;
          }

          .image-gallery {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 20px 0;
          }

          .activity-image {
            width: 100%;
            aspect-ratio: 16/9;
            object-cover: cover;
            border-radius: 4px;
            background: #eee;
          }

          .main-image {
            grid-column: span 2;
            aspect-ratio: 21/9;
          }
          
          .members {
            font-size: 12px;
            color: #666;
            margin-top: 12px;
          }
          
          .footer {
            margin-top: 80px;
            font-size: 10px;
            text-align: center;
            color: #ccc;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }

          @media print {
            .container { padding: 0; width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div>
              <h1 class="report-title">Achievement Record</h1>
              <div style="font-size: 14px; margin-top: 4px; font-weight: 600;">${activeProject?.projectName}</div>
            </div>
            <div class="export-date">Generated: ${new Date().toLocaleDateString()}</div>
          </header>

          ${Object.entries(groupedWorks).map(([theme, items]) => `
            <div class="theme-section">
              <div class="theme-title">${theme}</div>
              ${items.map(work => `
                <div class="activity-item">
                  <div class="activity-header">
                    <h3 class="activity-name">${work.assignmentName}</h3>
                    <div class="activity-meta">
                      ${work.year}<br>
                      ${work.city || ''}${work.city && work.country ? ', ' : ''}${work.country || ''}
                    </div>
                  </div>

                  <div class="activity-details">
                    <div class="detail-box">
                      <div class="detail-label">Period</div>
                      <div class="detail-value">${work.startDate || work.year} ${work.endDate ? `— ${work.endDate}` : ''}</div>
                    </div>
                    <div class="detail-box">
                      <div class="detail-label">Grant / Sponsor</div>
                      <div class="detail-value">${work.grant || 'Self-funded'}</div>
                    </div>
                  </div>

                  <div class="description">${work.description}</div>

                  <div class="image-gallery">
                    <img src="${work.mainImage}" class="activity-image main-image" referrerPolicy="no-referrer" />
                    ${(work.moreImages || []).slice(0, 2).map(img => `
                      <img src="${img}" class="activity-image" referrerPolicy="no-referrer" />
                    `).join('')}
                  </div>

                  ${work.publicationName ? `
                    <div class="publication">
                      <div class="detail-label" style="border:none; padding:0; margin-bottom:4px;">Publication</div>
                      ${work.publicationName}
                    </div>
                  ` : ''}

                  <div class="members">
                    <strong>Members:</strong> ${work.members.join(', ')}
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}

          <div class="footer">
            &copy; ${new Date().getFullYear()} ${course.courseName} | Achievement Record Export
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject?.projectName || 'Activity_Log'}_Report.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintCardCase = () => {
    if (filteredWorks.length === 0) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Print Cards - ${activeProject?.projectName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            font-family: sans-serif;
            margin: 0;
            padding: 0;
            background: white;
          }
          .page {
            width: 297mm;
            height: 210mm;
            padding: 10mm;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 5mm;
            page-break-after: always;
          }
          .card {
            border: 1px solid #000;
            display: flex;
            flex-direction: column;
            background: white;
            box-sizing: border-box;
            overflow: hidden;
            height: 100%;
            position: relative;
          }
          .card-bg {
            position: absolute;
            inset: 0;
            z-index: 0;
          }
          .card-bg img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.1;
          }
          .card-overlay {
            position: relative;
            z-index: 1;
            padding: 12px;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.85);
          }
          .card-header {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
          }
          .circle {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 1px solid #000;
            background: white;
            flex-shrink: 0;
            overflow: hidden;
          }
          .circle img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .target-user {
            font-size: 8pt;
            font-weight: bold;
            color: #000;
            line-height: 1.1;
          }
          .image-area {
            flex-grow: 1;
            background: #fff;
            border: 1px solid #eee;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .image-area img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .details {
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
          }
          .detail-row {
            display: flex;
            gap: 4px;
            margin-bottom: 2px;
          }
          .label {
            font-weight: bold;
            white-space: nowrap;
            color: #444;
            text-transform: uppercase;
            font-size: 7pt;
          }
        </style>
      </head>
      <body>
        ${Array.from({ length: Math.ceil(filteredWorks.length / 8) }).map((_, pageIdx) => `
          <div class="page">
            ${filteredWorks.slice(pageIdx * 8, pageIdx * 8 + 8).map(work => `
              <div class="card">
                <div class="card-bg">
                  <img src="${work.mainImage}" />
                </div>
                <div class="card-overlay">
                  <div class="card-header">
                    <div class="circle">
                      ${work.interactionPart ? `<img src="${work.interactionPart}" />` : ''}
                    </div>
                    <div class="target-user">
                      TARGET: ${work.targetUser || 'N/A'}
                    </div>
                  </div>
                  <div class="image-area">
                    <img src="${work.mainImage}" />
                  </div>
                  <div class="details">
                    <div class="detail-row"><span class="label">NAME</span> ${work.assignmentName}</div>
                    <div class="detail-row"><span class="label">TEAM</span> ${work.designTeam || 'N/A'}</div>
                    <div class="detail-row"><span class="label">TAGS</span> ${(work.tags || []).join(', ')}</div>
                    ${work.foundBy ? `<div class="detail-row" style="margin-top:2px; opacity:0.6;"><span class="label">BY</span> ${work.foundBy}</div>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header 
        title={course.courseName} 
        showBackButton={true} 
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMenuOpen={isMobileMenuOpen}
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
                  setSelectedTag('ALL');
                  setSelectedThemeTag('ALL');
                  setStarredOnly(false);
                  setIsProjectEntered(false); // Reset project entry state
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
                      setSelectedTag('ALL');
                      setSelectedThemeTag('ALL');
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
        {activeProject?.displayStyle === 'shop-catalog' && (
          <div className="w-full aspect-[21/7] mb-12 overflow-hidden bg-black/5">
            <img 
              src="https://picsum.photos/seed/shop-hero/1920/640" 
              alt="Shop Hero" 
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
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
              <span>Year</span>
            </div>
            <div className="relative group">
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[100px]"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
            </div>
          </div>

          {availableTags.length > 1 && (
            <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Filter size={12} />
                <span>Topic</span>
              </div>
              <div className="relative group">
                <select 
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[120px]"
                >
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>{tag === 'ALL' ? 'All Topics' : tag}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {availableThemeTags.length > 1 && (
            <div className="flex items-center justify-between md:justify-start gap-6 md:pl-8 md:border-l border-black/5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/30">
                <Tag size={12} />
                <span>Theme</span>
              </div>
              <div className="relative group">
                <select 
                  value={selectedThemeTag}
                  onChange={(e) => setSelectedThemeTag(e.target.value)}
                  className="appearance-none bg-white border border-black/10 rounded-lg px-4 py-2 pr-10 text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:border-black cursor-pointer min-w-[120px]"
                >
                  {availableThemeTags.map(theme => (
                    <option key={theme} value={theme}>{theme === 'ALL' ? 'All Themes' : theme}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/30" />
              </div>
            </div>
          )}

          {activeProject?.displayStyle === 'shop-catalog' && (
            <div className="flex items-center gap-2 md:pl-8 md:border-l border-black/5">
              <div className="flex bg-black/5 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                    viewMode === 'grid' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black/60"
                  )}
                >
                  Grid
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                    viewMode === 'table' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black/60"
                  )}
                >
                  Summary Table
                </button>
              </div>
            </div>
          )}

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

          {activeProject?.displayStyle === 'activity-event' && (
            <div className="flex items-center gap-2 md:pl-8 md:border-l border-black/5 ml-auto">
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black/80 transition-all"
              >
                <Download size={14} />
                <span>Export Log</span>
              </button>
            </div>
          )}

          {activeProject?.displayStyle === 'card-case' && (
            <div className="flex items-center gap-2 md:pl-8 md:border-l border-black/5 ml-auto">
              <button 
                onClick={handlePrintCardCase}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-black/80 transition-all"
              >
                <Download size={14} />
                <span>Print Cards (A4)</span>
              </button>
            </div>
          )}
        </div>

        {activeProject?.displayStyle === 'card-case' && !isProjectEntered && (
          <div className="mb-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative aspect-[21/9] rounded-3xl overflow-hidden group cursor-pointer border border-black/5"
              onClick={() => setIsProjectEntered(true)}
            >
              <img 
                src={filteredWorks[0]?.mainImage || "https://picsum.photos/seed/project-cover/1920/1080"} 
                alt="Project Cover" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.4em] text-white/60 mb-4">Project Collection</div>
                    <h3 className="text-5xl md:text-6xl font-bold text-white tracking-tighter mb-6">{activeProject?.projectName}</h3>
                    <div className="flex gap-8">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Year</div>
                        <div className="text-white font-bold">{filteredWorks[0]?.year}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Team</div>
                        <div className="text-white font-bold">{filteredWorks[0]?.designTeam || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Cards</div>
                        <div className="text-white font-bold">{filteredWorks.length} Items</div>
                      </div>
                    </div>
                  </div>
                  <button className="px-8 py-4 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-widest hover:bg-white/90 transition-all transform group-hover:translate-y-[-4px]">
                    Enter Collection
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {activeProject?.displayStyle === 'card-case' && isProjectEntered && (
          <div className="mb-12 flex items-center justify-between">
            <button 
              onClick={() => setIsProjectEntered(false)}
              className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-2"
            >
              ← Back to Project Overview
            </button>
            <div className="flex items-center gap-4">
              <div className="h-px w-12 bg-black/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/20">
                Viewing {activeProject?.projectName}
              </span>
            </div>
          </div>
        )}

        {activeProject?.displayStyle === 'card-case' && isProjectEntered && filteredWorks.length > 0 && (
          <div className="mb-12 p-8 bg-black/5 rounded-2xl border border-black/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">Group Members</h4>
                <div className="flex flex-wrap gap-3">
                  {(filteredWorks[0].memberDetails || filteredWorks[0].members.map(m => ({ name: m, id: 'N/A' }))).map((member, idx) => (
                    <div key={idx} className="bg-white px-4 py-3 rounded-xl border border-black/5 flex flex-col shadow-sm">
                      <span className="text-sm font-bold">{member.name}</span>
                      <span className="text-[10px] font-mono text-black/40 mt-0.5">{member.id}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-end items-end text-right">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">Project Classification</h4>
                <div className="text-3xl font-bold tracking-tighter text-black/80">
                  {activeProject?.projectName}
                </div>
                <div className="text-[11px] font-bold text-black/40 mt-2 uppercase tracking-widest">
                  Academic Year {filteredWorks[0].year}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeProject?.displayStyle === 'data-matrix' ? (
          <DataMatrix works={filteredWorks} />
        ) : activeProject?.displayStyle === 'shop-catalog' && viewMode === 'table' ? (
          <ShopSummaryTable works={filteredWorks} />
        ) : activeProject?.displayStyle === 'shop-catalog' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 auto-rows-[300px] gap-0 border border-black/5">
            {filteredWorks.map((work, index) => {
              // Create a "designed" variation in sizes
              const isLarge = index % 11 === 0;
              const isWide = index % 7 === 0 && !isLarge;
              const isTall = index % 5 === 0 && !isLarge && !isWide;
              
              return (
                <div 
                  key={work.id} 
                  className={cn(
                    "border border-black/5",
                    isLarge ? "col-span-2 row-span-2" : 
                    isWide ? "col-span-2 row-span-1" :
                    isTall ? "col-span-1 row-span-2" :
                    "col-span-1 row-span-1"
                  )}
                >
                  <StudentWorkItem 
                    work={work} 
                    style="shop-catalog" 
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn(
            "grid gap-12",
            activeProject?.displayStyle === 'generic-card' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : 
            activeProject?.displayStyle === 'activity-event' ? "grid-cols-1 md:grid-cols-2" :
            activeProject?.displayStyle === 'card-case' ? (isProjectEntered ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "hidden") :
            "grid-cols-1"
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
