import { runMappingPipeline } from './mappingPipeline';
import { fetchCourseBySlug, fetchDatabaseSchema, fetchProjectSyncContext, findCourseSlugByPageId, findProjectPageIdBySourceDatabaseId, updatePageProperties } from './notion';
import { generateCourseWebsite } from './generator';
import { CardCaseRelationConfig, FieldMapping } from '../../shared/contracts';
import { mapUiPattern, parseFieldMapping } from '../../shared/notionMapper';

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

function serializeFieldMappingToDsl(fieldMapping: FieldMapping): string {
  const lines: string[] = [];
  for (const [targetField, rule] of Object.entries(fieldMapping)) {
    if (!rule) continue;
    const candidatesList = (rule.sourceCandidates || []).slice(0, 3);
    const candidates = candidatesList.length ? candidatesList.join(',') : 'null';
    const transform = rule.transform || 'string';
    lines.push(`${targetField}=${candidates}|${transform}`);
  }
  return lines.join('\n');
}

function serializeRelationConfig(config: CardCaseRelationConfig): string {
  return JSON.stringify(config, null, 2);
}

function candidateNames(input: string): string[] {
  return [input, input.toLowerCase(), input.replace(/\s+/g, ''), input.toLowerCase().replace(/\s+/g, '')];
}

function pickSchemaField(
  schema: Record<string, PropertySchema>,
  options: { aliases: string[]; type?: string; fallback?: string },
): string {
  const entries = Object.entries(schema);
  for (const alias of options.aliases) {
    for (const [name, value] of entries) {
      if (options.type && value?.type !== options.type) continue;
      if (candidateNames(name).includes(alias.toLowerCase().replace(/\s+/g, ''))) {
        return name;
      }
    }
  }

  if (options.fallback && schema[options.fallback]) {
    return options.fallback;
  }

  return '';
}

function extractRelationDatabaseId(schema: Record<string, PropertySchema>, fieldName: string): string {
  const property = schema[fieldName];
  const relation = property?.relation;
  if (relation && typeof relation === 'object' && typeof (relation as any).database_id === 'string') {
    return String((relation as any).database_id).trim();
  }
  return '';
}

async function inferCardCaseRelationConfig(params: {
  sourceDatabaseId: string;
  sourceSchema: Record<string, PropertySchema>;
}): Promise<CardCaseRelationConfig | null> {
  const entryCaseRelationField = pickSchemaField(params.sourceSchema, {
    aliases: ['CaseCards', 'Case Cards', 'Cases'],
    type: 'relation',
  });
  if (!entryCaseRelationField) {
    return null;
  }

  const caseDatabaseId = extractRelationDatabaseId(params.sourceSchema, entryCaseRelationField);
  if (!caseDatabaseId) {
    return null;
  }

  const caseSchema = (await fetchDatabaseSchema(caseDatabaseId)) as Record<string, PropertySchema>;
  const caseBodyRelationField = pickSchemaField(caseSchema, {
    aliases: ['BodyPart', 'Body Part', 'Interaction Part'],
    type: 'relation',
  });
  if (!caseBodyRelationField) {
    return null;
  }

  const bodyDatabaseId = extractRelationDatabaseId(caseSchema, caseBodyRelationField);
  if (!bodyDatabaseId) {
    return null;
  }

  const bodySchema = (await fetchDatabaseSchema(bodyDatabaseId)) as Record<string, PropertySchema>;

  return {
    entry: {
      databaseId: params.sourceDatabaseId,
      groupField: pickSchemaField(params.sourceSchema, { aliases: ['group', 'Project Group', 'Team'], fallback: 'group' }),
      studentNameField: pickSchemaField(params.sourceSchema, { aliases: ['StudentName', 'Student Name', 'Name'], fallback: 'StudentName' }),
      studentIdField: pickSchemaField(params.sourceSchema, { aliases: ['StudentID', 'Student Id', 'Student ID', 'ID'], fallback: 'StudentID' }),
      yearField: pickSchemaField(params.sourceSchema, { aliases: ['year', 'Year', 'Academic Year'], fallback: 'year' }),
      caseRelationField: entryCaseRelationField,
    },
    case: {
      databaseId: caseDatabaseId,
      nameField: pickSchemaField(caseSchema, { aliases: ['CaseName', 'Case Name', 'Name'], fallback: 'CaseName' }),
      bodyRelationField: caseBodyRelationField,
      imageField: pickSchemaField(caseSchema, { aliases: ['mainImage', 'Main Image', 'Image', 'Cover'], fallback: 'mainImage' }),
      targetUserField: pickSchemaField(caseSchema, { aliases: ['TargetUser', 'Target User', 'Audience'], fallback: 'TargetUser' }),
      yearField: pickSchemaField(caseSchema, { aliases: ['CaseYear', 'Case Year', 'Year'], fallback: 'CaseYear' }),
      designTeamField: pickSchemaField(caseSchema, { aliases: ['DesignTeam', 'Design Team', 'Team'], fallback: 'DesignTeam' }),
      keywordsField: pickSchemaField(caseSchema, { aliases: ['Keywords', 'Keyword', 'Tags'], fallback: 'Keywords' }),
      studentRelationField: pickSchemaField(caseSchema, { aliases: ['StudentName', 'Student Name', 'Students'], type: 'relation', fallback: 'StudentName' }),
    },
    body: {
      databaseId: bodyDatabaseId,
      iconField: pickSchemaField(bodySchema, { aliases: ['Icon', 'Body Icon'], fallback: 'Icon' }),
    },
  };
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
  sourceDatabaseId?: string;
  overwrite?: boolean;
  forceReinfer?: boolean;
}) {
  let projectPageId = (params.projectPageId || '').trim();
  const sourceDatabaseIdInput = (params.sourceDatabaseId || '').trim();

  if (!projectPageId && sourceDatabaseIdInput) {
    const resolvedPageId = await findProjectPageIdBySourceDatabaseId(sourceDatabaseIdInput);
    if (!resolvedPageId) {
      throw new Error(`Cannot find project by SourceDatabaseId: ${sourceDatabaseIdInput}`);
    }
    projectPageId = resolvedPageId;
  }

  if (!projectPageId) {
    throw new Error('Missing target project identifier (projectPageId or sourceDatabaseId).');
  }

  const { page, sourceDatabaseId, fieldMappingValue, relationConfigValue, uiPatternValue } = await fetchProjectSyncContext(projectPageId);
  const sourceSchema = await fetchDatabaseSchema(sourceDatabaseId);
  const propertyMeta = Object.entries(sourceSchema).map(([name, schema]) => ({
    name,
    ...(schema && typeof schema === 'object' ? schema : {}),
  }));

  const selectedUiPattern = uiPatternValue
    ? mapUiPattern(uiPatternValue, [], { projectId: projectPageId, sourceDatabaseId })
    : undefined;

  const pipelineResult = runMappingPipeline({
    sourceDatabaseId,
    records: [],
    overwrite: Boolean(params.overwrite),
    propertyMeta,
    uiPattern: selectedUiPattern,
  });

  const nextFieldMapping = serializeFieldMappingToDsl(pipelineResult.fieldMapping);
  const nextUiPattern = pipelineResult.uiPattern;
  const hasExistingFieldMapping = Boolean(fieldMappingValue);
  const hasExistingRelationConfig = Boolean(relationConfigValue);
  const forceReinfer = Boolean(params.forceReinfer);

  // Preserve manual mapping by default; only regenerate FieldMapping when explicitly requested.
  const shouldUpdateFieldMapping = forceReinfer || !hasExistingFieldMapping;
  const shouldUpdateRelationConfig = selectedUiPattern === 'card-case' && (Boolean(params.overwrite) || forceReinfer || !hasExistingRelationConfig);
  const shouldUpdateUiPattern = params.overwrite || !uiPatternValue;

  const existingFieldMapping = parseFieldMapping(fieldMappingValue, [], { projectId: projectPageId, sourceDatabaseId });
  const effectiveFieldMapping = shouldUpdateFieldMapping ? pipelineResult.fieldMapping : existingFieldMapping;

  const propertiesPatch: Record<string, unknown> = {};

  if (shouldUpdateFieldMapping && page.properties.FieldMapping) {
    const patch = buildPatchByType(page.properties.FieldMapping, nextFieldMapping);
    if (patch) propertiesPatch.FieldMapping = patch;
  }

  let nextRelationConfig: CardCaseRelationConfig | null = null;
  if (selectedUiPattern === 'card-case') {
    nextRelationConfig = await inferCardCaseRelationConfig({
      sourceDatabaseId,
      sourceSchema: sourceSchema as Record<string, PropertySchema>,
    });
  }

  if (shouldUpdateRelationConfig && nextRelationConfig) {
    const relationProp = page.properties.RelationConfig || page.properties['Relation Config'];
    if (relationProp) {
      const patch = buildPatchByType(relationProp, serializeRelationConfig(nextRelationConfig));
      const key = page.properties.RelationConfig ? 'RelationConfig' : 'Relation Config';
      if (patch) propertiesPatch[key] = patch;
    }
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
    inferredFieldMapping: effectiveFieldMapping,
    inferredRelationConfig: nextRelationConfig,
    confidenceReport: pipelineResult.confidenceReport,
    mappingVersion: pipelineResult.mappingRecord.version,
    overwrite: Boolean(params.overwrite),
    forceReinfer,
  };
}

export async function resolveCoursePageIdBySlug(slug: string): Promise<string | undefined> {
  const warnings = [];
  const result = await fetchCourseBySlug(slug, warnings);
  return result.pageId;
}
