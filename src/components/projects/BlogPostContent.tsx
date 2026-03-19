import React from 'react';
import { BlogContentSection, BlogRichTextSpan } from '../../types';

function wrapSpan(span: BlogRichTextSpan, key: number) {
  let node: React.ReactNode = span.text;

  if (span.code) {
    node = <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em]" key={`code-${key}`}>{node}</code>;
  }
  if (span.bold) {
    node = <strong key={`strong-${key}`} className="font-semibold text-black">{node}</strong>;
  }
  if (span.italic) {
    node = <em key={`em-${key}`} className="italic">{node}</em>;
  }
  if (span.underline || span.strikethrough) {
    const className = [
      span.underline ? 'underline decoration-current underline-offset-4' : '',
      span.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ');
    node = <span key={`decor-${key}`} className={className}>{node}</span>;
  }
  if (span.href) {
    node = (
      <a
        key={`link-${key}`}
        href={span.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline decoration-black/30 underline-offset-4 transition-colors hover:text-black"
      >
        {node}
      </a>
    );
  }

  return <React.Fragment key={key}>{node}</React.Fragment>;
}

function renderRichText(spans: BlogRichTextSpan[] | undefined, fallback: string) {
  if (!spans?.length) {
    return fallback;
  }

  return spans.map((span, index) => wrapSpan(span, index));
}

function renderTextSection(section: Extract<BlogContentSection, { type: 'text' }>, index: number) {
  const content = section.richText?.length ? renderRichText(section.richText, section.content) : section.content;

  if (section.blockType === 'heading_1') {
    return <h1 key={index} className="mb-6 text-4xl md:text-5xl font-bold tracking-tight text-black">{content}</h1>;
  }

  if (section.blockType === 'heading_2') {
    return <h2 key={index} className="mb-5 text-3xl md:text-4xl font-bold tracking-tight text-black">{content}</h2>;
  }

  if (section.blockType === 'heading_3') {
    return <h3 key={index} className="mb-4 text-2xl md:text-3xl font-semibold tracking-tight text-black/90">{content}</h3>;
  }

  if (section.blockType === 'quote' || section.blockType === 'callout') {
    return (
      <blockquote key={index} className="mb-6 border-l-4 border-black/15 pl-5 text-black/70 italic">
        {content}
      </blockquote>
    );
  }

  return (
    <div key={index} className="blog-section">
      <div className="prose prose-lg max-w-none text-black/80 leading-relaxed">
        {(section.richText?.length ? [section.content] : section.content.split('\n')).map((para, i) => (
          <p key={i} className="mb-4">
            {section.richText?.length ? renderRichText(section.richText, para) : para}
          </p>
        ))}
      </div>
    </div>
  );
}

export function renderBlogSection(section: BlogContentSection, index: number) {
  if (section.type === 'text') {
    return renderTextSection(section, index);
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

  if (section.type === 'toggle') {
    return (
      <details key={index} className="blog-section my-6 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
        <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-black marker:content-none">
          <span className="inline-flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-black/35">Toggle</span>
            <span>{renderRichText(section.richText, section.content)}</span>
          </span>
        </summary>
        <div className="border-t border-black/8 px-5 py-5">
          <div className="space-y-5">
            {section.children.map((child, childIndex) => renderBlogSection(child, childIndex))}
          </div>
        </div>
      </details>
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
                      const richCell = section.richRows?.[rowIndex]?.[cellIndex];
                      return (
                        <CellTag
                          key={cellIndex}
                          className="min-w-[160px] border-b border-r border-black/10 px-4 py-3 align-top text-sm last:border-r-0"
                          scope={isHeaderRow ? 'col' : isHeaderCell ? 'row' : undefined}
                        >
                          {renderRichText(richCell, cell)}
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
