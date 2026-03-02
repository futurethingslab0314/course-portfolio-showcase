import { Course, Project, StudentWork } from '../../src/types';
import { FieldMapping, NormalizationWarning } from '../../shared/contracts';
import { mapUiPattern, normalizeStudentWork, parseFieldMapping } from '../../shared/notionMapper';

export interface NotionPage {
  id: string;
  cover?: { type: 'external' | 'file'; external?: { url: string }; file?: { url: string } };
  last_edited_time?: string;
  properties: Record<string, any>;
}

export interface NotionCourseMeta {
  pageId: string;
  slug: string;
  lastEditedTime: string;
  publishedStatus: boolean;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: any;
}

interface FetchContext {
  courseId?: string;
  projectId?: string;
  sourceDatabaseId?: string;
}

const notionBase = 'https://api.notion.com/v1';

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value || '';
}

function notionHeaders() {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error('Missing required env var: NOTION_TOKEN (or NOTION_API_KEY)');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': process.env.NOTION_API_VERSION || process.env.NOTION_VERSION || '2022-06-28',
    'Content-Type': 'application/json',
  };
}

function stripNotionId(id: string): string {
  return id.replace(/-/g, '').trim();
}

function normalizeNotionId(id: string): string {
  const plain = stripNotionId(id);
  if (plain.length !== 32) {
    return id;
  }
  return `${plain.slice(0, 8)}-${plain.slice(8, 12)}-${plain.slice(12, 16)}-${plain.slice(16, 20)}-${plain.slice(20)}`;
}

function asText(property: any): string {
  if (!property) return '';
  if (property.type === 'title') return property.title?.map((item: any) => item.plain_text).join('') || '';
  if (property.type === 'rich_text') return property.rich_text?.map((item: any) => item.plain_text).join('') || '';
  if (property.type === 'select') return property.select?.name || '';
  if (property.type === 'multi_select') return (property.multi_select || []).map((item: any) => item.name).join(', ');
  if (property.type === 'url') return property.url || '';
  if (property.type === 'email') return property.email || '';
  if (property.type === 'phone_number') return property.phone_number || '';
  if (property.type === 'number') return property.number == null ? '' : String(property.number);
  if (property.type === 'checkbox') return property.checkbox ? 'true' : 'false';
  if (property.type === 'date') return property.date?.start || '';
  return '';
}

function asStringArray(property: any): string[] {
  if (!property) return [];
  if (property.type === 'multi_select') return (property.multi_select || []).map((item: any) => item.name).filter(Boolean);
  if (property.type === 'people') return (property.people || []).map((item: any) => item.name).filter(Boolean);
  if (property.type === 'relation') return (property.relation || []).map((item: any) => item.id).filter(Boolean);
  if (property.type === 'rich_text') {
    const text = asText(property);
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asFiles(property: any): string[] {
  if (!property || property.type !== 'files') return [];
  return (property.files || [])
    .map((f: any) => (f.type === 'external' ? f.external?.url : f.file?.url))
    .filter(Boolean);
}

function asNumber(property: any): number {
  if (!property) return 0;
  if (property.type === 'number' && property.number != null) return property.number;
  const text = asText(property);
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function asBoolean(property: any): boolean {
  if (!property) return false;
  if (property.type === 'checkbox') return Boolean(property.checkbox);
  return ['true', '1', 'yes', 'y'].includes(asText(property).trim().toLowerCase());
}

function property(page: NotionPage, ...names: string[]) {
  for (const name of names) {
    if (page.properties[name]) return page.properties[name];
  }
  return undefined;
}

async function notionRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${notionBase}${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API error (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

async function notionRequestRaw(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${notionBase}${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API error (${response.status}): ${body}`);
  }
  return response;
}

async function queryDatabase(databaseId: string, body: Record<string, unknown> = {}): Promise<NotionPage[]> {
  const results: NotionPage[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const payload = cursor ? { ...body, start_cursor: cursor } : body;
    const data = await notionRequest<{ results: NotionPage[]; has_more: boolean; next_cursor?: string }>(
      `/databases/${normalizeNotionId(databaseId)}/query`,
      {
        method: 'POST',
        headers: notionHeaders(),
        body: JSON.stringify(payload),
      },
    );
    results.push(...(data.results || []));
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return results;
}

async function fetchBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const results: NotionBlock[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const query = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : '';
    const data = await notionRequest<{ results: NotionBlock[]; has_more: boolean; next_cursor?: string }>(
      `/blocks/${normalizeNotionId(blockId)}/children${query}`,
      {
        method: 'GET',
        headers: notionHeaders(),
      },
    );
    results.push(...(data.results || []));
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return results;
}

function richTextToPlainText(richText: any[] | undefined): string {
  if (!Array.isArray(richText)) {
    return '';
  }
  return richText.map((item) => item?.plain_text || '').join('').trim();
}

function asImageUrlFromBlock(block: NotionBlock): string {
  const image = block.image;
  if (!image) return '';
  if (image.type === 'external') return image.external?.url || '';
  if (image.type === 'file') return image.file?.url || '';
  return '';
}

function blockToBlogSection(block: NotionBlock): StudentWork['blogContent'][number] | null {
  if (block.type === 'paragraph') {
    const text = richTextToPlainText(block.paragraph?.rich_text);
    if (!text) return null;
    return { type: 'text', content: text };
  }

  if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
    const heading = richTextToPlainText(block[block.type]?.rich_text);
    if (!heading) return null;
    return { type: 'text', content: heading };
  }

  if (block.type === 'quote' || block.type === 'callout') {
    const text = richTextToPlainText(block[block.type]?.rich_text);
    if (!text) return null;
    return { type: 'text', content: text };
  }

  if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
    const text = richTextToPlainText(block[block.type]?.rich_text);
    if (!text) return null;
    return { type: 'text', content: `- ${text}` };
  }

  if (block.type === 'image') {
    const url = asImageUrlFromBlock(block);
    if (!url) return null;
    const caption = richTextToPlainText(block.image?.caption);
    return { type: 'image', content: url, caption: caption || undefined };
  }

  return null;
}

async function fetchBlogContentFromPageBlocks(pageId: string): Promise<NonNullable<StudentWork['blogContent']>> {
  const sections: NonNullable<StudentWork['blogContent']> = [];
  const blocks = await fetchBlockChildren(pageId);

  for (const block of blocks) {
    const section = blockToBlogSection(block);
    if (section) {
      sections.push(section);
    }
  }

  return sections;
}

export async function fetchPageById(pageId: string): Promise<NotionPage> {
  return notionRequest<NotionPage>(`/pages/${normalizeNotionId(pageId)}`, {
    method: 'GET',
    headers: notionHeaders(),
  });
}

export async function fetchDatabaseSchema(databaseId: string): Promise<Record<string, any>> {
  const response = await notionRequest<{ properties: Record<string, any> }>(`/databases/${normalizeNotionId(databaseId)}`, {
    method: 'GET',
    headers: notionHeaders(),
  });
  return response.properties || {};
}

export async function updatePageProperties(pageId: string, properties: Record<string, unknown>) {
  await notionRequestRaw(`/pages/${normalizeNotionId(pageId)}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ properties }),
  });
}

export async function fetchCourseBySlug(slug: string, warnings: NormalizationWarning[]): Promise<{ course: Course; pageId: string }> {
  const coursesDb = getEnv('NOTION_DB_COURSES_ID');
  const pages = await queryDatabase(coursesDb, {
    filter: { property: 'Slug', rich_text: { equals: slug } },
  });

  const exact = pages[0] || (await queryDatabase(coursesDb)).find((page) => asText(property(page, 'Slug')).trim() === slug);
  if (!exact) {
    throw new Error(`Course slug not found: ${slug}`);
  }

  const coverFromProp = asFiles(property(exact, 'CoverImage', 'Cover'))[0];
  const coverFromPage = exact.cover?.type === 'external' ? exact.cover.external?.url : exact.cover?.file?.url;

  const course: Course = {
    id: exact.id,
    slug: asText(property(exact, 'Slug')) || slug,
    courseName: asText(property(exact, 'CourseName', 'Name', 'Title')) || 'Untitled Course',
    courseSummary: asText(property(exact, 'CourseSummary', 'Summary', 'Description')),
    coverImage: coverFromProp || coverFromPage || 'https://picsum.photos/seed/course-fallback/1200/600',
    projectIds: asStringArray(property(exact, 'Projects')),
  };

  if (!course.projectIds.length) {
    warnings.push({
      level: 'warning',
      code: 'COURSE_PROJECT_RELATION_EMPTY',
      message: 'Course relation Projects is empty. Will fallback to Project.Course relation.',
      courseId: exact.id,
    });
  }

  return { course, pageId: exact.id };
}

export async function fetchAllCourses(): Promise<Course[]> {
  const coursesDb = getEnv('NOTION_DB_COURSES_ID');
  const pages = await queryDatabase(coursesDb);
  return pages.map((page) => {
    const coverFromProp = asFiles(property(page, 'CoverImage', 'Cover'))[0];
    const coverFromPage = page.cover?.type === 'external' ? page.cover.external?.url : page.cover?.file?.url;
    return {
      id: page.id,
      slug: asText(property(page, 'Slug')) || page.id,
      courseName: asText(property(page, 'CourseName', 'Name', 'Title')) || 'Untitled Course',
      courseSummary: asText(property(page, 'CourseSummary', 'Summary', 'Description')),
      coverImage: coverFromProp || coverFromPage || 'https://picsum.photos/seed/course-fallback/1200/600',
      projectIds: asStringArray(property(page, 'Projects')),
    };
  });
}

export async function fetchAllCoursesWithMeta(): Promise<NotionCourseMeta[]> {
  const coursesDb = getEnv('NOTION_DB_COURSES_ID');
  const pages = await queryDatabase(coursesDb);
  const rows: NotionCourseMeta[] = [];

  for (const page of pages) {
    const slug = asText(property(page, 'Slug')).trim();
    if (!slug) {
      continue;
    }
    rows.push({
      pageId: page.id,
      slug,
      lastEditedTime: String(page.last_edited_time || ''),
      publishedStatus: asBoolean(property(page, 'PublishedStatus', 'Published', 'Publish')),
    });
  }

  return rows;
}

export async function fetchProjectsByCourse(coursePageId: string, courseRelationIds: string[], warnings: NormalizationWarning[]): Promise<Array<{ project: Project; fieldMapping: FieldMapping }>> {
  const projectsDb = getEnv('NOTION_DB_PROJECTS_ID');
  const pages = await queryDatabase(projectsDb, {
    filter: { property: 'Course', relation: { contains: coursePageId } },
    sorts: [{ property: 'Order', direction: 'ascending' }],
  });

  const byCourseRelation = pages;

  const finalPages = byCourseRelation.length
    ? byCourseRelation
    : (await queryDatabase(projectsDb)).filter((page) => {
        const ids = asStringArray(property(page, 'Course'));
        return ids.includes(coursePageId);
      });

  const byId = new Map<string, NotionPage>();

  // Priority rule: if conflict, prioritize Notion relations from course/projects.
  for (const page of finalPages) byId.set(page.id, page);
  for (const relId of courseRelationIds) {
    const matched = finalPages.find((p) => stripNotionId(p.id) === stripNotionId(relId));
    if (matched) {
      byId.set(matched.id, matched);
    }
  }

  return [...byId.values()]
    .map((page) => {
      const context: FetchContext = { projectId: page.id };
      const sourceDbIdRaw = asText(property(page, 'SourceDatabaseId', 'SourceDatabaseID', 'Source Database Id', 'SourceDB'));
      const sourceDatabaseId = sourceDbIdRaw || asStringArray(property(page, 'SourceDatabase'))[0] || '';
      const uiPatternRaw = asText(property(page, 'UiPattern', 'DisplayStyle', 'Pattern'));
      const project: Project = {
        id: page.id,
        projectName: asText(property(page, 'ProjectName', 'Name', 'Title')) || 'Untitled Project',
        projectDescription: asText(property(page, 'ProjectDescription', 'Description')),
        courseId: asStringArray(property(page, 'Course'))[0] || coursePageId,
        tabName: asText(property(page, 'TabName', 'Tab')) || asText(property(page, 'ProjectName', 'Name', 'Title')) || 'PROJECT',
        order: asNumber(property(page, 'Order')),
        sourceDatabaseId,
        displayStyle: mapUiPattern(uiPatternRaw, warnings, {
          courseId: coursePageId,
          projectId: page.id,
          sourceDatabaseId,
        }),
      };

      const fieldMappingRaw = asText(property(page, 'FieldMapping')) || undefined;
      const fieldMapping = parseFieldMapping(fieldMappingRaw, warnings, {
        courseId: coursePageId,
        projectId: page.id,
        sourceDatabaseId,
      });

      if (!project.sourceDatabaseId) {
        warnings.push({
          level: 'warning',
          code: 'PROJECT_SOURCE_DB_MISSING',
          message: 'SourceDatabaseId missing on project; project will be skipped.',
          courseId: coursePageId,
          ...context,
        });
      }

      return { project, fieldMapping };
    })
    .sort((a, b) => a.project.order - b.project.order);
}

function normalizeSourceRecord(page: NotionPage): Record<string, unknown> {
  const result: Record<string, unknown> = { id: page.id };

  for (const [name, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' || prop.type === 'rich_text' || prop.type === 'select' || prop.type === 'number' || prop.type === 'url' || prop.type === 'checkbox' || prop.type === 'date' || prop.type === 'email' || prop.type === 'phone_number') {
      result[name] = asText(prop);
      continue;
    }
    if (prop.type === 'multi_select' || prop.type === 'people' || prop.type === 'relation') {
      result[name] = asStringArray(prop);
      continue;
    }
    if (prop.type === 'files') {
      result[name] = asFiles(prop);
      continue;
    }
    if (prop.type === 'formula') {
      const formula = prop.formula;
      result[name] = formula?.string ?? formula?.number ?? formula?.boolean ?? '';
      continue;
    }
    if (prop.type === 'status') {
      result[name] = prop.status?.name || '';
      continue;
    }

    result[name] = '';
  }

  return result;
}

export async function fetchStudentWorksForProject(
  project: Project,
  fieldMapping: FieldMapping,
  warnings: NormalizationWarning[],
): Promise<StudentWork[]> {
  if (!project.sourceDatabaseId) {
    return [];
  }

  const sourceDatabaseId = normalizeNotionId(project.sourceDatabaseId);

  const pages = await queryDatabase(sourceDatabaseId);
  const works: StudentWork[] = [];

  for (const page of pages) {
    const normalized = normalizeStudentWork(normalizeSourceRecord(page), project.sourceDatabaseId, fieldMapping, warnings, {
      courseId: project.courseId,
      projectId: project.id,
      sourceDatabaseId: project.sourceDatabaseId,
    });

    if (project.displayStyle === 'blog-post') {
      try {
        const sections = await fetchBlogContentFromPageBlocks(page.id);
        if (sections.length) {
          normalized.blogContent = sections;
        }
      } catch (error) {
        warnings.push({
          level: 'warning',
          code: 'BLOG_BLOCKS_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch Notion page blocks for blog content.',
          courseId: project.courseId,
          projectId: project.id,
          sourceDatabaseId: project.sourceDatabaseId,
          workId: normalized.id,
        });
      }
    }

    works.push(normalized);
  }

  return works;
}

export async function updateCourseGenerationStatus(coursePageId: string, status: 'generated' | 'failed', courseLink?: string) {
  const properties: Record<string, unknown> = {
    Status: { select: { name: status } },
  };

  if (courseLink) {
    properties.CourseLink = { url: courseLink };
  }

  await updatePageProperties(coursePageId, properties);
}

export async function findCourseSlugByPageId(coursePageId: string): Promise<string> {
  const page = await fetchPageById(coursePageId);
  const slug = asText(property(page, 'Slug')).trim();
  if (!slug) {
    throw new Error(`Course slug is missing for page ${coursePageId}`);
  }
  return slug;
}

export async function fetchProjectSyncContext(projectPageId: string): Promise<{
  page: NotionPage;
  sourceDatabaseId: string;
  fieldMappingValue: string;
  uiPatternValue: string;
}> {
  const page = await fetchPageById(projectPageId);
  const sourceDbIdRaw = asText(property(page, 'SourceDatabaseId', 'SourceDatabaseID', 'Source Database Id', 'SourceDB'));
  const sourceDatabaseId = sourceDbIdRaw || asStringArray(property(page, 'SourceDatabase'))[0] || '';
  if (!sourceDatabaseId) {
    throw new Error(`SourceDatabaseId is missing on project ${projectPageId}`);
  }

  return {
    page,
    sourceDatabaseId,
    fieldMappingValue: asText(property(page, 'FieldMapping')).trim(),
    uiPatternValue: asText(property(page, 'UiPattern', 'DisplayStyle', 'Pattern')).trim(),
  };
}

export async function findProjectPageIdBySourceDatabaseId(sourceDatabaseIdInput: string): Promise<string | undefined> {
  const sourceDatabaseId = stripNotionId(sourceDatabaseIdInput);
  if (!sourceDatabaseId) return undefined;

  const projectsDb = getEnv('NOTION_DB_PROJECTS_ID');
  const pages = await queryDatabase(projectsDb);

  for (const page of pages) {
    const sourceDbIdRaw = asText(property(page, 'SourceDatabaseId', 'SourceDatabaseID', 'Source Database Id', 'SourceDB'));
    const sourceDbId = stripNotionId(sourceDbIdRaw);
    if (sourceDbId && sourceDbId === sourceDatabaseId) {
      return page.id;
    }
  }

  return undefined;
}
