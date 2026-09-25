import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentWork } from '../../types';
import { resolveImageSource } from '../../lib/imageAssets';
import { compareDataMatrixWorks, DataMatrix, getDataMatrixModalImage } from './DataMatrix';

test('categorized thumbnails sort by number then letter, with missing coordinates last', () => {
  const locations = ['A10', 'P2', 'A32', 'B1', undefined, 'A2', 'P1', 'A1', 'J1'];
  const works = locations.map((gridLocation, index) => ({
    id: String(index), gridLocation,
  } as StudentWork));
  assert.deepEqual(works.sort(compareDataMatrixWorks).map(work => work.gridLocation),
    ['A1', 'B1', 'J1', 'P1', 'A2', 'P2', 'A10', 'A32', undefined]);
});

test('same-coordinate thumbnails retain newest-year-first and ID tie ordering', () => {
  const works = [
    { id: 'b', gridLocation: 'A1', year: '2026' },
    { id: 'old', gridLocation: 'A1', year: '2025' },
    { id: 'a', gridLocation: 'A1', year: '2026' },
  ] as StudentWork[];
  assert.deepEqual(works.sort(compareDataMatrixWorks).map(work => work.id), ['a', 'b', 'old']);
});

test('DataMatrix renders columns through 32 and places work at A32', () => {
  const work: StudentWork = {
    id: 'matrix-a32',
    assignmentName: 'A32 Work',
    members: [],
    description: '',
    mainImage: 'https://example.com/a32.jpg',
    mainImageAsset: {
      original: 'https://example.com/a32.jpg',
      thumbnail: 'https://example.com/a32-thumb.webp',
      preview: 'https://example.com/a32-preview.webp',
    },
    sourceDatabaseId: 'data-matrix-test',
    gridLocation: 'A32',
  };

  const html = renderToStaticMarkup(<DataMatrix works={[work]} />);

  assert.match(html, /Coordinate System: A-P x 1-32/);
  assert.match(html, /src="https:\/\/example\.com\/a32-thumb\.webp"/);
  assert.doesNotMatch(html, /src="https:\/\/example\.com\/a32\.jpg"/);
  assert.equal(resolveImageSource(getDataMatrixModalImage(work), 'preview'), 'https://example.com/a32-preview.webp');
});
