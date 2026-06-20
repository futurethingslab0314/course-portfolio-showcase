import { randomUUID } from 'node:crypto';

export type CourseSyncJobStatus = 'queued' | 'running' | 'success' | 'failed';
export type CourseSyncAuthMethod = 'token' | 'secret';

export interface CourseSyncJobResult {
  runId?: string;
  slug?: string;
  [key: string]: unknown;
}

export interface CourseSyncJob {
  jobId: string;
  slug: string;
  authMethod?: CourseSyncAuthMethod;
  status: CourseSyncJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: CourseSyncJobResult;
  error?: string;
}

type StartCourseSyncJobParams = {
  slug: string;
  authMethod?: CourseSyncAuthMethod;
  syncCourse: (params: { slug: string }) => Promise<CourseSyncJobResult>;
  onSuccess?: (result: CourseSyncJobResult) => void | Promise<void>;
};

const jobs = new Map<string, CourseSyncJob>();
const maxJobs = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function cloneJob(job: CourseSyncJob): CourseSyncJob {
  return {
    ...job,
    result: job.result ? { ...job.result } : undefined,
  };
}

function rememberJob(job: CourseSyncJob) {
  jobs.set(job.jobId, job);
  while (jobs.size > maxJobs) {
    const oldest = jobs.keys().next().value;
    if (!oldest) break;
    jobs.delete(oldest);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function startCourseSyncJob(params: StartCourseSyncJobParams): CourseSyncJob {
  const createdAt = nowIso();
  const job: CourseSyncJob = {
    jobId: `course-sync-${Date.now()}-${randomUUID().slice(0, 8)}`,
    slug: params.slug,
    authMethod: params.authMethod,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
  };

  rememberJob(job);

  void Promise.resolve().then(async () => {
    job.status = 'running';
    job.startedAt = nowIso();
    job.updatedAt = job.startedAt;

    try {
      const result = await params.syncCourse({ slug: params.slug });
      await params.onSuccess?.(result);
      job.status = 'success';
      job.result = result;
      job.finishedAt = nowIso();
      job.updatedAt = job.finishedAt;
    } catch (error) {
      job.status = 'failed';
      job.error = errorMessage(error);
      job.finishedAt = nowIso();
      job.updatedAt = job.finishedAt;
      console.error(JSON.stringify({
        message: 'Background course sync failed',
        jobId: job.jobId,
        slug: job.slug,
        error: job.error,
      }));
    }
  });

  return cloneJob(job);
}

export function getCourseSyncJob(jobId: string): CourseSyncJob | undefined {
  const job = jobs.get(jobId);
  return job ? cloneJob(job) : undefined;
}

export function clearCourseSyncJobsForTest() {
  jobs.clear();
}
