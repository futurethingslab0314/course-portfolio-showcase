import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { buildCoursePayloadBySlug, generateCourseWebsite } from './services/generator';
import { executeFunctionTool, listFunctionTools } from './services/mappingPipeline';
import { fetchAllCourses } from './services/notion';
import { fetchCoursePayloadBySlugFromSupabase, fetchCoursesFromSupabase, shouldReadFromSupabase } from './services/supabase';
import { syncAllCoursesToSupabase, syncCourseToSupabase } from './services/syncToSupabase';
import { syncCourseLink, syncProjectMappings, validateSyncSecret } from './services/webhookSync';
import { CoursePayload } from '../shared/contracts';
import { Course } from '../src/types';

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 8787);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const distDir = path.resolve(process.cwd(), 'dist');
const hasFrontendBuild = fs.existsSync(path.join(distDir, 'index.html'));
const coursePayloadCacheTtlMs = Number(process.env.COURSE_PAYLOAD_CACHE_TTL_MS || 60_000);
const coursesCacheTtlMs = Number(process.env.COURSES_CACHE_TTL_MS || 60_000);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const coursePayloadCache = new Map<string, CacheEntry<CoursePayload>>();
let coursesCache: CacheEntry<Course[]> | null = null;

function nowMs(): number {
  return Date.now();
}

function cacheGet<T>(entry: CacheEntry<T> | null | undefined): T | null {
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) return null;
  return entry.value;
}

function cacheSet<T>(value: T, ttlMs: number): CacheEntry<T> {
  return {
    value,
    expiresAt: nowMs() + Math.max(0, ttlMs),
  };
}

function invalidateAllApiCache() {
  coursePayloadCache.clear();
  coursesCache = null;
}

function readStringCandidate(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function pickFromObject(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const exact = readStringCandidate(obj[key]);
    if (exact) return exact;
    const lower = readStringCandidate(obj[key.toLowerCase()]);
    if (lower) return lower;
    const upper = readStringCandidate(obj[key.toUpperCase()]);
    if (upper) return upper;
  }
  return '';
}

function pickFromRequest(req: express.Request, keys: string[]): string {
  const queryFirst = pickFromObject(req.query, keys);
  if (queryFirst) return queryFirst;

  const body = req.body;
  const fromBody = pickFromObject(body, keys);
  if (fromBody) return fromBody;

  const fromData = pickFromObject(body?.data, keys);
  if (fromData) return fromData;

  const fromPage = pickFromObject(body?.page, keys);
  if (fromPage) return fromPage;

  const fromProperties = pickFromObject(body?.properties, keys);
  if (fromProperties) return fromProperties;

  return '';
}

function parseBooleanLike(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return defaultValue;
}

function parseNotionStatusCode(message: string): number | null {
  const match = message.match(/Notion API error \((\d+)\)/);
  if (!match) return null;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function buildCoursesDiagnostics(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  const notionStatus = parseNotionStatusCode(message);

  let likelyCause = 'Unknown';
  let suggestion = 'Check server logs and verify Notion integration configuration.';

  if (message.includes('Missing required env var')) {
    likelyCause = 'Missing environment variable';
    suggestion = 'Set NOTION_TOKEN, NOTION_DB_COURSES_ID, NOTION_DB_PROJECTS_ID, BASE_URL in Railway and redeploy.';
  } else if (notionStatus === 401) {
    likelyCause = 'Invalid NOTION_TOKEN';
    suggestion = 'Use the correct Internal Integration Token (ntn_...) in NOTION_TOKEN.';
  } else if (notionStatus === 403) {
    likelyCause = 'Notion integration has no access';
    suggestion = 'Share Courses/Projects/Source databases with the integration.';
  } else if (notionStatus === 404) {
    likelyCause = 'Database ID is invalid or inaccessible';
    suggestion = 'Verify NOTION_DB_COURSES_ID and integration access to that database.';
  } else if (notionStatus === 429) {
    likelyCause = 'Notion rate limit';
    suggestion = 'Retry after a delay.';
  }

  return {
    endpoint: '/api/courses',
    message,
    notionStatus,
    likelyCause,
    suggestion,
    envCheck: {
      NOTION_TOKEN: Boolean(process.env.NOTION_TOKEN),
      NOTION_DB_COURSES_ID: Boolean(process.env.NOTION_DB_COURSES_ID),
      NOTION_DB_PROJECTS_ID: Boolean(process.env.NOTION_DB_PROJECTS_ID),
      NOTION_API_VERSION: process.env.NOTION_API_VERSION || '(default: 2022-06-28)',
      BASE_URL: process.env.BASE_URL || '(missing)',
    },
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/course/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const forceRefresh = String(req.query.refresh ?? 'false') === 'true';
    const cacheKey = slug.toLowerCase();

    if (!forceRefresh) {
      const cached = cacheGet(coursePayloadCache.get(cacheKey));
      if (cached) {
        res.set('X-Server-Cache', 'HIT');
        res.json(cached);
        return;
      }
    }

    let payload: CoursePayload;
    if (shouldReadFromSupabase()) {
      try {
        payload = await fetchCoursePayloadBySlugFromSupabase(slug);
      } catch (supabaseError) {
        payload = await buildCoursePayloadBySlug(slug);
        payload.warnings.push({
          level: 'warning',
          code: 'SUPABASE_READ_FALLBACK_TO_NOTION',
          message: supabaseError instanceof Error ? supabaseError.message : 'Supabase read failed; fallback to Notion.',
          courseId: payload.course.id,
        });
      }
    } else {
      payload = await buildCoursePayloadBySlug(slug);
    }

    coursePayloadCache.set(cacheKey, cacheSet(payload, coursePayloadCacheTtlMs));
    res.set('X-Server-Cache', forceRefresh ? 'REFRESH' : 'MISS');
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

app.get('/api/courses', async (_req, res) => {
  try {
    const forceRefresh = String(_req.query.refresh ?? 'false') === 'true';

    if (!forceRefresh) {
      const cached = cacheGet(coursesCache);
      if (cached) {
        res.set('X-Server-Cache', 'HIT');
        res.json({ courses: cached });
        return;
      }
    }

    let courses: Course[];
    if (shouldReadFromSupabase()) {
      try {
        courses = await fetchCoursesFromSupabase();
      } catch {
        courses = await fetchAllCourses();
      }
    } else {
      courses = await fetchAllCourses();
    }

    coursesCache = cacheSet(courses, coursesCacheTtlMs);
    res.set('X-Server-Cache', forceRefresh ? 'REFRESH' : 'MISS');
    res.json({ courses });
  } catch (error) {
    const diagnostics = buildCoursesDiagnostics(error);
    res.status(500).json({
      error: diagnostics.message,
      diagnostics,
    });
  }
});

app.post('/api/generate', async (req, res) => {
  const slug = String(req.body?.slug || '').trim();
  if (!slug) {
    res.status(400).json({ error: 'slug is required' });
    return;
  }

  try {
    const result = await generateCourseWebsite(slug, baseUrl);
    const statusCode = result.status === 'generated' ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown generate failure' });
  }
});

app.get('/api/function-tools', (_req, res) => {
  res.json(listFunctionTools());
});

app.post('/api/function-tools/:toolName', (req, res) => {
  const toolName = String(req.params.toolName || '').trim();
  const args = req.body && typeof req.body === 'object' ? req.body : {};
  if (!toolName) {
    res.status(400).json({ error: 'toolName is required' });
    return;
  }

  try {
    const result = executeFunctionTool(toolName, args);
    res.json({ ok: true, toolName, result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      toolName,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    });
  }
});

app.all('/api/admin/sync-course-link', async (req, res) => {
  const incomingSecret = String(req.get('x-sync-secret') || req.body?.secret || req.query?.secret || '').trim();
  const auth = validateSyncSecret(incomingSecret);
  if (!auth.ok) {
    res.status(401).json({ error: auth.message });
    return;
  }

  const coursePageId = pickFromRequest(req, ['coursePageId', 'pageId', 'page_id', 'id', 'Page ID']);
  const slug = pickFromRequest(req, ['slug', 'Slug']);
  if (!coursePageId && !slug) {
    res.status(400).json({ error: 'Missing target course identifier (coursePageId or slug).' });
    return;
  }

  try {
    const result = await syncCourseLink({ baseUrl, coursePageId, slug });
    invalidateAllApiCache();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync one course link',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.all('/api/admin/sync-project-mappings', async (req, res) => {
  const incomingSecret = String(req.get('x-sync-secret') || req.body?.secret || req.query?.secret || '').trim();
  const auth = validateSyncSecret(incomingSecret);
  if (!auth.ok) {
    res.status(401).json({ error: auth.message });
    return;
  }

  const projectPageId = pickFromRequest(req, ['projectPageId', 'pageId', 'page_id', 'id', 'Page ID']);
  const sourceDatabaseId = pickFromRequest(req, ['sourceDatabaseId', 'sourceDatabaseID', 'SourceDatabaseId', 'SourceDatabaseID', 'Source DB ID']);
  const overwrite = String(req.body?.overwrite ?? req.query?.overwrite ?? 'false') === 'true';
  const forceReinfer = String(req.body?.forceReinfer ?? req.query?.forceReinfer ?? 'false') === 'true';
  if (!projectPageId && !sourceDatabaseId) {
    res.status(400).json({ error: 'Missing target project identifier (projectPageId or sourceDatabaseId).' });
    return;
  }

  try {
    const result = await syncProjectMappings({ projectPageId, sourceDatabaseId, overwrite, forceReinfer });
    invalidateAllApiCache();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync project mappings',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.all('/api/admin/sync-course-supabase', async (req, res) => {
  const incomingSecret = String(req.get('x-sync-secret') || req.body?.secret || req.query?.secret || '').trim();
  const auth = validateSyncSecret(incomingSecret);
  if (!auth.ok) {
    res.status(401).json({ error: auth.message });
    return;
  }

  const slug = pickFromRequest(req, ['slug', 'Slug']);
  const coursePageId = pickFromRequest(req, ['coursePageId', 'pageId', 'page_id', 'id', 'Page ID']);
  if (!slug && !coursePageId) {
    res.status(400).json({ error: 'Missing target course identifier (slug or coursePageId).' });
    return;
  }

  try {
    const result = await syncCourseToSupabase({ slug, coursePageId });
    invalidateAllApiCache();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync course to Supabase',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.all('/api/admin/sync-all-courses-supabase', async (req, res) => {
  const incomingSecret = String(req.get('x-sync-secret') || req.body?.secret || req.query?.secret || '').trim();
  const auth = validateSyncSecret(incomingSecret);
  if (!auth.ok) {
    res.status(401).json({ error: auth.message });
    return;
  }

  const updatedOnly = parseBooleanLike(req.body?.updated_only ?? req.query?.updated_only ?? process.env.SYNC_UPDATED_ONLY, false);
  const publishOnly = parseBooleanLike(req.body?.publish ?? req.query?.publish ?? process.env.SYNC_PUBLISH_ONLY, false);
  const deactivate = parseBooleanLike(req.body?.deactivate ?? req.query?.deactivate ?? process.env.SYNC_DEACTIVATE, false);
  const dryRun = parseBooleanLike(req.body?.dry_run ?? req.query?.dry_run, false);

  try {
    const result = await syncAllCoursesToSupabase({ updatedOnly, publishOnly, deactivate, dryRun });
    invalidateAllApiCache();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to sync all courses to Supabase',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

if (hasFrontendBuild) {
  app.use(express.static(distDir, { index: false }));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (!hasFrontendBuild) {
    res.status(404).send('Frontend build not found. Run `npm run build` before starting the server.');
    return;
  }

  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`[server] listening on ${port} (frontend: ${hasFrontendBuild ? 'enabled' : 'missing dist'})`);
});
