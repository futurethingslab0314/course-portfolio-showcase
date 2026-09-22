import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildImageFallbackChain,
  getActiveImageFallbackIndex,
  getNextImageFallbackIndex,
  OptimizedImage,
} from './OptimizedImage';

test('OptimizedImage renders the requested thumbnail with lazy async loading', () => {
  const html = renderToStaticMarkup(
    <OptimizedImage
      asset={{ original: 'original.jpg', thumbnail: 'thumb.webp' }}
      variant="thumbnail"
      alt="Work"
      loading="lazy"
      referrerPolicy="no-referrer"
    />,
  );

  assert.match(html, /src="thumb\.webp"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /referrerPolicy="no-referrer"/);
});

test('buildImageFallbackChain is finite, ordered, and de-duplicated', () => {
  assert.deepEqual(
    buildImageFallbackChain({ original: 'o.jpg', preview: 'p.webp', thumbnail: 't.webp' }, 'thumbnail'),
    ['t.webp', 'p.webp', 'o.jpg'],
  );
  assert.deepEqual(
    buildImageFallbackChain({ original: 'o.jpg', preview: 'o.jpg' }, 'thumbnail'),
    ['o.jpg'],
  );
});

test('fallback progression stops after original', () => {
  assert.equal(getNextImageFallbackIndex(0, 3), 1);
  assert.equal(getNextImageFallbackIndex(1, 3), 2);
  assert.equal(getNextImageFallbackIndex(2, 3), 2);
});

test('a new image chain immediately resets a stale fallback index', () => {
  assert.equal(getActiveImageFallbackIndex('old-chain', 'new-chain', 2), 0);
  assert.equal(getActiveImageFallbackIndex('same-chain', 'same-chain', 2), 2);
});
