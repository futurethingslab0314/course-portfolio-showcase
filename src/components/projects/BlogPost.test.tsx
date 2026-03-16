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
