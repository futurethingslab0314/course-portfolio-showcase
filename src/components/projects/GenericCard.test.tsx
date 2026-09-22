import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveImageSource } from '../../lib/imageAssets';
import { StudentWork } from '../../types';
import { GenericCard, getGenericCardImageAssets } from './GenericCard';

const work: StudentWork = {
  id: 'generic-1', assignmentName: 'Generic', members: [], description: '',
  mainImage: 'main-original.jpg', sourceDatabaseId: 'db-generic',
  mainImageAsset: { original: 'main-original.jpg', thumbnail: 'main-thumb.webp', preview: 'main-preview.webp' },
  moreImages: ['more-original.jpg', 'main-original.jpg'],
  moreImageAssets: [
    { original: 'more-original.jpg', preview: 'more-preview.webp' },
    { original: 'main-original.jpg', preview: 'duplicate-main-preview.webp' },
  ],
};

test('GenericCard closed view uses the main thumbnail', () => {
  const html = renderToStaticMarkup(<GenericCard work={work} />);
  assert.match(html, /src="main-thumb\.webp"/);
  assert.doesNotMatch(html, /src="main-original\.jpg"/);
});

test('getGenericCardImageAssets preserves source order and removes duplicate originals', () => {
  const assets = getGenericCardImageAssets(work);
  assert.deepEqual(assets.map((asset) => asset.original), ['main-original.jpg', 'more-original.jpg']);
  assert.deepEqual(assets.map((asset) => resolveImageSource(asset, 'preview')), ['main-preview.webp', 'more-preview.webp']);
});
