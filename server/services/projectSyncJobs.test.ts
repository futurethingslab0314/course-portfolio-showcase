import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectJobStore } from './projectSyncJobs';
import { serializeSync } from './syncQueue';

test('duplicate assignment requests reuse a job and retain real progress', async () => {
  const store = createProjectJobStore();
  let finish!: () => void;
  const wait = new Promise<void>(r => { finish = r; });
  const input = { slug: 'course', projectId: 'project', projectName: 'Assignment' };
  const first = store.start(input, async report => {
    report({ stage: 'images', processed: 1, total: 2, uploaded: 1, skipped: 0, failed: 0 });
    await wait;
    return { warnings: [] };
  });
  assert.equal(store.start(input, async () => { throw new Error('duplicate'); }).id, first.id);
  await new Promise(r => setImmediate(r));
  assert.equal(store.get(first.id)?.processed, 1);
  finish();
  await new Promise(r => setImmediate(r));
  assert.equal(store.get(first.id)?.status, 'success');
});

test('sync queue serializes jobs and continues after failures', async () => {
  const order: number[] = [];
  const a = serializeSync(async () => { order.push(1); throw new Error('failure'); });
  const b = serializeSync(async () => { order.push(2); });
  await assert.rejects(a);
  await b;
  assert.deepEqual(order, [1, 2]);
});
