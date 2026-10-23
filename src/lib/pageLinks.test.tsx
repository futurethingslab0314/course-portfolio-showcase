import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PageLinkProvider } from './usePageLinkState';
import { GenericCard } from '../components/projects/GenericCard';
import { BlogPost } from '../components/projects/BlogPost';
import { GallerySlide } from '../components/projects/GallerySlide';
import { CardCase } from '../components/projects/CardCase';
import { ActivityEvent } from '../components/projects/ActivityEvent';
import { StudentWork } from '../types';
import { DataMatrix } from '../components/projects/DataMatrix';

const work = { id: 'w1', assignmentName: 'Shared work', members: [], description: 'Work detail', mainImage: 'cover.jpg', moreImages: ['second.jpg'], sourceDatabaseId: 'db' } as StudentWork;
function renderLink(content: React.ReactNode, query: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[`/course/test?${query}`]}><PageLinkProvider>{content}</PageLinkProvider></MemoryRouter>);
}

test('a shared work link opens its detail without a click and restores the image', () => {
  const html = renderLink(<GenericCard work={work} />, 'open%3Aw1=true&slide%3Aw1=1');
  assert.match(html, /role="dialog"/);
  assert.match(html, /src="second.jpg"/);
  assert.doesNotMatch(renderLink(<GenericCard work={work} />, ''), /role="dialog"/);
});

test('article, event, card case and slide links restore their open content', () => {
  for (const Component of [BlogPost, ActivityEvent, CardCase, GallerySlide]) {
    const closed = renderLink(<Component work={work} />, '');
    const opened = renderLink(<Component work={work} />, 'open%3Aw1=true');
    assert.ok(opened.length > closed.length, `${Component.name} should render open detail`);
  }
});

test('an unrelated work remains closed and out-of-range slide links render safely', () => {
  assert.doesNotMatch(renderLink(<GenericCard work={work} />, 'open%3Aother=true'), /role="dialog"/);
  const html = renderLink(<GallerySlide work={work} />, 'open%3Aw1=true&slide%3Aw1=999');
  assert.match(html, /src="second.jpg"/);
});

test('matrix links restore the selected record and categorized view', () => {
  const html = renderLink(<DataMatrix works={[work]} />, 'matrixWork=w1&matrixView=categorized');
  assert.match(html, /Matrix Entry:/);
  assert.match(html, /Shared work/);
  assert.doesNotMatch(renderLink(<DataMatrix works={[work]} />, ''), /Matrix Entry:/);
});
