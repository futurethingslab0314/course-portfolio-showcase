export type SyncMode = 'changes' | 'full';
export interface SyncResult { warnings: unknown[]; changed?: number; deleted?: number; noChanges?: boolean; message?: string; }

export interface SyncProgress {
  stage: 'queued' | 'reading' | 'images' | 'saving' | 'complete' | 'failed';
  total: number;
  processed: number;
  uploaded: number;
  skipped: number;
  failed: number;
}

export interface ProjectSyncJob extends SyncProgress {
  id: string;
  slug: string;
  projectId: string;
  projectName: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  warnings: number;
  error?: string;
  mode?: SyncMode;
  changed?: number;
  deleted?: number;
  noChanges?: boolean;
  message?: string;
}
