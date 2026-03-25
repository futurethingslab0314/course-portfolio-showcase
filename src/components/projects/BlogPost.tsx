import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Plus, User, X } from 'lucide-react';
import { StudentWork } from '../../types';
import { memberRows } from '../../lib/memberRows';
import { renderBlogSection } from './BlogPostContent';
import { buildBlogQuickJumpItems } from './blogPostNavigation';

interface BlogPostProps {
  work: StudentWork;
}

export function BlogPostArticle({ work }: { work: StudentWork }) {
  const members = memberRows(work);
  const storyButtons = work.storyButtons?.filter((button) => button.label && button.url) ?? [];
  const quickJumpItems = buildBlogQuickJumpItems(work.blogContent);
  const quickJumpIdByIndex = new Map(quickJumpItems.map((item) => [item.index, item.anchorId]));

  return (
    <article className="max-w-4xl mx-auto bg-white border border-black/5 shadow-sm overflow-hidden mb-24">
      <div className="aspect-[21/9] w-full overflow-hidden">
        <img
          src={work.mainImage}
          alt={work.assignmentName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="p-8 md:p-16">
        {storyButtons.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            {storyButtons.map((button, index) => (
              <a
                key={`${button.label}-${index}`}
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
              >
                {button.label}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mb-8">
          <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
            Blog Post
          </span>
          <span className="text-black/30 font-mono text-xs tracking-widest">
            / {work.year || '2026'}
          </span>
          {work.tags?.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold uppercase tracking-widest text-black/40 border border-black/10 px-2 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>

        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-8 leading-[0.9]">{work.assignmentName}</h2>

        <p className="text-xl text-black/60 leading-relaxed font-serif italic mb-12 border-l-4 border-black/10 pl-6">
          {work.description}
        </p>

        {quickJumpItems.length > 0 && (
          <nav aria-label="Blog quick jump" className="mb-10 rounded-2xl border border-black/8 bg-black/[0.02] px-5 py-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">Quick Jump</div>
            <div className="flex flex-wrap gap-2.5">
              {quickJumpItems.map((item) => (
                <a
                  key={item.anchorId}
                  href={`#${item.anchorId}`}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/65 transition-colors hover:border-black/20 hover:text-black"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        <div className="space-y-4 mb-16">
          {work.blogContent?.map((section, index) => renderBlogSection(section, index, { anchorId: quickJumpIdByIndex.get(index) }))}
        </div>

        <div className="pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex flex-wrap gap-6">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-3">Contributors</h4>
              <div className="flex flex-wrap gap-2">
                {members.map((member, i) => (
                  <div key={`${member.name}-${i}`} className="flex items-center gap-2 bg-black/5 px-3 py-1.5">
                    <User size={12} className="text-black/40" />
                    <span className="text-xs font-semibold text-black/70">{member.name}</span>
                    {member.studentId ? (
                      <span className="text-[10px] font-mono text-black/25">{member.studentId}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {work.url && (
            <a
              href={work.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
            >
              View Full Project
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export const BlogPost = ({ work }: BlogPostProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const previewText = useMemo(() => {
    const firstText = work.blogContent?.find((section) => section.type === 'text')?.content || '';
    const fallback = firstText || work.description || '';
    return fallback.split('\n')[0];
  }, [work.blogContent, work.description]);

  const open = () => setIsOpen(true);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <>
      <div onClick={open} className="generic-card-container group">
        <div className="aspect-square overflow-hidden relative">
          <img
            src={work.mainImage}
            alt={work.assignmentName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 p-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform">
              <Plus size={20} className="text-black" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg mb-1">{work.assignmentName}</h3>
          <p className="text-xs text-black/40 font-medium mb-3">{work.members.join(', ') || 'Unassigned'}</p>
          {work.tags && work.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {work.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-bold uppercase tracking-widest text-black/55 border border-black/10 px-2 py-0.5 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-black/60 line-clamp-2">{previewText}</p>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100]">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="Close blog post"
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full w-full overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label={work.assignmentName}
            >
              <button
                onClick={close}
                className="fixed top-5 right-5 z-[110] p-3 bg-black/70 text-white rounded-full hover:bg-black/80 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>

              <div className="min-h-full py-20 px-4 md:px-8 bg-[#f7f7f6]">
                <BlogPostArticle work={work} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
