import { Course, Project, StudentWork } from '../../src/types';
import { CardCaseRelationConfig, FieldMapping, NormalizationWarning } from '../../shared/contracts';
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

function richTextToSpans(richText: any[] | undefined): Array<{ text: string; href?: string }> | undefined {
  if (!Array.isArray(richText)) {
    return undefined;
  }

  const spans = richText
    .map((item) => {
      const text = String(item?.plain_text || '');
      const href = typeof item?.href === 'string' && item.href.trim() ? item.href.trim() : undefined;
      const annotations = item?.annotations || {};
      const color = typeof annotations.color === 'string' && annotations.color !== 'default' ? annotations.color : undefined;
      if (!text) return null;
      const span = {
        text,
        href,
        color,
        bold: Boolean(annotations.bold) || undefined,
        italic: Boolean(annotations.italic) || undefined,
        underline: Boolean(annotations.underline) || undefined,
        strikethrough: Boolean(annotations.strikethrough) || undefined,
        code: Boolean(annotations.code) || undefined,
      };
      return Object.fromEntries(Object.entries(span).filter(([, value]) => value !== undefined));
    })
    .filter((item): item is { text: string; href?: string } => Boolean(item));

  return spans.length ? spans : undefined;
}

function asImageUrlFromBlock(block: NotionBlock): string {
  const image = block.image;
  if (!image) return '';
  if (image.type === 'external') return image.external?.url || '';
  if (image.type === 'file') return image.file?.url || '';
  return '';
}

function asVideoUrlFromBlock(block: NotionBlock): string {
  const video = block.video;
  if (video) {
    if (video.type === 'external') return video.external?.url || '';
    if (video.type === 'file') return video.file?.url || '';
    if (typeof video.url === 'string') return video.url;
  }

  const embed = block.embed;
  if (embed) {
    if (typeof embed.url === 'string') return embed.url;
    if (embed.type === 'external') return embed.external?.url || '';
    if (embed.type === 'file') return embed.file?.url || '';
  }

  return '';
}

function inferVideoProvider(url: string): 'youtube' | 'vimeo' | 'direct' | 'embed' {
  const normalized = url.trim().toLowerCase();

  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalized)) {
    return 'direct';
  }

  if (normalized.includes('youtu.be/') || normalized.includes('youtube.com/')) {
    return 'youtube';
  }

  if (normalized.includes('vimeo.com/')) {
    return 'vimeo';
  }

  return 'embed';
}

function asVideoCaptionFromBlock(block: NotionBlock): string | undefined {
  const videoCaption = richTextToPlainText(block.video?.caption);
  if (videoCaption) return videoCaption;
  const embedCaption = richTextToPlainText(block.embed?.caption);
  return embedCaption || undefined;
}

function asTableRows(blocks: NotionBlock[]): string[][] {
  return blocks
    .filter((block) => block.type === 'table_row')
    .map((block) => {
      const cells = Array.isArray(block.table_row?.cells) ? block.table_row.cells : [];
      return cells.map((cell: any[] | undefined) => richTextToPlainText(cell));
    })
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function asTableRichRows(blocks: NotionBlock[]): Array<Array<Array<{ text: string; href?: string }>>> {
  return blocks
    .filter((block) => block.type === 'table_row')
    .map((block) => {
      const cells = Array.isArray(block.table_row?.cells) ? block.table_row.cells : [];
      return cells.map((cell: any[] | undefined) => richTextToSpans(cell) || []);
    })
    .filter((row) => row.some((cell) => cell.some((span) => span.text.trim().length > 0)));
}

async function blockToBlogSection(block: NotionBlock): Promise<StudentWork['blogContent'][number] | null> {
  if (block.type === 'paragraph') {
    const text = richTextToPlainText(block.paragraph?.rich_text);
    if (!text) return null;
    return { type: 'text', blockType: 'paragraph', content: text, richText: richTextToSpans(block.paragraph?.rich_text) };
  }

  const mapChildBlocks = async (blocks: NotionBlock[]): Promise<NonNullable<StudentWork['blogContent']>> => {
    const children: NonNullable<StudentWork['blogContent']> = [];
    for (const childBlock of blocks) {
      const section = await blockToBlogSection(childBlock);
      if (section) {
        children.push(section);
      }
    }
    return children;
  };

  if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3' || block.type === 'heading_4') {
    const heading = richTextToPlainText(block[block.type]?.rich_text);
    if (!heading) return null;
    if (Boolean(block[block.type]?.is_toggleable)) {
      const childBlocks = Array.isArray(block.children) ? block.children : await fetchBlockChildren(block.id);
      return {
        type: 'toggle',
        blockType: block.type,
        content: heading,
        richText: richTextToSpans(block[block.type]?.rich_text),
        children: await mapChildBlocks(childBlocks),
      };
    }
    return { type: 'text', blockType: block.type, content: heading, richText: richTextToSpans(block[block.type]?.rich_text) };
  }

  if (block.type === 'quote' || block.type === 'callout') {
    const text = richTextToPlainText(block[block.type]?.rich_text);
    if (!text) return null;
    return { type: 'text', blockType: block.type, content: text, richText: richTextToSpans(block[block.type]?.rich_text) };
  }

  if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
    const text = richTextToPlainText(block[block.type]?.rich_text);
    if (!text) return null;
    const spans = richTextToSpans(block[block.type]?.rich_text);
    return {
      type: 'text',
      blockType: block.type,
      content: text,
      richText: spans,
    };
  }

  if (block.type === 'image') {
    const url = asImageUrlFromBlock(block);
    if (!url) return null;
    const caption = richTextToPlainText(block.image?.caption);
    return { type: 'image', content: url, caption: caption || undefined };
  }

  if (block.type === 'embed' || block.type === 'video') {
    const url = asVideoUrlFromBlock(block);
    if (!url) return null;
    const caption = asVideoCaptionFromBlock(block);
    return {
      type: 'video',
      content: url,
      ...(caption ? { caption } : {}),
      provider: inferVideoProvider(url),
    };
  }

  if (block.type === 'code') {
    const content = richTextToPlainText(block.code?.rich_text);
    if (!content) return null;
    const language = typeof block.code?.language === 'string' ? block.code.language.trim() : '';
    return {
      type: 'code',
      content,
      language: language || undefined,
    };
  }

  if (block.type === 'table') {
    const childBlocks = Array.isArray(block.children) ? block.children : await fetchBlockChildren(block.id);
    const rows = asTableRows(childBlocks);
    const richRows = asTableRichRows(childBlocks);
    if (!rows.length) return null;
    return {
      type: 'table',
      rows,
      richRows: richRows.length ? richRows : undefined,
      hasColumnHeader: Boolean(block.table?.has_column_header),
      hasRowHeader: Boolean(block.table?.has_row_header),
    };
  }

  if (block.type === 'toggle') {
    const text = richTextToPlainText(block.toggle?.rich_text);
    if (!text) return null;
    const childBlocks = Array.isArray(block.children) ? block.children : await fetchBlockChildren(block.id);
    return {
      type: 'toggle',
      content: text,
      richText: richTextToSpans(block.toggle?.rich_text),
      children: await mapChildBlocks(childBlocks),
    };
  }

  if (block.type === 'column_list') {
    const childBlocks = Array.isArray(block.children) ? block.children : await fetchBlockChildren(block.id);
    const columns = [];

    for (const columnBlock of childBlocks.filter((childBlock) => childBlock.type === 'column')) {
      const columnChildren = Array.isArray(columnBlock.children) ? columnBlock.children : await fetchBlockChildren(columnBlock.id);
      const children = await mapChildBlocks(columnChildren);
      if (children.length) {
        columns.push({ children });
      }
    }

    return columns.length ? { type: 'column_list', columns } : null;
  }

  return null;
}

export async function blockToBlogSectionForTest(block: NotionBlock): Promise<StudentWork['blogContent'][number] | null> {
  return blockToBlogSection(block);
}

async function fetchBlogContentFromPageBlocks(pageId: string): Promise<NonNullable<StudentWork['blogContent']>> {
  const sections: NonNullable<StudentWork['blogContent']> = [];
  const blocks = await fetchBlockChildren(pageId);

  for (const block of blocks) {
    const section = await blockToBlogSection(block);
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
  return pages
    .filter((page) => asBoolean(property(page, 'PublishedStatus', 'Published', 'Publish')))
    .map((page) => {
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

export async function fetchProjectsByCourse(coursePageId: string, courseRelationIds: string[], warnings: NormalizationWarning[]): Promise<Array<{ project: Project; fieldMapping: FieldMapping; relationConfig?: CardCaseRelationConfig }>> {
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
      const visibilityRaw = asText(property(page, 'Visibility')).trim().toLowerCase();
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
        visibility: visibilityRaw === 'draft' ? 'draft' : 'published',
      };

      const fieldMappingRaw = asText(property(page, 'FieldMapping')) || undefined;
      const fieldMapping = parseFieldMapping(fieldMappingRaw, warnings, {
        courseId: coursePageId,
        projectId: page.id,
        sourceDatabaseId,
      });
      const relationConfigRaw = asText(property(page, 'RelationConfig', 'Relation Config')) || undefined;
      const relationConfig = parseRelationConfig(relationConfigRaw);

      if (!project.sourceDatabaseId) {
        warnings.push({
          level: 'warning',
          code: 'PROJECT_SOURCE_DB_MISSING',
          message: 'SourceDatabaseId missing on project; project will be skipped.',
          courseId: coursePageId,
          ...context,
        });
      }

      return { project, fieldMapping, relationConfig };
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

function parseRelationConfig(raw: unknown): CardCaseRelationConfig | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as CardCaseRelationConfig;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function pageFileOrCoverUrl(page: NotionPage, ...names: string[]): string {
  const fileUrl = asFiles(property(page, ...names))[0];
  if (fileUrl) return fileUrl;
  if (page.cover?.type === 'external') return page.cover.external?.url || '';
  if (page.cover?.type === 'file') return page.cover.file?.url || '';
  return '';
}

function relationIds(page: NotionPage, ...names: string[]): string[] {
  return asStringArray(property(page, ...names));
}

async function fetchPagesByIds(pageIds: string[]): Promise<NotionPage[]> {
  const uniqueIds = [...new Set(pageIds.map((id) => normalizeNotionId(id)).filter(Boolean))];
  if (!uniqueIds.length) return [];
  return Promise.all(uniqueIds.map((pageId) => fetchPageById(pageId)));
}

interface CardCaseMember {
  pageId: string;
  name: string;
  id: string;
  group: string;
  year: string;
}

async function fetchCardCaseWorksForProject(
  project: Project,
  relationConfig: CardCaseRelationConfig | undefined,
  warnings: NormalizationWarning[],
): Promise<StudentWork[]> {
  const studentGroupAliases = [relationConfig?.entry.groupField || '', 'group', 'Group', 'GROUP', 'Project Group', 'project group', 'Team', 'team'];
  const studentNameAliases = [relationConfig?.entry.studentNameField || '', 'StudentName', 'Student Name', 'studentName', 'student name', 'Name', 'name', 'Title'];
  const studentIdAliases = [relationConfig?.entry.studentIdField || '', 'StudentID', 'Student Id', 'Student ID', 'studentId', 'student id', 'ID', 'Id', 'id'];
  const studentYearAliases = [relationConfig?.entry.yearField || '', 'year', 'Year', 'YEAR', 'Academic Year', 'academic year'];
  const caseCardsAliases = [relationConfig?.entry.caseRelationField || '', 'CaseCards', 'Case Cards', 'caseCards', 'case cards', 'Cases', 'cases'];
  const caseNameAliases = [relationConfig?.case.nameField || '', 'CaseName', 'Case Name', 'caseName', 'case name', 'Name', 'name', 'Title'];
  const bodyPartAliases = [relationConfig?.case.bodyRelationField || '', 'BodyPart', 'Body Part', 'bodyPart', 'body part', 'Interaction Part', 'interaction part'];
  const caseImageAliases = [relationConfig?.case.imageField || '', 'mainImage', 'MainImage', 'Main Image', 'main image', 'Image', 'image', 'CoverImage', 'Cover Image', 'Cover'];
  const targetUserAliases = [relationConfig?.case.targetUserField || '', 'TargetUser', 'Target User', 'targetUser', 'target user', 'Audience', 'audience'];
  const caseYearAliases = [relationConfig?.case.yearField || '', 'CaseYear', 'Case Year', 'caseYear', 'case year', 'Year', 'year'];
  const designTeamAliases = [relationConfig?.case.designTeamField || '', 'DesignTeam', 'Design Team', 'designTeam', 'design team', 'Team', 'team'];
  const keywordAliases = [relationConfig?.case.keywordsField || '', 'Keywords', 'Keyword', 'keywords', 'keyword', 'Tags', 'Tag', 'tags', 'tag'];
  const caseStudentAliases = [relationConfig?.case.studentRelationField || '', 'StudentName', 'Student Name', 'studentName', 'student name', 'Students', 'students'];
  const bodyIconAliases = [relationConfig?.body.iconField || '', 'Icon', 'icon', 'Body Icon', 'body icon'];

  const studentPages = await queryDatabase(normalizeNotionId(project.sourceDatabaseId));
  const studentById = new Map<string, CardCaseMember>();
  const groupSummaries = new Map<string, StudentWork>();

  for (const studentPage of studentPages) {
    const group = asText(property(studentPage, ...studentGroupAliases)).trim() || 'Ungrouped';
    const member: CardCaseMember = {
      pageId: studentPage.id,
      name: asText(property(studentPage, ...studentNameAliases)).trim() || 'Unnamed Student',
      id: asText(property(studentPage, ...studentIdAliases)).trim(),
      group,
      year: asText(property(studentPage, ...studentYearAliases)).trim(),
    };

    studentById.set(stripNotionId(studentPage.id), member);

    const summary = groupSummaries.get(group) ?? {
      id: `card-case-group:${project.id}:${group}`,
      assignmentName: group,
      members: [],
      studentIds: [],
      memberDetails: [],
      caseIds: [],
      group,
      cardCaseRecordType: 'group',
      description: project.projectDescription || '',
      mainImage: '',
      year: member.year,
      sourceDatabaseId: project.sourceDatabaseId,
    };

    const nextMemberDetails = summary.memberDetails || [];
    if (!nextMemberDetails.some((item) => item.name === member.name && item.id === member.id)) {
      nextMemberDetails.push({ name: member.name, id: member.id || 'N/A' });
    }

    summary.memberDetails = nextMemberDetails;
    summary.members = nextMemberDetails.map((item) => item.name);
    summary.studentIds = [...new Set([...(summary.studentIds || []), stripNotionId(member.pageId)])];
    summary.year = summary.year || member.year;
    groupSummaries.set(group, summary);
  }

  const allCaseIds = studentPages.flatMap((page) => relationIds(page, ...caseCardsAliases));
  const casePages = await fetchPagesByIds(allCaseIds);
  const caseById = new Map(casePages.map((page) => [stripNotionId(page.id), page]));
  const allBodyIds = casePages.flatMap((page) => relationIds(page, ...bodyPartAliases));
  const bodyPages = await fetchPagesByIds(allBodyIds);
  const bodyIconById = new Map(bodyPages.map((page) => [stripNotionId(page.id), pageFileOrCoverUrl(page, ...bodyIconAliases)]));

  const caseWorks: StudentWork[] = [];
  const seenGroupCases = new Set<string>();

  for (const studentPage of studentPages) {
    const group = asText(property(studentPage, ...studentGroupAliases)).trim() || 'Ungrouped';
    const summary = groupSummaries.get(group);
    const groupMemberDetails = summary?.memberDetails || [];
    const linkedCaseIds = relationIds(studentPage, ...caseCardsAliases);

    for (const rawCaseId of linkedCaseIds) {
      const casePage = caseById.get(stripNotionId(rawCaseId));
      if (!casePage) {
        warnings.push({
          level: 'warning',
          code: 'CARD_CASE_PAGE_MISSING',
          message: `Card case page missing for relation ${rawCaseId}.`,
          courseId: project.courseId,
          projectId: project.id,
          sourceDatabaseId: project.sourceDatabaseId,
        });
        continue;
      }

      const uniqueGroupCaseKey = `${group}:${stripNotionId(casePage.id)}`;
      if (seenGroupCases.has(uniqueGroupCaseKey)) {
        continue;
      }
      seenGroupCases.add(uniqueGroupCaseKey);

      const relatedStudents = relationIds(casePage, ...caseStudentAliases)
        .map((id) => studentById.get(stripNotionId(id)))
        .filter((item): item is CardCaseMember => Boolean(item));
      const memberDetails = (relatedStudents.length ? relatedStudents : groupMemberDetails.map((item) => ({
        pageId: '',
        name: item.name,
        id: item.id,
        group,
        year: summary?.year || '',
      }))).map((member) => ({
        name: member.name,
        id: member.id || 'N/A',
      }));

      const bodyIcons = relationIds(casePage, ...bodyPartAliases)
        .map((id) => bodyIconById.get(stripNotionId(id)) || '')
        .filter(Boolean);

      caseWorks.push({
        id: casePage.id,
        assignmentName: asText(property(casePage, ...caseNameAliases)).trim() || 'Untitled Case',
        members: memberDetails.map((member) => member.name),
        studentIds: relatedStudents.map((member) => stripNotionId(member.pageId)),
        memberDetails,
        description: asText(property(casePage, 'Description', 'description', 'Summary', 'summary', 'Brief', 'brief')).trim(),
        mainImage: pageFileOrCoverUrl(casePage, ...caseImageAliases),
        tags: asStringArray(property(casePage, ...keywordAliases)),
        year: asText(property(casePage, ...caseYearAliases)).trim() || summary?.year || '',
        targetUser: asText(property(casePage, ...targetUserAliases)).trim(),
        designTeam: asText(property(casePage, ...designTeamAliases)).trim(),
        interactionPart: bodyIcons[0] || '',
        group,
        cardCaseRecordType: 'case',
        sourceDatabaseId: project.sourceDatabaseId,
      });

      if (summary) {
        summary.caseIds = [...new Set([...(summary.caseIds || []), casePage.id])];
      }
    }
  }

  return [...groupSummaries.values(), ...caseWorks];
}

export async function fetchStudentWorksForProject(
  project: Project,
  fieldMapping: FieldMapping,
  relationConfig: CardCaseRelationConfig | undefined,
  warnings: NormalizationWarning[],
): Promise<StudentWork[]> {
  if (!project.sourceDatabaseId) {
    return [];
  }

  if (project.displayStyle === 'card-case') {
    return fetchCardCaseWorksForProject(project, relationConfig, warnings);
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
  relationConfigValue: string;
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
    relationConfigValue: asText(property(page, 'RelationConfig', 'Relation Config')).trim(),
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
