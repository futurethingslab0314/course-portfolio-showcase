import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteBlogContentImagesToR2ForTest, rewriteWorkMediaToR2ForTest } from './syncToSupabase';
import { StudentWork } from '../../src/types';

test('rewriteBlogContentImagesToR2ForTest rewrites nested blog image sections to R2 URLs', async () => {
  const blogContent: NonNullable<StudentWork['blogContent']> = [
    { type: 'text', content: 'Intro', blockType: 'paragraph' },
    { type: 'image', content: 'https://notion.site/image-1', caption: 'Hero' },
    {
      type: 'toggle',
      content: 'Details',
      children: [
        { type: 'image', content: 'https://notion.site/image-2', caption: 'Nested' },
      ],
    },
    {
      type: 'text',
      blockType: 'callout',
      content: 'Field note',
      children: [
        { type: 'image', content: 'https://notion.site/image-3', caption: 'Callout nested' },
      ],
    },
  ];

  const uploaded: string[] = [];

  const result = await rewriteBlogContentImagesToR2ForTest(blogContent, async (sourceUrl) => {
    uploaded.push(sourceUrl);
    return `https://r2.example/${uploaded.length}`;
  });

  assert.deepEqual(uploaded, ['https://notion.site/image-1', 'https://notion.site/image-2', 'https://notion.site/image-3']);
  assert.equal(result.uploaded, 3);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.blogContent, [
    { type: 'text', content: 'Intro', blockType: 'paragraph' },
    { type: 'image', content: 'https://r2.example/1', caption: 'Hero' },
    {
      type: 'toggle',
      content: 'Details',
      children: [
        { type: 'image', content: 'https://r2.example/2', caption: 'Nested' },
      ],
    },
    {
      type: 'text',
      blockType: 'callout',
      content: 'Field note',
      children: [
        { type: 'image', content: 'https://r2.example/3', caption: 'Callout nested' },
      ],
    },
  ]);
});

test('rewriteWorkMediaToR2ForTest stores main and ordered gallery assets', async () => {
  const work: StudentWork = {
    id: 'work-1',
    assignmentName: 'Work 1',
    members: [],
    description: '',
    mainImage: 'main.jpg',
    moreImages: ['second.jpg', 'first.jpg'],
    sourceDatabaseId: 'db-1',
  };

  await rewriteWorkMediaToR2ForTest(work, async ({ sourceUrl }) => {
    const stem = sourceUrl.replace(/\.[^.]+$/, '');
    return {
      asset: {
        original: `r2/${sourceUrl}`,
        thumbnail: `r2/${stem}-thumbnail.webp`,
        preview: `r2/${stem}-preview.webp`,
      },
      uploaded: true,
    };
  });

  assert.equal(work.mainImage, 'r2/main.jpg');
  assert.equal(work.mainImageThumbnail, 'r2/main-thumbnail.webp');
  assert.equal(work.mainImageAsset?.preview, 'r2/main-preview.webp');
  assert.deepEqual(work.moreImages, ['r2/second.jpg', 'r2/first.jpg']);
  assert.deepEqual(work.moreImageAssets?.map((asset) => asset.original), ['r2/second.jpg', 'r2/first.jpg']);
});

test('rewriteWorkMediaToR2ForTest keeps original when variant generation warns', async () => {
  const work: StudentWork = {
    id: 'unsupported',
    assignmentName: 'Unsupported',
    members: [],
    description: '',
    mainImage: 'unsupported.heic',
    sourceDatabaseId: 'db-1',
  };

  await rewriteWorkMediaToR2ForTest(work, async () => ({
    asset: { original: 'r2/unsupported.heic' },
    uploaded: true,
    warning: 'Variant conversion failed',
  }));

  assert.equal(work.mainImage, 'r2/unsupported.heic');
  assert.deepEqual(work.mainImageAsset, { original: 'r2/unsupported.heic' });
  assert.equal(work.mainImagePreview, undefined);
});
