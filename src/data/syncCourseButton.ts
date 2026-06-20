export type CourseSyncJobStatus = 'queued' | 'running' | 'success' | 'failed';

export interface CourseSyncJob {
  jobId: string;
  slug: string;
  status: CourseSyncJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface CourseSyncStartResponse {
  ok: boolean;
  accepted?: boolean;
  authMethod?: 'token' | 'secret';
  jobId?: string;
  status?: CourseSyncJobStatus;
  statusUrl?: string;
  runId?: string;
  slug?: string;
  error?: string;
  detail?: string;
  hint?: string;
}

export interface CourseSyncJobResponse {
  ok: boolean;
  job: CourseSyncJob;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: T | Record<string, unknown> = {} as T;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = {} as T;
    }
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'detail' in body
      ? String((body as Record<string, unknown>).detail || (body as Record<string, unknown>).error || 'Request failed')
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function startCourseSync(params: {
  slug: string;
  token: string;
  wait?: boolean;
  secret?: string;
}): Promise<CourseSyncStartResponse> {
  const url = new URL('/api/admin/sync-course-button', window.location.origin);
  url.searchParams.set('slug', params.slug);
  url.searchParams.set('token', params.token);

  if (params.wait) {
    url.searchParams.set('wait', 'true');
  }
  if (params.secret) {
    url.searchParams.set('secret', params.secret);
  }

  const response = await fetch(url.toString(), { method: 'GET' });
  return readJson<CourseSyncStartResponse>(response);
}

export async function fetchCourseSyncJob(statusUrl: string): Promise<CourseSyncJobResponse> {
  const response = await fetch(statusUrl, { method: 'GET' });
  return readJson<CourseSyncJobResponse>(response);
}

export async function waitForCourseSyncJob(
  statusUrl: string,
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onUpdate?: (job: CourseSyncJob) => void;
  },
): Promise<CourseSyncJob> {
  const pollIntervalMs = options?.pollIntervalMs ?? 1200;
  const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000;
  const startedAt = Date.now();

  while (true) {
    const snapshot = await fetchCourseSyncJob(statusUrl);
    options?.onUpdate?.(snapshot.job);

    if (snapshot.job.status === 'success' || snapshot.job.status === 'failed') {
      return snapshot.job;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for course sync job to finish.');
    }

    await sleep(pollIntervalMs);
  }
}
