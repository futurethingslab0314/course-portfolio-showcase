import assert from 'node:assert/strict';
import test from 'node:test';
import { getMainImageAsset, getMoreImageAssets, resolveImageSource } from './imageAssets';

test('resolveImageSource follows thumbnail and preview fallback order', () => {
  const asset = { original: 'original.jpg', preview: 'preview.webp' };

  assert.equal(resolveImageSource(asset, 'thumbnail'), 'preview.webp');
  assert.equal(resolveImageSource(asset, 'preview'), 'preview.webp');
  assert.equal(resolveImageSource(asset, 'original'), 'original.jpg');
});

test('legacy flat main image fields become an ImageAsset', () => {
  const asset = getMainImageAsset({
    mainImage: 'original.jpg',
    mainImageThumbnail: 'thumb.webp',
    mainImagePreview: 'preview.webp',
  });

  assert.deepEqual(asset, {
    original: 'original.jpg',
    thumbnail: 'thumb.webp',
    preview: 'preview.webp',
  });
});

test('more image assets preserve original array order', () => {
  const assets = getMoreImageAssets({
    moreImages: ['b.jpg', 'a.jpg'],
    moreImageAssets: [
      { original: 'b.jpg', thumbnail: 'b-thumb.webp' },
      { original: 'a.jpg', thumbnail: 'a-thumb.webp' },
    ],
  });

  assert.deepEqual(assets.map((asset) => asset.original), ['b.jpg', 'a.jpg']);
});
