import test from 'node:test';
import assert from 'node:assert/strict';
import { findActiveHeadingAnchorId } from './blogPostScroll';

test('findActiveHeadingAnchorId picks the latest heading above the viewport threshold', () => {
  const active = findActiveHeadingAnchorId(
    [
      { label: 'Intro', anchorId: 'intro', index: 0 },
      { label: 'Architecture', anchorId: 'architecture', index: 1 },
      { label: 'Tradeoffs', anchorId: 'tradeoffs', index: 2 },
    ],
    {
      intro: -120,
      architecture: 48,
      tradeoffs: 360,
    },
    120,
  );

  assert.equal(active, 'architecture');
});
