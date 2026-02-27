import fs from 'node:fs';
import path from 'node:path';
import { StudentWork } from '../../src/types';
import { FieldMapping, MappingRule, NormalizationWarning, UI_PATTERN_FALLBACK, UiPattern } from '../../shared/contracts';
import { normalizeStudentWork } from '../../shared/notionMapper';

type UnknownRecord = Record<string, unknown>;

type ProfiledField = {
  name: string;
  inferredTypes: string[];
  nullRate: number;
  sampleValues: unknown[];
};

export type SchemaProfile = {
  sourceDatabaseId: string;
  totalRecords: number;
  fields: Record<string, ProfiledField>;
};

export type ConfidenceItem = {
  targetField: string;
  score: number;
  reason: string;
  status: 'auto' | 'review';
};

export type FileMappingRecord = {
  sourceDatabaseId: string;
  uiPattern: UiPattern;
  version: string;
  fieldMapping: FieldMapping;
  confidenceReport: ConfidenceItem[];
  updatedAt: string;
};

const UI_PATTERNS: UiPattern[] = ['card-spec', 'data-matrix', 'gallery-slide', 'gallery-story', 'generic-card'];
const TARGET_SCHEMA_FIELDS: Array<keyof StudentWork> = [
  'id',
  'assignmentName',
  'members',
  'description',
  'mainImage',
  'moreImages',
  'url',
  'video',
  'tags',
  'year',
  'isStarred',
  'methodologies',
  'dataSpecs',
  'sourceDatabaseId',
  'gridLocation',
];
const BASE_TEMPLATE_FIELDS: Array<keyof StudentWork> = ['assignmentName', 'members', 'description', 'mainImage'];
const TEMPLATE_FIELDS_BY_PATTERN: Record<UiPattern, Array<keyof StudentWork>> = {
  'generic-card': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'tags', 'year', 'isStarred'],
  'gallery-slide': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'year', 'tags'],
  'gallery-story': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'methodologies', 'url', 'year', 'tags'],
  'card-spec': [...BASE_TEMPLATE_FIELDS, 'dataSpecs', 'tags', 'year'],
  'data-matrix': [...BASE_TEMPLATE_FIELDS, 'gridLocation', 'year', 'tags'],
};

const mappingStorePath = path.resolve(process.cwd(), 'server/data/filemapping-records.json');

function detectType(value: unknown): string {
  if (value == null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function getSourceValue(record: UnknownRecord, candidates: string[]): unknown {
  for (const key of candidates) {
    if (key in record && record[key] != null) {
      return record[key];
    }
  }
  return undefined;
}

function inferTransformFromField(field: keyof StudentWork): MappingRule['transform'] {
  if (['members', 'moreImages', 'tags', 'methodologies'].includes(field)) return 'string[]';
  if (field === 'isStarred') return 'boolean';
  if (field === 'dataSpecs') return 'json';
  return 'string';
}

function defaultValueForField(field: keyof StudentWork): unknown {
  switch (field) {
    case 'assignmentName':
      return 'Untitled';
    case 'members':
      return [];
    case 'description':
      return '';
    case 'mainImage':
      return 'https://picsum.photos/seed/fallback/800/600';
    case 'isStarred':
      return false;
    case 'tags':
    case 'methodologies':
    case 'moreImages':
    case 'dataSpecs':
      return [];
    default:
      return undefined;
  }
}

function keywordCandidates(field: keyof StudentWork): string[] {
  switch (field) {
    case 'id':
      return ['id', 'recordid', 'pageid'];
    case 'assignmentName':
      return ['assignmentname', 'assignment', 'title', 'name', 'project'];
    case 'members':
      return ['members', 'member', 'author', 'student', 'team'];
    case 'description':
      return ['description', 'summary', 'content', 'story'];
    case 'mainImage':
      return ['mainimage', 'main image', 'cover', 'image', 'thumbnail'];
    case 'moreImages':
      return ['moreimages', 'more image', 'images', 'gallery', 'slides'];
    case 'url':
      return ['url', 'link', 'website'];
    case 'video':
      return ['video', 'youtube', 'vimeo'];
    case 'tags':
      return ['tag', 'category', 'topic'];
    case 'year':
      return ['year', 'semester', 'date'];
    case 'isStarred':
      return ['star', 'featured', 'recommend'];
    case 'methodologies':
      return ['method', 'methodology', 'process'];
    case 'dataSpecs':
      return ['dataspec', 'data spec', 'spec', 'metric', 'timestamp'];
    case 'sourceDatabaseId':
      return ['sourcedatabaseid', 'source database id'];
    case 'gridLocation':
      return ['gridlocation', 'grid location', 'grid', 'cell', 'location'];
    default:
      return [];
  }
}

function scoreStatus(score: number, threshold: number): 'auto' | 'review' {
  if (score >= threshold) return 'auto';
  return 'review';
}

function parseDatacardText(text: string, timezone: string): Array<{ label: string; value: string; timestamp: string }> {
  const sections = text.split(';;').map((s) => s.trim()).filter(Boolean);
  const items: Array<{ label: string; value: string; timestamp: string }> = [];

  for (const section of sections) {
    const matched = section.match(/^\[(.+?)\]\s*(.*)$/);
    if (!matched) continue;
    const label = matched[1].trim();
    const value = matched[2].trim();

    let timestamp = '';
    if (/timestamp/i.test(label)) {
      const maybeDate = new Date(value.replace(/\//g, '-'));
      if (!Number.isNaN(maybeDate.getTime())) {
        // Keep timezone data explicit with a conservative fixed offset for Asia/Taipei.
        if (timezone === 'Asia/Taipei') {
          const iso = maybeDate.toISOString().replace('.000Z', '+08:00');
          timestamp = iso;
        } else {
          timestamp = maybeDate.toISOString();
        }
      }
    }

    items.push({ label, value, timestamp });
  }

  return items;
}

function ensureStoreDir() {
  const dir = path.dirname(mappingStorePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadMappingStore(): FileMappingRecord[] {
  if (!fs.existsSync(mappingStorePath)) {
    return [];
  }
  const raw = fs.readFileSync(mappingStorePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as FileMappingRecord[];
    }
  } catch {
    return [];
  }
  return [];
}

function saveMappingStore(records: FileMappingRecord[]) {
  ensureStoreDir();
  fs.writeFileSync(mappingStorePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function bumpPatchVersion(version: string | undefined): string {
  if (!version) return '1.0.0';
  const parts = version.split('.').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v) || v < 0)) {
    return '1.0.0';
  }
  parts[2] += 1;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function profileSourceSchema(params: {
  sourceDatabaseId: string;
  records: UnknownRecord[];
  propertyMeta?: Array<Record<string, unknown>>;
}): SchemaProfile {
  const allFieldNames = new Set<string>();
  for (const record of params.records) {
    for (const key of Object.keys(record || {})) {
      allFieldNames.add(key);
    }
  }

  for (const meta of params.propertyMeta || []) {
    const name = typeof meta?.name === 'string' ? meta.name : '';
    if (name) allFieldNames.add(name);
  }

  const fields: Record<string, ProfiledField> = {};
  const total = params.records.length || 1;

  for (const fieldName of allFieldNames) {
    const values = params.records.map((record) => record[fieldName]);
    const nullCount = values.filter((v) => v == null || v === '').length;
    const inferredTypes = [...new Set(values.map(detectType))].filter((t) => t !== 'null');
    const sampleValues = values.filter((v) => v != null && v !== '').slice(0, 3);

    fields[fieldName] = {
      name: fieldName,
      inferredTypes,
      nullRate: Number((nullCount / total).toFixed(4)),
      sampleValues,
    };
  }

  return {
    sourceDatabaseId: params.sourceDatabaseId,
    totalRecords: params.records.length,
    fields,
  };
}

export function inferUiPattern(params: {
  sourceDatabaseId: string;
  schemaProfile: SchemaProfile;
  allowedPatterns?: UiPattern[];
}): { uiPattern: UiPattern; score: number; reasons: string[] } {
  const allowed = params.allowedPatterns?.length ? params.allowedPatterns : UI_PATTERNS;
  const names = Object.keys(params.schemaProfile.fields).map((name) => name.toLowerCase());
  const reasons: string[] = [];

  const hasGrid = names.some((n) => n.includes('grid') || n.includes('cell') || n.includes('location'));
  const hasDataSpecs = names.some((n) => n.includes('dataspec') || n.includes('metric') || n.includes('timestamp'));
  const hasGallery = names.some((n) => n.includes('gallery') || n.includes('more image') || n.includes('moreimage'));
  const hasStory = names.some((n) => n.includes('story') || n.includes('narrative') || n.includes('method'));

  let uiPattern: UiPattern = UI_PATTERN_FALLBACK;
  let score = 0.65;

  if (hasGrid && allowed.includes('data-matrix')) {
    uiPattern = 'data-matrix';
    score = 0.93;
    reasons.push('Detected grid/cell/location signals.');
  } else if (hasDataSpecs && allowed.includes('card-spec')) {
    uiPattern = 'card-spec';
    score = 0.9;
    reasons.push('Detected data spec / metric / timestamp signals.');
  } else if (hasGallery && allowed.includes('gallery-slide')) {
    uiPattern = 'gallery-slide';
    score = 0.87;
    reasons.push('Detected gallery image signals.');
  } else if (hasStory && allowed.includes('gallery-story')) {
    uiPattern = 'gallery-story';
    score = 0.84;
    reasons.push('Detected story/methodology signals.');
  } else {
    uiPattern = UI_PATTERN_FALLBACK;
    reasons.push('No strong pattern signal, fallback to generic-card.');
  }

  return { uiPattern, score, reasons };
}

export function inferFieldMapping(params: {
  sourceDatabaseId: string;
  uiPattern: UiPattern;
  schemaProfile: SchemaProfile;
  targetSchemaFields: string[];
  historicalMappings?: FileMappingRecord[];
  confidenceThreshold?: number;
}): { fieldMapping: FieldMapping; confidenceReport: ConfidenceItem[] } {
  const availableFields = Object.keys(params.schemaProfile.fields);
  const availableLower = new Map(availableFields.map((name) => [name.toLowerCase(), name]));
  const threshold = params.confidenceThreshold ?? 0.85;

  const fieldMapping: FieldMapping = {};
  const confidenceReport: ConfidenceItem[] = [];

  for (const fieldNameRaw of params.targetSchemaFields) {
    const fieldName = fieldNameRaw as keyof StudentWork;

    if (fieldName === 'sourceDatabaseId') {
      continue;
    }

    const exact = availableLower.get(fieldName.toLowerCase());
    const keywords = keywordCandidates(fieldName);
    const fuzzy = availableFields.filter((candidate) => {
      const lowered = candidate.toLowerCase();
      return keywords.some((kw) => lowered.includes(kw));
    });

    let sourceCandidates: string[] = [];
    let score = 0.5;
    let reason = 'No clear source field matched; using default.';

    if (exact) {
      sourceCandidates = [exact];
      score = 0.95;
      reason = `Exact field match for ${fieldName}.`;
    } else if (fuzzy.length > 0) {
      sourceCandidates = fuzzy;
      score = 0.86;
      reason = `Keyword-based match for ${fieldName}.`;
    } else if (params.historicalMappings?.length) {
      const history = params.historicalMappings.find((record) => record.sourceDatabaseId === params.sourceDatabaseId);
      const fromHistory = history?.fieldMapping[fieldName]?.sourceCandidates;
      if (fromHistory?.length) {
        sourceCandidates = fromHistory;
        score = 0.8;
        reason = `Using historical mapping for ${fieldName}.`;
      }
    }

    fieldMapping[fieldName] = {
      sourceCandidates,
      transform: inferTransformFromField(fieldName),
      default: defaultValueForField(fieldName),
    };

    confidenceReport.push({
      targetField: fieldName,
      score,
      reason,
      status: scoreStatus(score, threshold),
    });
  }

  return { fieldMapping, confidenceReport };
}

export function getTemplateTargetFields(uiPattern: UiPattern): string[] {
  return TEMPLATE_FIELDS_BY_PATTERN[uiPattern] ?? TEMPLATE_FIELDS_BY_PATTERN[UI_PATTERN_FALLBACK];
}

export function parseDatacardTextTool(params: {
  text: string;
  timezone?: string;
}): { label_value_pairs: Array<{ label: string; value: string; timestamp: string }> } {
  const timezone = params.timezone || 'Asia/Taipei';
  return {
    label_value_pairs: parseDatacardText(params.text, timezone),
  };
}

export function normalizeStudentWorkRecord(params: {
  sourceDatabaseId: string;
  rawRecord: UnknownRecord;
  fieldMapping: FieldMapping;
  timezone?: string;
}): { normalized: StudentWork; warnings: NormalizationWarning[] } {
  const warnings: NormalizationWarning[] = [];
  const normalized = normalizeStudentWork(params.rawRecord, params.sourceDatabaseId, params.fieldMapping, warnings, {
    sourceDatabaseId: params.sourceDatabaseId,
  });

  if ((!normalized.dataSpecs || normalized.dataSpecs.length === 0) && typeof getSourceValue(params.rawRecord, params.fieldMapping.dataSpecs?.sourceCandidates || []) === 'string') {
    const text = String(getSourceValue(params.rawRecord, params.fieldMapping.dataSpecs?.sourceCandidates || []) || '');
    if (text.includes('[') && text.includes(']')) {
      normalized.dataSpecs = parseDatacardText(text, params.timezone || 'Asia/Taipei');
    }
  }

  return { normalized, warnings };
}

export function validateRecordsForPattern(params: {
  uiPattern: UiPattern;
  records: StudentWork[];
}): { valid: boolean; findings: string[] } {
  const findings: string[] = [];

  for (const record of params.records) {
    if (!record.assignmentName) findings.push(`${record.id}: assignmentName missing`);
    if (!record.mainImage) findings.push(`${record.id}: mainImage missing`);

    if (params.uiPattern === 'data-matrix' && !record.gridLocation) {
      findings.push(`${record.id}: gridLocation required for data-matrix`);
    }

    if (params.uiPattern === 'card-spec' && (!record.dataSpecs || record.dataSpecs.length === 0)) {
      findings.push(`${record.id}: dataSpecs recommended for card-spec`);
    }
  }

  return {
    valid: findings.length === 0,
    findings,
  };
}

export function upsertFileMappingRecord(params: FileMappingRecord): { updated: boolean; record: FileMappingRecord } {
  const store = loadMappingStore();
  const index = store.findIndex((item) => item.sourceDatabaseId === params.sourceDatabaseId && item.uiPattern === params.uiPattern);

  if (index >= 0) {
    store[index] = params;
  } else {
    store.push(params);
  }

  saveMappingStore(store);
  return { updated: true, record: params };
}

export function runMappingPipeline(params: {
  sourceDatabaseId: string;
  records: UnknownRecord[];
  overwrite?: boolean;
  confidenceThreshold?: number;
  timezone?: string;
  propertyMeta?: Array<Record<string, unknown>>;
  uiPattern?: UiPattern;
}): {
  sourceDatabaseId: string;
  uiPattern: UiPattern;
  fieldMapping: FieldMapping;
  confidenceReport: ConfidenceItem[];
  normalizedRecords: StudentWork[];
  warnings: NormalizationWarning[];
  validation: { valid: boolean; findings: string[] };
  mappingRecord: FileMappingRecord;
} {
  const schemaProfile = profileSourceSchema({
    sourceDatabaseId: params.sourceDatabaseId,
    records: params.records,
    propertyMeta: params.propertyMeta,
  });

  const inferredPattern = inferUiPattern({
    sourceDatabaseId: params.sourceDatabaseId,
    schemaProfile,
  });
  const effectiveUiPattern = params.uiPattern || inferredPattern.uiPattern;

  const store = loadMappingStore();
  const historicalMappings = store.filter((item) => item.sourceDatabaseId === params.sourceDatabaseId);

  const { fieldMapping, confidenceReport } = inferFieldMapping({
    sourceDatabaseId: params.sourceDatabaseId,
    uiPattern: effectiveUiPattern,
    schemaProfile,
    targetSchemaFields: getTemplateTargetFields(effectiveUiPattern),
    historicalMappings,
    confidenceThreshold: params.confidenceThreshold,
  });

  const warnings: NormalizationWarning[] = [];
  const normalizedRecords = params.records.map((record) => {
    const { normalized, warnings: rowWarnings } = normalizeStudentWorkRecord({
      sourceDatabaseId: params.sourceDatabaseId,
      rawRecord: record,
      fieldMapping,
      timezone: params.timezone,
    });
    warnings.push(...rowWarnings);
    return normalized;
  });

  const validation = validateRecordsForPattern({
    uiPattern: effectiveUiPattern,
    records: normalizedRecords,
  });

  const existing = store.find((item) => item.sourceDatabaseId === params.sourceDatabaseId && item.uiPattern === effectiveUiPattern);
  const version = params.overwrite ? bumpPatchVersion(existing?.version) : existing?.version || '1.0.0';

  const mappingRecord: FileMappingRecord = {
    sourceDatabaseId: params.sourceDatabaseId,
    uiPattern: effectiveUiPattern,
    version,
    fieldMapping,
    confidenceReport,
    updatedAt: new Date().toISOString(),
  };

  upsertFileMappingRecord(mappingRecord);

  return {
    sourceDatabaseId: params.sourceDatabaseId,
    uiPattern: effectiveUiPattern,
    fieldMapping,
    confidenceReport,
    normalizedRecords,
    warnings,
    validation,
    mappingRecord,
  };
}

export function listFunctionTools() {
  return {
    version: '1.0.0',
    name: 'ui-pattern-mapping-tools',
    tools: [
      'profile_source_schema',
      'infer_ui_pattern',
      'infer_field_mapping',
      'parse_datacard_text',
      'normalize_student_work_record',
      'validate_records_for_pattern',
      'upsert_file_mapping_record',
      'run_mapping_pipeline',
    ],
  };
}

export function executeFunctionTool(toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case 'profile_source_schema':
      return profileSourceSchema({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        records: (args.records as UnknownRecord[]) || [],
        propertyMeta: (args.propertyMeta as Array<Record<string, unknown>>) || undefined,
      });
    case 'infer_ui_pattern':
      return inferUiPattern({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        schemaProfile: args.schemaProfile as SchemaProfile,
        allowedPatterns: (args.allowedPatterns as UiPattern[]) || undefined,
      });
    case 'infer_field_mapping':
      return inferFieldMapping({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        uiPattern: (args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK,
        schemaProfile: args.schemaProfile as SchemaProfile,
        targetSchemaFields: (args.targetSchemaFields as string[]) || TARGET_SCHEMA_FIELDS,
        historicalMappings: (args.historicalMappings as FileMappingRecord[]) || undefined,
        confidenceThreshold: typeof args.confidenceThreshold === 'number' ? args.confidenceThreshold : undefined,
      });
    case 'parse_datacard_text':
      return parseDatacardTextTool({
        text: String(args.text || ''),
        timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
      });
    case 'normalize_student_work_record':
      return normalizeStudentWorkRecord({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        rawRecord: (args.rawRecord as UnknownRecord) || {},
        fieldMapping: (args.fieldMapping as FieldMapping) || {},
        timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
      });
    case 'validate_records_for_pattern':
      return validateRecordsForPattern({
        uiPattern: (args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK,
        records: (args.records as StudentWork[]) || [],
      });
    case 'upsert_file_mapping_record':
      return upsertFileMappingRecord({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        uiPattern: ((args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK),
        version: String(args.version || '1.0.0'),
        fieldMapping: (args.fieldMapping as FieldMapping) || {},
        confidenceReport: (args.confidenceReport as ConfidenceItem[]) || [],
        updatedAt: String(args.updatedAt || new Date().toISOString()),
      });
    case 'run_mapping_pipeline':
      return runMappingPipeline({
        sourceDatabaseId: String(args.sourceDatabaseId || ''),
        records: (args.records as UnknownRecord[]) || [],
        overwrite: Boolean(args.overwrite),
        confidenceThreshold: typeof args.confidenceThreshold === 'number' ? args.confidenceThreshold : undefined,
        timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
        propertyMeta: (args.propertyMeta as Array<Record<string, unknown>>) || undefined,
        uiPattern: (args.uiPattern as UiPattern) || undefined,
      });
    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}
