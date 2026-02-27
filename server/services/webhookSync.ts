import { runMappingPipeline } from './mappingPipeline';
import { fetchCourseBySlug, fetchDatabaseSchema, fetchProjectSyncContext, findCourseSlugByPageId, updatePageProperties } from './notion';
import { generateCourseWebsite } from './generator';

type PropertySchema = { type?: string } & Record<string, unknown>;

function toRichText(content: string) {
  const trimmed = content.length > 1900 ? content.slice(0, 1900) : content;
  return [{ type: 'text', text: { content: trimmed } }];
}

function buildPatchByType(schema: PropertySchema | undefined, value: string): Record<string, unknown> | null {
  const type = schema?.type;
  if (!type) {
    return { rich_text: toRichText(value) };
  }

  switch (type) {
    case 'rich_text':
      return { rich_text: toRichText(value) };
    case 'title':
      return { title: toRichText(value) };
    case 'select':
      return { select: { name: value } };
    default:
      return null;
  }
}

function parseSyncSecret(input: unknown): string {
  return String(input || '').trim();
}

export function validateSyncSecret(secretFromRequest: string): { ok: boolean; message?: string } {
  const expected = parseSyncSecret(process.env.COURSE_LINK_SYNC_SECRET || process.env.SYNC_SECRET);
  if (!expected) {
    return { ok: true };
  }
  if (secretFromRequest === expected) {
    return { ok: true };
  }
  return { ok: false, message: 'Unauthorized sync request' };
}

export async function syncCourseLink(params: {
  baseUrl: string;
  coursePageId?: string;
  slug?: string;
}) {
  const slug = (params.slug || '').trim() || (params.coursePageId ? await findCourseSlugByPageId(params.coursePageId) : '');
  if (!slug) {
    throw new Error('Missing target course identifier (slug/coursePageId).');
  }

  const result = await generateCourseWebsite(slug, params.baseUrl);
  if (result.status !== 'generated') {
    throw new Error(result.error || 'Failed to generate course website.');
  }

  return {
    updated: 1,
    coursePageId: result.course.id,
    slug,
    courseLink: result.courseLink,
    warningCount: result.warnings.length,
  };
}

export async function syncProjectMappings(params: {
  projectPageId?: string;
  overwrite?: boolean;
}) {
  const projectPageId = (params.projectPageId || '').trim();
  if (!projectPageId) {
    throw new Error('Missing target project identifier (projectPageId).');
  }

  const { page, sourceDatabaseId, fieldMappingValue, uiPatternValue } = await fetchProjectSyncContext(projectPageId);
  const sourceSchema = await fetchDatabaseSchema(sourceDatabaseId);
  const propertyMeta = Object.entries(sourceSchema).map(([name, schema]) => ({
    name,
    ...(schema && typeof schema === 'object' ? schema : {}),
  }));

  const pipelineResult = runMappingPipeline({
    sourceDatabaseId,
    records: [],
    overwrite: Boolean(params.overwrite),
    propertyMeta,
  });

  const nextFieldMapping = JSON.stringify(pipelineResult.fieldMapping);
  const nextUiPattern = pipelineResult.uiPattern;

  const shouldUpdateFieldMapping = params.overwrite || !fieldMappingValue;
  const shouldUpdateUiPattern = params.overwrite || !uiPatternValue;

  const propertiesPatch: Record<string, unknown> = {};

  if (shouldUpdateFieldMapping && page.properties.FieldMapping) {
    const patch = buildPatchByType(page.properties.FieldMapping, nextFieldMapping);
    if (patch) propertiesPatch.FieldMapping = patch;
  }

  if (shouldUpdateUiPattern) {
    const uiProp = page.properties.UiPattern || page.properties.DisplayStyle || page.properties.Pattern;
    if (uiProp) {
      const patch = buildPatchByType(uiProp, nextUiPattern);
      const key = page.properties.UiPattern ? 'UiPattern' : page.properties.DisplayStyle ? 'DisplayStyle' : 'Pattern';
      if (patch) propertiesPatch[key] = patch;
    }
  }

  if (Object.keys(propertiesPatch).length > 0) {
    await updatePageProperties(projectPageId, propertiesPatch);
  }

  return {
    updated: Object.keys(propertiesPatch).length > 0 ? 1 : 0,
    projectPageId,
    sourceDatabaseId,
    inferredUiPattern: nextUiPattern,
    inferredFieldMapping: pipelineResult.fieldMapping,
    confidenceReport: pipelineResult.confidenceReport,
    mappingVersion: pipelineResult.mappingRecord.version,
    overwrite: Boolean(params.overwrite),
  };
}

export async function resolveCoursePageIdBySlug(slug: string): Promise<string | undefined> {
  const warnings = [];
  const result = await fetchCourseBySlug(slug, warnings);
  return result.pageId;
}
