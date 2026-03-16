import { randomUUID } from 'node:crypto';
import { CoursePayload, NormalizationWarning, UI_PATTERN_FALLBACK, UI_PATTERN_MAP } from '../../shared/contracts';
import { Course, Project, StudentWork } from '../../src/types';

interface SupabaseCourseRow {
  id: string;
  notion_page_id: string;
  slug: string;
  course_name: string;
  course_summary: string | null;
  cover_image_url: string | null;
  is_active?: boolean | null;
  is_published?: boolean | null;
  notion_last_edited_time?: string | null;
}

interface SupabaseProjectRow {
  id: string;
  notion_page_id: string;
  course_id: string;
  project_name: string;
  project_description: string | null;
  tab_name: string | null;
  order: number;
  source_database_id: string | null;
  ui_pattern: string | null;
  field_mapping: Record<string, unknown> | null;
}

interface SupabaseStudentWorkRow {
  id: string;
  notion_page_id: string;
  project_id: string;
  source_database_id: string | null;
  assignment_name: string;
  members: string[] | null;
  description: string | null;
  main_image_url: string | null;
  blog_content: StudentWork['blogContent'] | null;
  metadata: Record<string, unknown> | null;
}

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value || '';
}

function supabaseConfig() {
  const url = getEnv('SUPABASE_URL');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Missing required env var: SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  }
  return { url: url.replace(/\/$/, ''), key };
}

function supabaseHeaders(extra?: Record<string, string>) {
  const { key } = supabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function supabaseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { url } = supabaseConfig();
  const response = await fetch(`${url}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase API error (${response.status}): ${text}`);
  }

  const raw = await response.text();
  return (raw ? (JSON.parse(raw) as T) : ({} as T));
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDisplayStyle(style: string | null | undefined): Project['displayStyle'] {
  if (!style) return UI_PATTERN_FALLBACK;
  return UI_PATTERN_MAP[style] || UI_PATTERN_FALLBACK;
}

function parseMaybeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return [];
}

function parseMaybeBlogContent(value: unknown): StudentWork['blogContent'] {
  if (!Array.isArray(value)) return undefined;
  const rows: NonNullable<StudentWork['blogContent']> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = (item as any).type;
    const content = (item as any).content;
    if ((type === 'text' || type === 'image') && typeof content === 'string' && content.trim()) {
      rows.push({
        type,
        content: content.trim(),
        caption: typeof (item as any).caption === 'string' ? (item as any).caption : undefined,
      });
      continue;
    }

    if (type === 'table' && Array.isArray((item as any).rows)) {
      const parsedRows = (item as any).rows
        .filter((row: unknown) => Array.isArray(row))
        .map((row: unknown) =>
          (row as unknown[])
            .map((cell) => (typeof cell === 'string' ? cell.trim() : ''))
        )
        .filter((row: string[]) => row.some((cell) => cell.length > 0));

      if (parsedRows.length) {
        rows.push({
          type: 'table',
          rows: parsedRows,
          hasColumnHeader: Boolean((item as any).hasColumnHeader),
          hasRowHeader: Boolean((item as any).hasRowHeader),
        });
      }
    }
  }
  return rows.length ? rows : undefined;
}

function buildStudentWorkMetadata(work: StudentWork): Record<string, unknown> {
  return {
    studentIds: work.studentIds || null,
    moreImages: work.moreImages || null,
    url: work.url || null,
    video: work.video || null,
    tags: work.tags || null,
    year: work.year || null,
    isStarred: typeof work.isStarred === 'boolean' ? work.isStarred : null,
    methodologies: work.methodologies || null,
    storyButtons: work.storyButtons || null,
    dataSpecs: work.dataSpecs || null,
    gridLocation: work.gridLocation || null,
  };
}

function mapCourseRowToCourse(row: SupabaseCourseRow): Course {
  return {
    id: row.notion_page_id,
    slug: row.slug,
    courseName: row.course_name,
    courseSummary: row.course_summary || '',
    coverImage: row.cover_image_url || 'https://picsum.photos/seed/course-fallback/1200/600',
    projectIds: [],
  };
}

function mapProjectRowToProject(row: SupabaseProjectRow, courseNotionPageId: string): Project {
  return {
    id: row.notion_page_id,
    projectName: row.project_name,
    projectDescription: row.project_description || '',
    courseId: courseNotionPageId,
    tabName: row.tab_name || row.project_name || 'PROJECT',
    order: Number.isFinite(row.order) ? row.order : 0,
    sourceDatabaseId: row.source_database_id || '',
    displayStyle: normalizeDisplayStyle(row.ui_pattern),
  };
}

function mapWorkRowToStudentWork(row: SupabaseStudentWorkRow): StudentWork {
  const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
  return {
    id: row.notion_page_id,
    assignmentName: row.assignment_name || 'Untitled Assignment',
    members: parseMaybeStringArray(row.members),
    description: row.description || '',
    mainImage: row.main_image_url || '',
    blogContent: parseMaybeBlogContent(row.blog_content),
    sourceDatabaseId: row.source_database_id || '',
    studentIds: parseMaybeStringArray(metadata.studentIds),
    moreImages: parseMaybeStringArray(metadata.moreImages),
    url: typeof metadata.url === 'string' ? metadata.url : undefined,
    video: typeof metadata.video === 'string' ? metadata.video : undefined,
    tags: parseMaybeStringArray(metadata.tags),
    year: typeof metadata.year === 'string' ? metadata.year : undefined,
    isStarred: typeof metadata.isStarred === 'boolean' ? metadata.isStarred : undefined,
    methodologies: parseMaybeStringArray(metadata.methodologies),
    storyButtons: Array.isArray(metadata.storyButtons) ? (metadata.storyButtons as any) : undefined,
    dataSpecs: parseMaybeStringArray(metadata.dataSpecs),
    gridLocation: typeof metadata.gridLocation === 'string' ? metadata.gridLocation : undefined,
  };
}

function buildInFilter(values: string[]): string {
  return `in.(${values.map((value) => `"${value}"`).join(',')})`;
}

function buildNotInFilter(values: string[]): string {
  return `not.in.(${values.map((value) => `"${value}"`).join(',')})`;
}

export function shouldReadFromSupabase(): boolean {
  return String(process.env.READ_FROM_SUPABASE || 'false').toLowerCase() === 'true';
}

export async function fetchCoursesFromSupabase(): Promise<Course[]> {
  const rows = await supabaseRequest<SupabaseCourseRow[]>(
    '/rest/v1/courses?select=id,notion_page_id,slug,course_name,course_summary,cover_image_url,is_active&is_active=neq.false&order=created_at.desc',
    {
      method: 'GET',
      headers: supabaseHeaders(),
    },
  );

  return rows.map((row) => mapCourseRowToCourse(row));
}

export async function fetchCoursePayloadBySlugFromSupabase(slug: string): Promise<CoursePayload> {
  const encodedSlug = encodeURIComponent(slug);
  const courses = await supabaseRequest<SupabaseCourseRow[]>(
    `/rest/v1/courses?select=id,notion_page_id,slug,course_name,course_summary,cover_image_url,is_active&slug=eq.${encodedSlug}&is_active=neq.false&limit=1`,
    {
      method: 'GET',
      headers: supabaseHeaders(),
    },
  );

  const courseRow = courses[0];
  if (!courseRow) {
    throw new Error(`Supabase course not found by slug: ${slug}`);
  }

  const projectRows = await supabaseRequest<SupabaseProjectRow[]>(
    `/rest/v1/projects?select=id,notion_page_id,course_id,project_name,project_description,tab_name,order,source_database_id,ui_pattern,field_mapping&course_id=eq.${encodeURIComponent(courseRow.id)}&order=order.asc`,
    {
      method: 'GET',
      headers: supabaseHeaders(),
    },
  );

  const projectIdList = projectRows.map((row) => row.id);
  const studentWorkRows = projectIdList.length
    ? await supabaseRequest<SupabaseStudentWorkRow[]>(
        `/rest/v1/student_works?select=id,notion_page_id,project_id,source_database_id,assignment_name,members,description,main_image_url,blog_content,metadata&project_id=${encodeURIComponent(buildInFilter(projectIdList))}`,
        {
          method: 'GET',
          headers: supabaseHeaders(),
        },
      )
    : [];

  const course = mapCourseRowToCourse(courseRow);
  const projects = projectRows.map((row) => mapProjectRowToProject(row, courseRow.notion_page_id));
  course.projectIds = projects.map((project) => project.id);

  const studentWorks = studentWorkRows.map((row) => mapWorkRowToStudentWork(row));

  return {
    course,
    projects,
    studentWorks,
    warnings: [],
  };
}

export async function upsertCourseToSupabase(
  course: Course,
  options?: { isPublished?: boolean; notionLastEditedTime?: string | null; isActive?: boolean },
): Promise<SupabaseCourseRow> {
  const timestamp = nowIso();
  const row: Record<string, unknown> = {
    notion_page_id: course.id,
    slug: course.slug || course.id,
    course_name: course.courseName,
    course_summary: course.courseSummary || null,
    cover_image_url: course.coverImage || null,
    last_synced_at: timestamp,
    updated_at: timestamp,
  };
  if (typeof options?.isActive === 'boolean') {
    row.is_active = options.isActive;
  }
  if (typeof options?.isPublished === 'boolean') {
    row.is_published = options.isPublished;
  }
  if (typeof options?.notionLastEditedTime === 'string') {
    row.notion_last_edited_time = options.notionLastEditedTime || null;
  }
  const payload = [row];

  const rows = await supabaseRequest<SupabaseCourseRow[]>(
    '/rest/v1/courses?on_conflict=notion_page_id',
    {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(payload),
    },
  );

  if (!rows[0]) {
    throw new Error('Failed to upsert course in Supabase.');
  }

  return rows[0];
}

export async function upsertProjectsToSupabase(projects: Project[], courseId: string): Promise<SupabaseProjectRow[]> {
  if (!projects.length) return [];
  const timestamp = nowIso();
  const payload = projects.map((project) => ({
    notion_page_id: project.id,
    course_id: courseId,
    project_name: project.projectName,
    project_description: project.projectDescription || null,
    tab_name: project.tabName || null,
    order: project.order,
    source_database_id: project.sourceDatabaseId || null,
    ui_pattern: project.displayStyle,
    field_mapping: {},
    last_synced_at: timestamp,
    updated_at: timestamp,
  }));

  return supabaseRequest<SupabaseProjectRow[]>(
    '/rest/v1/projects?on_conflict=notion_page_id',
    {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(payload),
    },
  );
}

export async function upsertStudentWorksToSupabase(params: {
  studentWorks: StudentWork[];
  projectIdBySourceDb: Map<string, string>;
  warnings: NormalizationWarning[];
}): Promise<{ upserted: number; skipped: number }> {
  const timestamp = nowIso();
  const rows: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (const work of params.studentWorks) {
    const projectId = params.projectIdBySourceDb.get(work.sourceDatabaseId);
    if (!projectId) {
      skipped += 1;
      params.warnings.push({
        level: 'warning',
        code: 'SUPABASE_PROJECT_LINK_MISSING',
        message: `Cannot link work (${work.id}) to project by sourceDatabaseId (${work.sourceDatabaseId}). Skipped upsert.`,
        sourceDatabaseId: work.sourceDatabaseId,
        workId: work.id,
      });
      continue;
    }

    rows.push({
      notion_page_id: work.id || randomUUID(),
      project_id: projectId,
      source_database_id: work.sourceDatabaseId || null,
      assignment_name: work.assignmentName || 'Untitled Assignment',
      members: work.members || [],
      description: work.description || null,
      main_image_url: work.mainImage || null,
      blog_content: work.blogContent || null,
      metadata: buildStudentWorkMetadata(work),
      last_synced_at: timestamp,
      updated_at: timestamp,
    });
  }

  if (!rows.length) {
    return { upserted: 0, skipped };
  }

  const upserted = await supabaseRequest<SupabaseStudentWorkRow[]>(
    '/rest/v1/student_works?on_conflict=notion_page_id',
    {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(rows),
    },
  );

  return { upserted: upserted.length, skipped };
}

export async function deleteStudentWorksNotInProjects(params: {
  projectIds: string[];
  activeWorkNotionIds: string[];
}): Promise<number> {
  const projectIds = params.projectIds.map((value) => String(value || '').trim()).filter(Boolean);
  if (!projectIds.length) return 0;

  const activeWorkNotionIds = params.activeWorkNotionIds.map((value) => String(value || '').trim()).filter(Boolean);
  const projectScope = `project_id=${encodeURIComponent(buildInFilter(projectIds))}`;
  const staleFilter = activeWorkNotionIds.length
    ? `&notion_page_id=${encodeURIComponent(buildNotInFilter(activeWorkNotionIds))}`
    : '';

  const deleted = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/student_works?${projectScope}${staleFilter}`,
    {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
    },
  );

  return deleted.length;
}

export async function appendSyncLog(params: {
  runId: string;
  entityType: string;
  entityNotionId?: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  payload?: Record<string, unknown>;
}) {
  await supabaseRequest(
    '/rest/v1/sync_logs',
    {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify([{
        run_id: params.runId,
        entity_type: params.entityType,
        entity_notion_id: params.entityNotionId || null,
        status: params.status,
        message: params.message || null,
        payload: params.payload || null,
      }]),
    },
  );
}

export async function setCoursesInactiveByNotionIds(activeNotionIds: string[]): Promise<number> {
  const timestamp = nowIso();
  const where = activeNotionIds.length
    ? `?is_active=eq.true&notion_page_id=${encodeURIComponent(buildNotInFilter(activeNotionIds))}`
    : '?is_active=eq.true';

  const updated = await supabaseRequest<Array<{ id: string }>>(
    `/rest/v1/courses${where}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        is_active: false,
        updated_at: timestamp,
      }),
    },
  );

  return updated.length;
}

export async function getLastSyncAllCheckpoint(): Promise<string | null> {
  const rows = await supabaseRequest<Array<{ payload: Record<string, unknown> | null }>>(
    '/rest/v1/sync_logs?select=payload&entity_type=eq.sync_all&status=eq.success&order=created_at.desc&limit=1',
    {
      method: 'GET',
      headers: supabaseHeaders(),
    },
  );

  const payload = rows[0]?.payload;
  if (!payload || typeof payload !== 'object') return null;
  const checkpoint = payload.checkpointTo;
  return typeof checkpoint === 'string' && checkpoint.trim() ? checkpoint : null;
}

export async function validateCourseSyncToken(courseSlug: string, token: string): Promise<boolean> {
  const slug = String(courseSlug || '').trim();
  const rawToken = String(token || '').trim();
  if (!slug || !rawToken) return false;

  try {
    const rows = await supabaseRequest<Array<{ id: string }>>(
      `/rest/v1/course_sync_tokens?select=id&course_slug=eq.${encodeURIComponent(slug)}&token=eq.${encodeURIComponent(rawToken)}&is_active=eq.true&limit=1`,
      {
        method: 'GET',
        headers: supabaseHeaders(),
      },
    );
    return rows.length > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('course_sync_tokens')) {
      throw new Error(
        'course_sync_tokens table is missing. Please run the Human prerequisite SQL in docs/notion-supabase-main-read-plan.md (H.3.2).',
      );
    }
    throw error;
  }
}
