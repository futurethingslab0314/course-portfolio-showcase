import React, { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, TriangleAlert, ExternalLink } from 'lucide-react';
import { CourseSyncJob, startCourseSync, waitForCourseSyncJob } from '../../data/syncCourseButton';
import { cn } from '../../lib/utils';

function statusCopy(status: CourseSyncJob['status']): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export const AdminSyncCourseTemplate = () => {
  const [slug, setSlug] = useState('');
  const [token, setToken] = useState('');
  const [job, setJob] = useState<CourseSyncJob | null>(null);
  const [statusUrl, setStatusUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = useMemo(() => isSubmitting || job?.status === 'queued' || job?.status === 'running', [isSubmitting, job?.status]);

  const handleStart = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setJob(null);
    setStatusUrl('');

    try {
      const response = await startCourseSync({ slug: slug.trim(), token: token.trim() });

      if (response.statusUrl) {
        setStatusUrl(response.statusUrl);
      }

      if (response.ok && response.accepted && response.statusUrl) {
        const nextJob = await waitForCourseSyncJob(response.statusUrl, {
          onUpdate: (snapshot) => setJob(snapshot),
        });
        setJob(nextJob);
        return;
      }

      if (response.ok && response.status === 'success' && response.runId) {
        setJob({
          jobId: response.runId,
          slug: response.slug || slug.trim(),
          status: 'success',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          result: { runId: response.runId, slug: response.slug || slug.trim() },
        });
        return;
      }

      if (response.ok && response.status === 'failed') {
        setJob({
          jobId: response.runId || `failed-${Date.now()}`,
          slug: response.slug || slug.trim(),
          status: 'failed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: response.error || response.detail || 'Sync failed.',
        });
        return;
      }

      setError('Sync request was accepted but no usable status was returned.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#ffffff_45%,_#eef2ff_100%)]">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-blue-600 mb-4">Admin Tools</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter leading-[0.95] mb-4">
            Sync Course Monitor
          </h1>
          <p className="text-black/55 text-base md:text-lg max-w-2xl">
            Start a course sync, then watch the job move from queued to running to success or failed.
          </p>
        </div>

        <form onSubmit={handleStart} className="bg-white/85 backdrop-blur-md border border-black/8 shadow-2xl shadow-black/5 rounded-3xl p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="basic-design-02"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">Token</span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="sync token"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              type="submit"
              disabled={isBusy || !slug.trim() || !token.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-black text-white px-5 py-3 text-[11px] font-bold uppercase tracking-[0.25em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/85 transition-colors"
            >
              <RefreshCw size={14} className={cn(isBusy && 'animate-spin')} />
              {isBusy ? 'Syncing...' : 'Start Sync'}
            </button>

            {statusUrl ? (
              <a
                href={statusUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.25em] text-black/55 hover:bg-black/5 transition-colors"
              >
                <ExternalLink size={14} />
                Open Status
              </a>
            ) : null}
          </div>
        </form>

        <div className="mt-8 grid gap-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-sm uppercase tracking-[0.15em] mb-1">Error</div>
                <div className="text-sm leading-relaxed">{error}</div>
              </div>
            </div>
          ) : null}

          {job ? (
            <div className="rounded-3xl border border-black/8 bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-black/30 mb-2">Current Status</div>
                  <div className="text-2xl md:text-3xl font-bold tracking-tighter">{statusCopy(job.status)}</div>
                </div>
                <div className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.25em] border',
                  job.status === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  job.status === 'failed' && 'border-red-200 bg-red-50 text-red-700',
                  (job.status === 'queued' || job.status === 'running') && 'border-blue-200 bg-blue-50 text-blue-700',
                )}>
                  <ShieldCheck size={14} />
                  {job.jobId}
                </div>
              </div>

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl bg-black/3 p-4">
                  <dt className="text-black/35 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Slug</dt>
                  <dd className="font-medium">{job.slug}</dd>
                </div>
                <div className="rounded-2xl bg-black/3 p-4">
                  <dt className="text-black/35 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Updated</dt>
                  <dd className="font-medium">{new Date(job.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>

              {job.result ? (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 mb-2">Upload Complete</div>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap text-emerald-950/80">{JSON.stringify(job.result, null, 2)}</pre>
                </div>
              ) : null}

              {job.error ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-700 mb-2">Failure</div>
                  <p className="text-sm text-red-800">{job.error}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
