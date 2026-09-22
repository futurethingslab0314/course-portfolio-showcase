import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentWork } from '../../types';
import { getAdjacentGalleryAsset, getGalleryStoryAssets } from './galleryStoryLightbox';

const work: StudentWork = {
  id: 'story', assignmentName: 'Story', members: [], description: '', sourceDatabaseId: 'db',
  mainImage: 'main.jpg', mainImageAsset: { original: 'main.jpg', preview: 'main-preview.webp' },
  moreImages: ['b.jpg', 'a.jpg', 'b.jpg'],
  moreImageAssets: [
    { original: 'b.jpg', thumbnail: 'b-thumb.webp', preview: 'b-preview.webp' },
    { original: 'a.jpg', thumbnail: 'a-thumb.webp', preview: 'a-preview.webp' },
    { original: 'b.jpg', thumbnail: 'duplicate-b-thumb.webp' },
  ],
};

test('getGalleryStoryAssets keeps main first, preserves order, and removes duplicate originals', () => {
  assert.deepEqual(getGalleryStoryAssets(work).map((asset) => asset.original), ['main.jpg', 'b.jpg', 'a.jpg']);
});

test('getAdjacentGalleryAsset wraps in both directions by original identity', () => {
  const assets = getGalleryStoryAssets(work);
  assert.equal(getAdjacentGalleryAsset(assets, 'a.jpg', 1)?.original, 'main.jpg');
  assert.equal(getAdjacentGalleryAsset(assets, 'main.jpg', -1)?.original, 'a.jpg');
});

test('getAdjacentGalleryAsset falls back to the first asset for a missing identity', () => {
  assert.equal(getAdjacentGalleryAsset(getGalleryStoryAssets(work), 'missing.jpg', 1)?.original, 'main.jpg');
});
