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
  ];

  const uploaded: string[] = [];

  const result = await rewriteBlogContentImagesToR2ForTest(blogContent, async (sourceUrl) => {
    uploaded.push(sourceUrl);
    return `https://r2.example/${uploaded.length}`;
  });

  assert.deepEqual(uploaded, ['https://notion.site/image-1', 'https://notion.site/image-2']);
  assert.equal(result.uploaded, 2);
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
  ]);
});

test('rewriteWorkMediaToR2ForTest rewrites interactionPart icon urls to R2', async () => {
  const work: StudentWork = {
    id: 'card-case-1',
    assignmentName: 'Case 1',
    members: ['Student 01'],
    description: '',
    mainImage: 'https://notion.site/main-image',
    interactionPart: 'https://notion.site/body-icon',
    sourceDatabaseId: 'db-card-case',
  };

  const uploaded: string[] = [];

  await rewriteWorkMediaToR2ForTest(work, async (sourceUrl) => {
    uploaded.push(sourceUrl);
    return `https://r2.example/${uploaded.length}`;
  });

  assert.deepEqual(uploaded, ['https://notion.site/main-image', 'https://notion.site/body-icon']);
  assert.equal(work.mainImage, 'https://r2.example/1');
  assert.equal(work.interactionPart, 'https://r2.example/2');
});
