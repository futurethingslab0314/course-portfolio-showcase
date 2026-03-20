import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { GalleryStory } from './GalleryStory';
import {
  getGalleryStoryImages,
  getGalleryStoryImageIndex,
  getNextGalleryStoryImage,
  getPrevGalleryStoryImage,
} from './galleryStoryLightbox';

const work = {
  id: 'gallery-story-1',
  assignmentName: 'Tracking Through Objects',
  members: ['Alice', 'Bob'],
  description: 'A story-driven gallery about everyday tracking.',
  mainImage: 'https://example.com/main.jpg',
  moreImages: ['https://example.com/detail-1.jpg', 'https://example.com/detail-2.jpg'],
  sourceDatabaseId: 'db-gallery-story',
  methodologies: ['Mapping'],
  storyButtons: [{ label: 'Read More', url: 'https://example.com/story' }],
  year: '2026',
};

test('getGalleryStoryImages keeps main image first and removes duplicates', () => {
  assert.deepEqual(
    getGalleryStoryImages(work.mainImage, [work.mainImage, ...(work.moreImages ?? [])]),
    ['https://example.com/main.jpg', 'https://example.com/detail-1.jpg', 'https://example.com/detail-2.jpg'],
  );
});

test('gallery-story lightbox helpers navigate forward and backward cyclically', () => {
  const images = getGalleryStoryImages(work.mainImage, work.moreImages);

  assert.equal(getGalleryStoryImageIndex(images, 'https://example.com/detail-1.jpg'), 1);
  assert.equal(getNextGalleryStoryImage(images, 'https://example.com/detail-2.jpg'), 'https://example.com/main.jpg');
  assert.equal(getPrevGalleryStoryImage(images, 'https://example.com/main.jpg'), 'https://example.com/detail-2.jpg');
});

test('GalleryStory modal renders previous and next controls when multiple images are available', () => {
  const html = renderToStaticMarkup(
    <GalleryStory
      work={work}
      isExpanded={true}
      setIsExpanded={() => undefined}
      zoomedImage={work.mainImage}
      setZoomedImage={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Previous image"/);
  assert.match(html, /aria-label="Next image"/);
});
