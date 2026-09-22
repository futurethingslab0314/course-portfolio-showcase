import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentWork } from '../../types';
import { CardCase } from './CardCase';

test('CardCase loads the thumbnail lazily while keeping the preview URL available for the modal', () => {
  const work = {
    id: 'case-image-variants',
    assignmentName: 'Image Variants',
    members: [],
    description: '',
    mainImage: 'https://r2.example/original.jpg',
    mainImageThumbnail: 'https://r2.example/thumbnail.webp',
    mainImagePreview: 'https://r2.example/preview.webp',
    sourceDatabaseId: 'db-card-case',
  } as StudentWork & { mainImageThumbnail: string; mainImagePreview: string };

  const html = renderToStaticMarkup(<CardCase work={work} />);

  assert.match(html, /src="https:\/\/r2\.example\/thumbnail\.webp"/);
  assert.match(html, /data-preview-src="https:\/\/r2\.example\/preview\.webp"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.doesNotMatch(html, /src="https:\/\/r2\.example\/original\.jpg"/);
});
