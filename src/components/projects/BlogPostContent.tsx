import React from 'react';
import { BlogContentSection } from '../../types';

export function renderBlogSection(section: BlogContentSection, index: number) {
  if (section.type === 'text') {
    return (
      <div key={index} className="blog-section">
        <div className="prose prose-lg max-w-none text-black/80 leading-relaxed">
          {section.content.split('\n').map((para, i) => (
            <p key={i} className="mb-4">
              {para}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === 'image') {
    return (
      <div key={index} className="blog-section">
        <figure className="my-8">
          <div className="overflow-hidden bg-black/5">
            <img
              src={section.content}
              alt={section.caption || ''}
              className="w-full h-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          {section.caption && (
            <figcaption className="mt-4 text-center text-sm text-black/40 font-medium italic">
              - {section.caption}
            </figcaption>
          )}
        </figure>
      </div>
    );
  }

  return (
    <div key={index} className="blog-section">
      <div className="my-8 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm text-black/75">
            <tbody>
              {section.rows.map((row, rowIndex) => {
                const isHeaderRow = Boolean(section.hasColumnHeader) && rowIndex === 0;
                return (
                  <tr key={rowIndex} className={isHeaderRow ? 'bg-black text-white' : rowIndex % 2 === 0 ? 'bg-black/[0.02]' : 'bg-white'}>
                    {row.map((cell, cellIndex) => {
                      const isHeaderCell = isHeaderRow || (Boolean(section.hasRowHeader) && cellIndex === 0);
                      const CellTag = isHeaderCell ? 'th' : 'td';
                      return (
                        <CellTag
                          key={cellIndex}
                          className="min-w-[160px] border-b border-r border-black/10 px-4 py-3 align-top text-sm last:border-r-0"
                          scope={isHeaderRow ? 'col' : isHeaderCell ? 'row' : undefined}
                        >
                          {cell}
                        </CellTag>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
