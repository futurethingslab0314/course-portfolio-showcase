import React from 'react';
import { ExternalLink, User } from 'lucide-react';
import { StudentWork } from '../../types';

interface BlogPostProps {
  work: StudentWork;
}

export const BlogPost = ({ work }: BlogPostProps) => {
  return (
    <article className="max-w-4xl mx-auto bg-white border border-black/5 shadow-sm overflow-hidden mb-24">
      {/* Header Image */}
      <div className="aspect-[21/9] w-full overflow-hidden">
        <img 
          src={work.mainImage} 
          alt={work.assignmentName} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="p-8 md:p-16">
        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
            Blog Post
          </span>
          <span className="text-black/30 font-mono text-xs tracking-widest">
            / {work.year || '2026'}
          </span>
          {work.tags?.map(tag => (
            <span key={tag} className="text-[10px] font-bold uppercase tracking-widest text-black/40 border border-black/10 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>

        {/* Title & Description */}
        <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-8 leading-[0.9]">
          {work.assignmentName}
        </h2>
        
        <p className="text-xl text-black/60 leading-relaxed font-serif italic mb-12 border-l-4 border-black/10 pl-6">
          {work.description}
        </p>

        {/* Blog Content Sections */}
        <div className="space-y-12 mb-16">
          {work.blogContent?.map((section, index) => (
            <div key={index} className="blog-section">
              {section.type === 'text' ? (
                <div className="prose prose-lg max-w-none text-black/80 leading-relaxed">
                  {section.content.split('\n').map((para, i) => (
                    <p key={i} className="mb-4">{para}</p>
                  ))}
                </div>
              ) : (
                <figure className="my-8">
                  <div className="overflow-hidden bg-black/5">
                    <img 
                      src={section.content} 
                      alt={section.caption || ""} 
                      className="w-full h-auto"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {section.caption && (
                    <figcaption className="mt-4 text-center text-sm text-black/40 font-medium italic">
                      — {section.caption}
                    </figcaption>
                  )}
                </figure>
              )}
            </div>
          ))}
        </div>

        {/* Footer: Team & Action */}
        <div className="pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex flex-wrap gap-6">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30 mb-3">Contributors</h4>
              <div className="flex flex-wrap gap-2">
                {work.members.map((member, i) => (
                  <div key={member} className="flex items-center gap-2 bg-black/5 px-3 py-1.5">
                    <User size={12} className="text-black/40" />
                    <span className="text-xs font-semibold text-black/70">{member}</span>
                    <span className="text-[8px] font-mono text-black/20">M112...{i}</span>
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
};
