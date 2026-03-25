import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderBlogSection } from './BlogPostContent';
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
  assert.match(tableHtml, /href="https:\/\/example\.com\/resource"/);
  assert.match(tableHtml, /rel="noopener noreferrer"/);
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
