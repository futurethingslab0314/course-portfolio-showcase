import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderBlogSection } from './BlogPostContent';

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
