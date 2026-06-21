import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderBlogSection, renderBlogSections } from './BlogPostContent';
import { buildBlogQuickJumpItems } from './blogPostNavigation';

test('renderBlogSection renders table sections with column headers and cell content', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'table',
        rows: [
          ['Name', 'Role'],
          ['Alice', 'Research'],
        ],
        hasColumnHeader: true,
        hasRowHeader: false,
      },
      0,
    ),
  );

  assert.match(html, /<table/);
  assert.match(html, /<th[^>]*>Name<\/th>/);
  assert.match(html, /<td[^>]*>Research<\/td>/);
  assert.match(html, /overflow-x-auto/);
});

test('renderBlogSection renders rich-text links in paragraphs and table cells as new-tab anchors', () => {
  const paragraphHtml = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        content: 'See project docs',
        richText: [
          { text: 'See ' },
          { text: 'project docs', href: 'https://example.com/docs' },
        ],
      },
      0,
    ),
  );

  const tableHtml = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'table',
        rows: [['Resource']],
        richRows: [
          [
            [{ text: 'Resource', href: 'https://example.com/resource' }],
          ],
        ],
      },
      1,
    ),
  );

  assert.match(paragraphHtml, /href="https:\/\/example\.com\/docs"/);
  assert.match(paragraphHtml, /target="_blank"/);
  assert.match(paragraphHtml, /leading-\[1\.65\]/);
  assert.match(tableHtml, /href="https:\/\/example\.com\/resource"/);
  assert.match(tableHtml, /rel="noopener noreferrer"/);
});

test('renderBlogSection renders playable video embeds and direct video files', () => {
  const embedHtml = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'video',
        content: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'youtube',
      },
      0,
    ),
  );

  const directHtml = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'video',
        content: 'https://example.com/demo.mp4',
        provider: 'direct',
      },
      1,
    ),
  );

  assert.match(embedHtml, /<iframe/);
  assert.match(embedHtml, /youtube\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(embedHtml, /allowFullScreen/);
  assert.match(directHtml, /<video/);
  assert.match(directHtml, /controls/);
  assert.match(directHtml, /demo\.mp4/);
});

test('renderBlogSection renders rich-text color annotations', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        content: 'Alert note',
        richText: [
          { text: 'Alert', color: 'red' },
          { text: ' note', color: 'yellow_background' },
        ],
      },
      0,
    ),
  );

  assert.match(html, /style="color:#e03e3e"/);
  assert.match(html, /background-color:#fbf3db/);
});

test('renderBlogSection renders callouts as highlighted content blocks', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        blockType: 'callout',
        content: 'Remember the field context',
        richText: [{ text: 'Remember', bold: true }, { text: ' the field context' }],
      },
      0,
    ),
  );

  assert.match(html, /<aside/);
  assert.match(html, /Callout/);
  assert.match(html, /bg-\[#f7f3e8\]/);
  assert.match(html, /<strong[^>]*>Remember<\/strong>/);
  assert.match(html, /Remember/);
});

test('renderBlogSection renders headings and bullet lists inside callouts', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        blockType: 'callout',
        content: 'Field note',
        children: [
          {
            type: 'text',
            blockType: 'heading_3',
            content: 'What changed',
          },
          {
            type: 'text',
            blockType: 'bulleted_list_item',
            content: 'Participants reframed the goal',
          },
          {
            type: 'text',
            blockType: 'bulleted_list_item',
            content: 'Prototype language became simpler',
          },
        ],
      },
      0,
    ),
  );

  assert.match(html, /<aside/);
  assert.match(html, /<h3/);
  assert.match(html, /What changed/);
  assert.equal((html.match(/<ul/g) || []).length, 1);
  assert.equal((html.match(/<li/g) || []).length, 2);
  assert.match(html, /Participants reframed the goal/);
  assert.match(html, /Prototype language became simpler/);
});

test('renderBlogSection renders headings and inline annotations', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        blockType: 'heading_2',
        content: 'Important note',
        richText: [
          { text: 'Important', bold: true },
          { text: ' note', italic: true, underline: true, strikethrough: true, code: true },
        ],
      },
      0,
    ),
  );

  assert.match(html, /<h2/);
  assert.match(html, /<strong[^>]*>Important<\/strong>/);
  assert.match(html, /<em[^>]*>/);
  assert.match(html, /text-decoration-line:underline line-through|underline/);
  assert.match(html, /<code[^>]*>/);
  assert.match(html, /mt-10/);
  assert.match(html, /mb-7/);
  assert.match(html, /text-\[24px\]/);
});

test('renderBlogSection renders toggle sections with nested content', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'toggle',
        content: 'Read more',
        richText: [{ text: 'Read more' }],
        children: [
          {
            type: 'text',
            blockType: 'paragraph',
            content: 'Nested detail',
            richText: [{ text: 'Nested detail', bold: true }],
          },
        ],
      },
      1,
    ),
  );

  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /Read more/);
  assert.match(html, /Nested detail/);
});

test('renderBlogSection renders image sections inside toggles', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'toggle',
        content: 'Show process image',
        children: [
          {
            type: 'image',
            content: 'https://example.com/process.jpg',
            caption: 'Process sketch',
          },
        ],
      },
      1,
    ),
  );

  assert.match(html, /<details/);
  assert.match(html, /Show process image/);
  assert.match(html, /<img/);
  assert.match(html, /src="https:\/\/example\.com\/process\.jpg"/);
  assert.match(html, /Process sketch/);
});

test('renderBlogSection renders toggle heading summaries and nested lists', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'toggle',
        blockType: 'heading_2',
        content: 'Open findings',
        richText: [{ text: 'Open findings' }],
        children: [
          {
            type: 'text',
            blockType: 'bulleted_list_item',
            content: 'Interview synthesis',
            richText: [{ text: 'Interview synthesis' }],
          },
          {
            type: 'text',
            blockType: 'numbered_list_item',
            content: 'Prototype audit',
            richText: [{ text: 'Prototype audit' }],
          },
        ],
      },
      1,
    ),
  );

  assert.match(html, /<details/);
  assert.match(html, /aria-label="Toggle Open findings"/);
  assert.match(html, /text-\[24px\]/);
  assert.match(html, /<ul/);
  assert.match(html, /<ol/);
  assert.match(html, /<li[^>]*>Interview synthesis<\/li>/);
  assert.match(html, /<li[^>]*>Prototype audit<\/li>/);
});

test('renderBlogSection groups consecutive numbered list items inside toggles', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'toggle',
        content: 'Steps',
        children: [
          {
            type: 'text',
            blockType: 'numbered_list_item',
            content: 'Research',
          },
          {
            type: 'text',
            blockType: 'numbered_list_item',
            content: 'Prototype',
          },
          {
            type: 'text',
            blockType: 'numbered_list_item',
            content: 'Test',
          },
        ],
      },
      1,
    ),
  );

  assert.equal((html.match(/<ol/g) || []).length, 1);
  assert.equal((html.match(/<li/g) || []).length, 3);
  assert.match(html, /<li[^>]*>Research<\/li><li[^>]*>Prototype<\/li><li[^>]*>Test<\/li>/);
});

test('renderBlogSections groups consecutive top-level numbered list items', () => {
  const html = renderToStaticMarkup(
    <>
      {renderBlogSections([
        {
          type: 'text',
          blockType: 'numbered_list_item',
          content: 'Collect',
        },
        {
          type: 'text',
          blockType: 'numbered_list_item',
          content: 'Cluster',
        },
        {
          type: 'text',
          blockType: 'numbered_list_item',
          content: 'Publish',
        },
      ])}
    </>,
  );

  assert.equal((html.match(/<ol/g) || []).length, 1);
  assert.equal((html.match(/<li/g) || []).length, 3);
  assert.match(html, /<li[^>]*>Collect<\/li><li[^>]*>Cluster<\/li><li[^>]*>Publish<\/li>/);
});

test('renderBlogSection renders Notion column lists as responsive columns', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'column_list',
        columns: [
          {
            children: [
              { type: 'text', blockType: 'heading_3', content: 'Left' },
              { type: 'text', blockType: 'paragraph', content: 'Left body' },
            ],
          },
          {
            children: [
              { type: 'text', blockType: 'heading_3', content: 'Right' },
              { type: 'text', blockType: 'paragraph', content: 'Right body' },
            ],
          },
        ],
      },
      2,
    ),
  );

  assert.match(html, /grid-cols-1/);
  assert.match(html, /md:grid-cols-2/);
  assert.match(html, /Left body/);
  assert.match(html, /Right body/);
});

test('renderBlogSection renders code blocks with preformatted content and language label', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'code',
        content: 'const answer = 42;',
        language: 'typescript',
      },
      2,
    ),
  );

  assert.match(html, /<pre/);
  assert.match(html, /<code/);
  assert.match(html, /const answer = 42;/);
  assert.match(html, /typescript/i);
});

test('buildBlogQuickJumpItems derives quick navigation from heading_1 sections only', () => {
  const items = buildBlogQuickJumpItems([
    { type: 'text', blockType: 'heading_1', content: 'Architecture' },
    { type: 'text', blockType: 'paragraph', content: 'Body text' },
    { type: 'text', blockType: 'heading_1', content: 'Tradeoffs' },
  ]);

  assert.deepEqual(items, [
    { label: 'Architecture', anchorId: 'blog-section-architecture-0', index: 0 },
    { label: 'Tradeoffs', anchorId: 'blog-section-tradeoffs-2', index: 2 },
  ]);
});

test('renderBlogSection applies anchor id to heading sections when provided', () => {
  const html = renderToStaticMarkup(
    renderBlogSection(
      {
        type: 'text',
        blockType: 'heading_1',
        content: 'Architecture',
      },
      0,
      { anchorId: 'blog-section-architecture-0' },
    ),
  );

  assert.match(html, /id="blog-section-architecture-0"/);
});
