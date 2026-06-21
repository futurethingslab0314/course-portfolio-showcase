import React from 'react';
import { BlogContentSection, BlogRichTextSpan } from '../../types';

interface RenderBlogSectionOptions {
  anchorId?: string;
}

function getRichTextColorStyle(color: string | undefined): React.CSSProperties | undefined {
  if (!color) return undefined;

  const colorMap: Record<string, React.CSSProperties> = {
    gray: { color: '#787774' },
    brown: { color: '#9f6b53' },
    orange: { color: '#d9730d' },
    yellow: { color: '#cb912f' },
    green: { color: '#448361' },
    blue: { color: '#337ea9' },
    purple: { color: '#9065b0' },
    pink: { color: '#c14c8a' },
    red: { color: '#e03e3e' },
    gray_background: { backgroundColor: '#f1f1ef', color: '#787774', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    brown_background: { backgroundColor: '#f4eeee', color: '#9f6b53', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    orange_background: { backgroundColor: '#faebdd', color: '#d9730d', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    yellow_background: { backgroundColor: '#fbf3db', color: '#cb912f', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    green_background: { backgroundColor: '#edf3ec', color: '#448361', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    blue_background: { backgroundColor: '#e7f3f8', color: '#337ea9', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    purple_background: { backgroundColor: '#f6f3f9', color: '#9065b0', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    pink_background: { backgroundColor: '#faecef', color: '#c14c8a', borderRadius: '0.25rem', paddingInline: '0.2rem' },
    red_background: { backgroundColor: '#fdebec', color: '#e03e3e', borderRadius: '0.25rem', paddingInline: '0.2rem' },
  };

  return colorMap[color];
}

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
  if (span.color) {
    node = <span key={`color-${key}`} style={getRichTextColorStyle(span.color)}>{node}</span>;
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

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

function getEmbeddedVideoSrc(url: string) {
  const trimmed = url.trim();

  const youtubeShort = trimmed.match(/^https?:\/\/(?:www\.)?youtu\.be\/([^?&#/]+)/i);
  if (youtubeShort?.[1]) {
    return `https://www.youtube.com/embed/${youtubeShort[1]}`;
  }

  const youtubeWatch = trimmed.match(/[?&]v=([^?&#/]+)/i);
  if (youtubeWatch?.[1] && /youtube\.com/i.test(trimmed)) {
    return `https://www.youtube.com/embed/${youtubeWatch[1]}`;
  }

  const youtubeEmbed = trimmed.match(/youtube\.com\/embed\/([^?&#/]+)/i);
  if (youtubeEmbed?.[1]) {
    return `https://www.youtube.com/embed/${youtubeEmbed[1]}`;
  }

  const youtubeShorts = trimmed.match(/youtube\.com\/shorts\/([^?&#/]+)/i);
  if (youtubeShorts?.[1]) {
    return `https://www.youtube.com/embed/${youtubeShorts[1]}`;
  }

  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return trimmed;
}

function renderVideoSection(
  section: Extract<BlogContentSection, { type: 'video' }>,
  index: number,
) {
  const caption = section.caption?.trim();
  const isDirect = section.provider === 'direct' || isDirectVideoUrl(section.content);
  const src = isDirect ? section.content : getEmbeddedVideoSrc(section.content);

  return (
    <div key={index} className="blog-section">
      <figure className="my-8">
        <div className="overflow-hidden bg-black/5">
          {isDirect ? (
            <video
              controls
              playsInline
              className="w-full h-auto bg-black"
              src={src}
            />
          ) : (
            <iframe
              src={src}
              title={caption || 'Embedded video'}
              className="aspect-video w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
        {caption && (
          <figcaption className="mt-4 text-center text-sm text-black/40 font-medium italic">
            - {caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function renderTextSection(
  section: Extract<BlogContentSection, { type: 'text' }>,
  index: number,
  options?: RenderBlogSectionOptions,
) {
  const content = section.richText?.length ? renderRichText(section.richText, section.content) : section.content;
  const anchorId = options?.anchorId;

  if (section.blockType === 'heading_1') {
    return <h1 id={anchorId} key={index} className="mt-12 mb-8 text-[32px] leading-tight font-bold tracking-tight text-black scroll-mt-24">{content}</h1>;
  }

  if (section.blockType === 'heading_2') {
    return <h2 id={anchorId} key={index} className="mt-10 mb-7 text-[24px] leading-tight font-bold tracking-tight text-black scroll-mt-24">{content}</h2>;
  }

  if (section.blockType === 'heading_3') {
    return <h3 id={anchorId} key={index} className="mt-8 mb-6 text-[20px] leading-tight font-semibold tracking-tight text-black/90 scroll-mt-24">{content}</h3>;
  }

  if (section.blockType === 'heading_4') {
    return <h4 id={anchorId} key={index} className="mt-7 mb-4 text-[17px] leading-snug font-semibold tracking-tight text-black/85 scroll-mt-24">{content}</h4>;
  }

  if (section.blockType === 'callout') {
    return (
      <aside key={index} className="blog-section my-6 border border-[#e8dfc8] bg-[#f7f3e8] px-5 py-4 text-black/75 shadow-sm">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">Callout</div>
        <div className="leading-[1.65]">{content}</div>
        {section.children?.length ? (
          <div className="mt-4 space-y-4">
            {renderBlogSections(section.children)}
          </div>
        ) : null}
      </aside>
    );
  }

  if (section.blockType === 'quote') {
    return (
      <blockquote key={index} className="mb-6 border-l-4 border-black/15 pl-5 text-black/70 italic">
        {content}
      </blockquote>
    );
  }

  if (section.blockType === 'bulleted_list_item' || section.blockType === 'numbered_list_item') {
    const ListTag = section.blockType === 'numbered_list_item' ? 'ol' : 'ul';
    const listClass = section.blockType === 'numbered_list_item' ? 'list-decimal' : 'list-disc';
    const listContent = section.richText?.length ? renderRichText(section.richText, section.content) : section.content;
    return (
      <div key={index} className="blog-section">
        <ListTag className={`${listClass} my-3 pl-6 text-black/80 leading-[1.65]`}>
          <li className="pl-1">{listContent}</li>
        </ListTag>
      </div>
    );
  }

  return (
    <div key={index} className="blog-section">
      <div className="prose prose-lg max-w-none text-black/80 leading-[1.65]">
        {(section.richText?.length ? [section.content] : section.content.split('\n')).map((para, i) => (
          <p key={i} className="mb-2">
            {section.richText?.length ? renderRichText(section.richText, para) : para}
          </p>
        ))}
      </div>
    </div>
  );
}

function isListTextSection(
  section: BlogContentSection,
): section is Extract<BlogContentSection, { type: 'text' }> & { blockType: 'bulleted_list_item' | 'numbered_list_item' } {
  return section.type === 'text' && (section.blockType === 'bulleted_list_item' || section.blockType === 'numbered_list_item');
}

function renderListItemContent(section: Extract<BlogContentSection, { type: 'text' }>) {
  return section.richText?.length ? renderRichText(section.richText, section.content) : section.content;
}

export function renderBlogSections(
  sections: BlogContentSection[],
  getOptions?: (section: BlogContentSection, index: number) => RenderBlogSectionOptions | undefined,
) {
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < sections.length) {
    const section = sections[index];

    if (section && isListTextSection(section)) {
      const blockType = section.blockType;
      const listItems: typeof section[] = [];

      while (index < sections.length) {
        const nextSection = sections[index];
        if (!nextSection || !isListTextSection(nextSection) || nextSection.blockType !== blockType) {
          break;
        }
        listItems.push(nextSection);
        index += 1;
      }

      const ListTag = blockType === 'numbered_list_item' ? 'ol' : 'ul';
      const listClass = blockType === 'numbered_list_item' ? 'list-decimal' : 'list-disc';
      nodes.push(
        <div key={`list-${nodes.length}`} className="blog-section">
          <ListTag className={`${listClass} my-3 pl-6 text-black/80 leading-[1.65]`}>
            {listItems.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">{renderListItemContent(item)}</li>
            ))}
          </ListTag>
        </div>,
      );
      continue;
    }

    nodes.push(renderBlogSection(section, index, getOptions?.(section, index)));
    index += 1;
  }

  return nodes;
}

function getToggleSummaryClass(blockType: Extract<BlogContentSection, { type: 'toggle' }>['blockType']) {
  if (blockType === 'heading_1') {
    return 'text-[32px] leading-tight font-bold tracking-tight text-black';
  }
  if (blockType === 'heading_2') {
    return 'text-[24px] leading-tight font-bold tracking-tight text-black';
  }
  if (blockType === 'heading_3') {
    return 'text-[20px] leading-tight font-semibold tracking-tight text-black/90';
  }
  if (blockType === 'heading_4') {
    return 'text-[17px] leading-snug font-semibold tracking-tight text-black/85';
  }
  return 'text-base font-semibold text-black';
}

export function renderBlogSection(section: BlogContentSection, index: number, options?: RenderBlogSectionOptions) {
  if (section.type === 'text') {
    return renderTextSection(section, index, options);
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

  if (section.type === 'video') {
    return renderVideoSection(section, index);
  }

  if (section.type === 'code') {
    return (
      <div key={index} className="blog-section">
        <figure className="my-8 overflow-hidden rounded-2xl border border-black/10 bg-[#111111] text-[#f5f5f0] shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Code</span>
            {section.language ? (
              <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
                {section.language}
              </span>
            ) : null}
          </div>
          <pre className="overflow-x-auto px-4 py-5 text-sm leading-7">
            <code className="font-mono whitespace-pre-wrap break-words">{section.content}</code>
          </pre>
        </figure>
      </div>
    );
  }

  if (section.type === 'toggle') {
    return (
      <details key={index} className="blog-section my-6 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.02]">
        <summary
          className={`cursor-pointer list-none px-5 py-4 marker:content-none ${getToggleSummaryClass(section.blockType)}`}
          aria-label={`Toggle ${section.content}`}
        >
          <span className="inline-flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-black/35">Toggle</span>
            <span>{renderRichText(section.richText, section.content)}</span>
          </span>
        </summary>
        <div className="border-t border-black/8 px-5 py-5">
          <div className="space-y-5">
            {renderBlogSections(section.children)}
          </div>
        </div>
      </details>
    );
  }

  if (section.type === 'column_list') {
    return (
      <div key={index} className="blog-section my-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {section.columns.map((column, columnIndex) => (
            <div key={columnIndex} className="min-w-0 space-y-4">
              {renderBlogSections(column.children)}
            </div>
          ))}
        </div>
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
