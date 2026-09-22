import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { GalleryStory } from './GalleryStory';

const work = {
  id: 'gallery-story-1',
  assignmentName: 'Tracking Through Objects',
  members: ['Alice', 'Bob'],
  description: 'A story-driven gallery about everyday tracking.',
  mainImage: 'https://example.com/main.jpg',
  mainImageAsset: {
    original: 'https://example.com/main.jpg',
    thumbnail: 'https://example.com/main-thumb.webp',
    preview: 'https://example.com/main-preview.webp',
  },
  moreImages: ['https://example.com/detail-1.jpg', 'https://example.com/detail-2.jpg'],
  moreImageAssets: [
    { original: 'https://example.com/detail-1.jpg', thumbnail: 'https://example.com/detail-1-thumb.webp', preview: 'https://example.com/detail-1-preview.webp' },
    { original: 'https://example.com/detail-2.jpg', thumbnail: 'https://example.com/detail-2-thumb.webp', preview: 'https://example.com/detail-2-preview.webp' },
  ],
  tags: ['Everyday Tracking', 'Mapping'],
  sourceDatabaseId: 'db-gallery-story',
  methodologies: ['Mapping'],
  storyButtons: [{ label: 'Read More', url: 'https://example.com/story' }],
  year: '2026',
};

test('GalleryStory modal renders previous and next controls when multiple images are available', () => {
  const html = renderToStaticMarkup(
    <GalleryStory
      work={work}
      courseTitle="Critical Making"
      isExpanded={true}
      setIsExpanded={() => undefined}
      zoomedImage={work.mainImage}
      setZoomedImage={() => undefined}
    />,
  );

  assert.match(html, /aria-label="Previous image"/);
  assert.match(html, /aria-label="Next image"/);
  assert.match(html, /src="https:\/\/example\.com\/main-preview\.webp"/);
  assert.match(html, /src="https:\/\/example\.com\/detail-1-thumb\.webp"/);
  assert.doesNotMatch(html, /src="https:\/\/example\.com\/main\.jpg"/);
});

test('GalleryStory header label prefers the first keyword tag', () => {
  const html = renderToStaticMarkup(
    <GalleryStory
      work={work}
      courseTitle="Critical Making"
      isExpanded={false}
      setIsExpanded={() => undefined}
      zoomedImage={null}
      setZoomedImage={() => undefined}
    />,
  );

  assert.match(html, /Everyday Tracking/i);
});

test('GalleryStory header label falls back to the course title when no keyword tags exist', () => {
  const html = renderToStaticMarkup(
    <GalleryStory
      work={{ ...work, tags: undefined }}
      courseTitle="Critical Making"
      isExpanded={false}
      setIsExpanded={() => undefined}
      zoomedImage={null}
      setZoomedImage={() => undefined}
    />,
  );

  assert.match(html, /Critical Making/i);
});
