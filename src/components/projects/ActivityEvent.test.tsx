import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityEventCardContent, ActivityEventDetailContent } from './ActivityEventContent';

const work = {
  id: 'activity-1',
  assignmentName: 'CHI 2026 Research Presentation',
  members: ['Author A', 'Author B'],
  description: 'Presented a paper about collaborative AI systems.',
  mainImage: 'https://example.com/cover.jpg',
  moreImages: ['https://example.com/2.jpg'],
  sourceDatabaseId: 'db-activity',
  themeTag: 'Conference',
  startDate: '2026-03-01',
  endDate: '2026-03-03',
  country: 'Taiwan',
  city: 'Taipei',
  grant: 'NSTC',
  publicationName: 'CHI 2026',
  year: '2026',
  url: 'https://example.com/publication',
};

test('ActivityEvent renders card summary content', () => {
  const html = renderToStaticMarkup(<ActivityEventCardContent work={work} />);

  assert.match(html, /CHI 2026 Research Presentation/);
  assert.match(html, /Conference/);
  assert.match(html, /NSTC/);
  assert.match(html, /Taipei, Taiwan/);
});

test('ActivityEvent renders modal metadata when initially opened', () => {
  const html = renderToStaticMarkup(
    <ActivityEventDetailContent
      work={work}
      currentImageIndex={0}
      setCurrentImageIndex={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(html, /CHI 2026/);
  assert.match(html, /Author A/);
  assert.match(html, /2026-03-01/);
  assert.match(html, /2026-03-03/);
  assert.match(html, /https:\/\/example\.com\/publication/);
});
