import test from 'node:test';
import assert from 'node:assert/strict';
import { readPageValue, updatePageValue } from './pageLinkState';

test('share links restore Unicode group names and individual work state', () => {
  let params = updatePageValue(new URLSearchParams(), 'project', 'project-2', '');
  params = updatePageValue(params, 'group', '第一組 & 設計', '');
  params = updatePageValue(params, 'open:work-1', true, false);
  const restored = new URLSearchParams(params.toString());
  assert.equal(readPageValue(restored, 'group', ''), '第一組 & 設計');
  assert.equal(readPageValue(restored, 'open:work-1', false), true);
});

test('switching project clears nested content; closing content preserves filters', () => {
  const initial = new URLSearchParams('project=p1&group=g1&year=2026&open%3Aw1=true');
  const closed = updatePageValue(initial, 'open:w1', false, false);
  assert.equal(closed.has('open:w1'), false);
  assert.equal(closed.get('year'), '2026');
  assert.equal(updatePageValue(initial, 'project', 'p2', '').toString(), 'project=p2');
});

test('changing group removes student and work selection while retaining year', () => {
  const params = updatePageValue(new URLSearchParams('student=A&open%3Aw1=true&year=2026'), 'group', 'g2', '');
  assert.equal(params.has('student'), false);
  assert.equal(params.has('open:w1'), false);
  assert.equal(params.get('year'), '2026');
});

test('malformed boolean and numeric values fall back safely', () => {
  const params = new URLSearchParams('starred=invalid&slide=oops');
  assert.equal(readPageValue(params, 'starred', false), false);
  assert.equal(readPageValue(params, 'slide', 0), 0);
});
