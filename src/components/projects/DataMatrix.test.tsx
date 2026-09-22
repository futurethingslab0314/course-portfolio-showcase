import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentWork } from '../../types';
import { DataMatrix } from './DataMatrix';

test('DataMatrix renders columns through 32 and places work at A32', () => {
  const work: StudentWork = {
    id: 'matrix-a32',
    assignmentName: 'A32 Work',
    members: [],
    description: '',
    mainImage: 'https://example.com/a32.jpg',
    sourceDatabaseId: 'data-matrix-test',
    gridLocation: 'A32',
  };

  const html = renderToStaticMarkup(<DataMatrix works={[work]} />);

  assert.match(html, /Coordinate System: A-P x 1-32/);
  assert.match(html, /src="https:\/\/example\.com\/a32\.jpg"/);
});
