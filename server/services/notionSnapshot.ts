import { AsyncLocalStorage } from 'node:async_hooks';
import type { NotionPage } from './notion';
import type { StudentWork } from '../../src/types';

export const notionId = (value: string) => value.replace(/-/g, '').toLowerCase();
export interface NotionSnapshot {
  pages: Record<string, NotionPage>;
  queries: Record<string, string[]>;
  blogs: Record<string, NonNullable<StudentWork['blogContent']>>;
  removed: string[];
}
export const newNotionSnapshot = (): NotionSnapshot => ({ pages: {}, queries: {}, blogs: {}, removed: [] });
const context = new AsyncLocalStorage<{ snapshot: NotionSnapshot; replay: boolean }>();
export const notionSnapshotContext = () => context.getStore();
export function withNotionSnapshot<T>(snapshot: NotionSnapshot, replay: boolean, run: () => Promise<T>) {
  return context.run({ snapshot, replay }, run);
}
export const queryKey = (database: string, body: Record<string, unknown>) => `${notionId(database)}:${JSON.stringify(body)}`;
export function removeSnapshotPage(snapshot: NotionSnapshot, id: string) {
  const key = notionId(id);
  delete snapshot.pages[key]; delete snapshot.blogs[key];
  if (!snapshot.removed.includes(key)) snapshot.removed.push(key);
  for (const ids of Object.values(snapshot.queries)) {
    const index = ids.indexOf(key);
    if (index !== -1) ids.splice(index, 1);
  }
}
