import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentWork } from '../../types';
import { CardSpec } from './CardSpec';

const work: StudentWork = {
  id: 'spec', assignmentName: 'Spec', members: [], description: '', sourceDatabaseId: 'db',
  mainImage: 'spec-original.jpg',
  mainImageAsset: { original: 'spec-original.jpg', thumbnail: 'spec-thumb.webp', preview: 'spec-preview.webp' },
};

test('CardSpec inline media uses thumbnail', () => {
  const html = renderToStaticMarkup(<CardSpec work={work} zoomedImage={null} setZoomedImage={() => undefined} />);
  assert.match(html, /src="spec-thumb\.webp"/);
  assert.doesNotMatch(html, /src="spec-original\.jpg"/);
});

test('CardSpec modal uses preview while retaining original identity', () => {
  const html = renderToStaticMarkup(<CardSpec work={work} zoomedImage="spec-original.jpg" setZoomedImage={() => undefined} />);
  assert.match(html, /src="spec-preview\.webp"/);
  assert.doesNotMatch(html, /src="spec-original\.jpg"/);
});
