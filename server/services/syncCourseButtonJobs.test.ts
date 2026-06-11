import test from 'node:test';
import assert from 'node:assert/strict';
import { clearCourseSyncJobsForTest, getCourseSyncJob, startCourseSyncJob } from './syncCourseButtonJobs';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flushAsyncWork() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

test.afterEach(() => {
  clearCourseSyncJobsForTest();
});

test('startCourseSyncJob returns before the sync finishes and records success', async () => {
  const sync = deferred<{ runId: string; slug: string }>();
  let cacheInvalidated = false;

  const job = startCourseSyncJob({
    slug: 'basic-design-02',
    authMethod: 'secret',
    syncCourse: async () => sync.promise,
    onSuccess: () => {
      cacheInvalidated = true;
    },
  });

  assert.equal(job.slug, 'basic-design-02');
  assert.equal(job.status, 'queued');
  assert.equal(cacheInvalidated, false);

  await Promise.resolve();
  assert.equal(getCourseSyncJob(job.jobId)?.status, 'running');

  sync.resolve({ runId: 'sync-1', slug: 'basic-design-02' });
  await flushAsyncWork();

  const completed = getCourseSyncJob(job.jobId);
  assert.equal(completed?.status, 'success');
  assert.equal(completed?.result?.runId, 'sync-1');
  assert.equal(cacheInvalidated, true);
});

test('startCourseSyncJob records failures without throwing to the caller', async () => {
  const sync = deferred<{ runId: string }>();
  const originalConsoleError = console.error;
  console.error = () => undefined;

  const job = startCourseSyncJob({
    slug: 'basic-design-02',
    syncCourse: async () => sync.promise,
  });

  try {
    await Promise.resolve();
    sync.reject(new Error('R2 upload timed out'));
    await assert.rejects(sync.promise, /R2 upload timed out/);
    await flushAsyncWork();

    const failed = getCourseSyncJob(job.jobId);
    assert.equal(failed?.status, 'failed');
    assert.match(failed?.error || '', /R2 upload timed out/);
  } finally {
    console.error = originalConsoleError;
  }
});
