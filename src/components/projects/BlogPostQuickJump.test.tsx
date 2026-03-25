import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlogQuickJumpNav } from './BlogPostQuickJump';

test('BlogQuickJumpNav highlights the active quick jump item', () => {
  const html = renderToStaticMarkup(
    <BlogQuickJumpNav
      items={[
        { label: 'Architecture', anchorId: 'blog-section-architecture-0', index: 0 },
        { label: 'Tradeoffs', anchorId: 'blog-section-tradeoffs-2', index: 2 },
      ]}
      activeAnchorId="blog-section-tradeoffs-2"
    />,
  );

  assert.match(html, /Quick Jump/);
  assert.match(html, /href="#blog-section-architecture-0"/);
  assert.match(html, /href="#blog-section-tradeoffs-2"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /border-black bg-black px-3 py-1\.5 text-xs font-semibold text-white/);
});
