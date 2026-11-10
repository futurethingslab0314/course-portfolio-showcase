import { randomUUID } from 'node:crypto';
import { ProjectSyncJob, SyncProgress } from '../../shared/adminSync';

export function createProjectJobStore() {
  const jobs = new Map<string, ProjectSyncJob>();
  return {
    get(id: string) { const job = jobs.get(id); return job ? { ...job } : undefined; },
    start(input: { slug: string; projectId: string; projectName: string }, run: (report: (p: SyncProgress) => void) => Promise<{ warnings: unknown[] }>) {
      const active = [...jobs.values()].find(j => j.projectId === input.projectId && (j.status === 'queued' || j.status === 'running'));
      if (active) return { ...active };
      for (const [id, job] of jobs) {
        if (jobs.size < 50) break;
        if (job.status === 'success' || job.status === 'failed') jobs.delete(id);
      }
      if (jobs.size >= 50) throw new Error('Sync queue is full. Try again later.');
      const job: ProjectSyncJob = { ...input, id: randomUUID(), status: 'queued', stage: 'queued', total: 0, processed: 0, uploaded: 0, skipped: 0, failed: 0, warnings: 0 };
      jobs.set(job.id, job);
      void Promise.resolve().then(async () => {
        try {
          const result = await run(p => Object.assign(job, p, { status: 'running' }));
          Object.assign(job, { status: 'success', stage: 'complete', warnings: result.warnings.length });
        } catch (error) {
          Object.assign(job, { status: 'failed', stage: 'failed', error: error instanceof Error ? error.message : 'Sync failed' });
        }
      });
      return { ...job };
    },
  };
}
