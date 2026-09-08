import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExternalProject } from './ExternalProject';

test('embeds external URLs with a named frame and direct link', () => {
  const html = renderToStaticMarkup(<ExternalProject title="Exhibit" url="https://example.com/exhibit" />);
  assert.match(html, /<iframe/);
  assert.match(html, /title="Exhibit"/);
  assert.match(html, /src="https:\/\/example.com\/exhibit"/);
  assert.match(html, /href="https:\/\/example.com\/exhibit"/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test('invalid or missing external URLs show an empty state without embedding', () => {
  for (const url of [undefined, '', 'javascript:alert(1)', 'data:text/html,test', '/relative']) {
    const html = renderToStaticMarkup(<ExternalProject title="Exhibit" url={url} />);
    assert.doesNotMatch(html, /<iframe|href=/);
    assert.match(html, /尚未設定有效的外部連結/);
  }
});
