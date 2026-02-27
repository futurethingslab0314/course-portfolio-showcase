import { FieldMapping, UiPattern } from '../../shared/contracts';
import { fetchCourseBySlug, fetchDatabaseSchema, fetchProjectSyncContext, findCourseSlugByPageId, updatePageProperties } from './notion';
import { generateCourseWebsite } from './generator';

type PropertySchema = { type?: string } & Record<string, unknown>;

const UI_PATTERNS: UiPattern[] = ['card-spec', 'data-matrix', 'gallery-slide', 'gallery-story', 'generic-card'];

function lowerSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase()));
}

function pickCandidates(propertyNames: string[], keys: string[]): string[] {
  const lowered = lowerSet(keys);
  return propertyNames.filter((name) => {
    const v = name.toLowerCase();
    for (const key of lowered) {
      if (v.includes(key)) return true;
    }
    return false;
  });
}

function inferFieldMapping(propertyNames: string[]): FieldMapping {
  return {
    assignmentName: {
      sourceCandidates: pickCandidates(propertyNames, ['title', 'name', 'assignment']),
      transform: 'string',
      default: 'Untitled',
    },
    members: {
      sourceCandidates: pickCandidates(propertyNames, ['member', 'author', 'student']),
      transform: 'string[]',
      default: [],
    },
    description: {
      sourceCandidates: pickCandidates(propertyNames, ['description', 'summary', 'content', 'story']),
      transform: 'string',
      default: '',
    },
    mainImage: {
      sourceCandidates: pickCandidates(propertyNames, ['main image', 'mainimage', 'cover', 'image', 'thumbnail']),
      transform: 'string',
      default: 'https://picsum.photos/seed/fallback/800/600',
    },
    moreImages: {
      sourceCandidates: pickCandidates(propertyNames, ['more image', 'moreimage', 'images', 'gallery']),
      transform: 'string[]',
      default: [],
    },
    url: {
      sourceCandidates: pickCandidates(propertyNames, ['url', 'link', 'website']),
      transform: 'string',
    },
    video: {
      sourceCandidates: pickCandidates(propertyNames, ['video']),
      transform: 'string',
    },
    tags: {
      sourceCandidates: pickCandidates(propertyNames, ['tag', 'category']),
      transform: 'string[]',
      default: [],
    },
    year: {
      sourceCandidates: pickCandidates(propertyNames, ['year', 'semester', 'date']),
      transform: 'string',
    },
    isStarred: {
      sourceCandidates: pickCandidates(propertyNames, ['star', 'featured', 'recommend']),
      transform: 'boolean',
      default: false,
    },
    methodologies: {
      sourceCandidates: pickCandidates(propertyNames, ['method', 'methodology']),
      transform: 'string[]',
      default: [],
    },
    dataSpecs: {
      sourceCandidates: pickCandidates(propertyNames, ['dataspec', 'data spec', 'spec', 'metric']),
      transform: 'json',
      default: [],
    },
    gridLocation: {
      sourceCandidates: pickCandidates(propertyNames, ['grid', 'location', 'cell']),
      transform: 'string',
    },
  };
}

function inferUiPattern(propertyNames: string[]): UiPattern {
  const names = propertyNames.map((v) => v.toLowerCase());
  if (names.some((n) => n.includes('grid') || n.includes('cell'))) {
    return 'data-matrix';
  }
  if (names.some((n) => n.includes('dataspec') || n.includes('metric') || n.includes('timestamp'))) {
    return 'card-spec';
  }
  if (names.some((n) => n.includes('gallery') || n.includes('more image') || n.includes('moreimage'))) {
    return 'gallery-slide';
  }
  if (names.some((n) => n.includes('story') || n.includes('narrative'))) {
    return 'gallery-story';
  }
  return 'generic-card';
}

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
  const propertyNames = Object.keys(sourceSchema);

  const inferredMapping = inferFieldMapping(propertyNames);
  const inferredUiPattern = inferUiPattern(propertyNames);

  const nextFieldMapping = JSON.stringify(inferredMapping);
  const nextUiPattern = UI_PATTERNS.includes(inferredUiPattern) ? inferredUiPattern : 'generic-card';

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
    inferredFieldMapping: inferredMapping,
    overwrite: Boolean(params.overwrite),
  };
}

export async function resolveCoursePageIdBySlug(slug: string): Promise<string | undefined> {
  const warnings = [];
  const result = await fetchCourseBySlug(slug, warnings);
  return result.pageId;
}
