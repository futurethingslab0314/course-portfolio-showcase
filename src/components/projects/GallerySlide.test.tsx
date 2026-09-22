import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveImageSource } from '../../lib/imageAssets';
import { StudentWork } from '../../types';
import { GallerySlide, getGallerySlideAssets } from './GallerySlide';

const work: StudentWork = {
  id: 'slide', assignmentName: 'Slide', members: [], description: '', sourceDatabaseId: 'db',
  mainImage: 'main.jpg', mainImageAsset: { original: 'main.jpg', preview: 'main-preview.webp' },
  moreImages: ['next.jpg'], moreImageAssets: [{ original: 'next.jpg', preview: 'next-preview.webp' }],
};

test('GallerySlide stage uses preview instead of original', () => {
  const html = renderToStaticMarkup(<GallerySlide work={work} />);
  assert.match(html, /src="main-preview\.webp"/);
  assert.doesNotMatch(html, /src="main\.jpg"/);
});

test('getGallerySlideAssets supplies preview assets in source order', () => {
  assert.deepEqual(
    getGallerySlideAssets(work).map((asset) => resolveImageSource(asset, 'preview')),
    ['main-preview.webp', 'next-preview.webp'],
  );
});
