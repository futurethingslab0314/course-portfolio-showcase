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
  matchedFrom?: 'exact' | 'history_same_db' | 'history_cross_db' | 'alias' | 'keyword' | 'fallback';
  needsReview?: boolean;
  reviewReason?: string;
};

export type FileMappingRecord = {
  sourceDatabaseId: string;
  uiPattern: UiPattern;
  version: string;
  fieldMapping: FieldMapping;
  confidenceReport: ConfidenceItem[];
  updatedAt: string;
};

const UI_PATTERNS: UiPattern[] = ['card-spec', 'data-matrix', 'gallery-slide', 'gallery-story', 'generic-card', 'blog-post', 'activity-event'];
const TARGET_SCHEMA_FIELDS: Array<keyof StudentWork> = [
  'id',
  'assignmentName',
  'members',
  'studentIds',
  'description',
  'mainImage',
  'moreImages',
  'url',
  'video',
  'tags',
  'year',
  'isStarred',
  'methodologies',
  'storyButtons',
  'dataSpecs',
  'themeTag',
  'startDate',
  'endDate',
  'country',
  'city',
  'grant',
  'publicationName',
  'sourceDatabaseId',
  'gridLocation',
];
const BASE_TEMPLATE_FIELDS: Array<keyof StudentWork> = ['assignmentName', 'members', 'description', 'mainImage'];
const TEMPLATE_FIELDS_BY_PATTERN: Record<UiPattern, Array<keyof StudentWork>> = {
  'generic-card': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'tags', 'year', 'isStarred'],
  'gallery-slide': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'year', 'tags'],
  'gallery-story': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'methodologies', 'storyButtons', 'url', 'year', 'tags'],
  'card-spec': [...BASE_TEMPLATE_FIELDS, 'dataSpecs', 'tags', 'year'],
  'data-matrix': [...BASE_TEMPLATE_FIELDS, 'gridLocation', 'year', 'tags'],
  'blog-post': [...BASE_TEMPLATE_FIELDS, 'url', 'tags', 'year', 'isStarred'],
  'activity-event': [...BASE_TEMPLATE_FIELDS, 'moreImages', 'year', 'tags', 'themeTag', 'startDate', 'endDate', 'country', 'city', 'grant', 'publicationName', 'url'],
};

const mappingStorePath = path.resolve(process.cwd(), 'server/data/filemapping-records.json');
const DEFAULT_THRESHOLD = 0.85;

const FIELD_ALIASES: Partial<Record<keyof StudentWork, string[]>> = {
  assignmentName: ['assignmentname', 'title', 'projectname', 'name', 'topic'],
  members: ['members', 'studentname', 'membername', 'authors', 'team'],
  studentIds: ['studentid', 'memberid', 'idnumber', '學號'],
  description: ['description', 'projectintro', 'summary', 'brief', 'overview', 'abstract'],
  mainImage: ['mainimage', 'cover', 'thumbnail', 'heroimage'],
  moreImages: ['moreimages', 'gallery', 'slides', 'imageset'],
  themeTag: ['themetag', 'theme tag', 'activitytype'],
  startDate: ['startdate', 'start date'],
  endDate: ['enddate', 'end date'],
  country: ['country'],
  city: ['city'],
  grant: ['grant', 'sponsor'],
  publicationName: ['publicationname', 'publication name', 'conference'],
  dataSpecs: ['dataspecs', 'datacard', 'card01', 'card02', 'spec', 'metric'],
  gridLocation: ['gridlocation', 'grid', 'cell', 'matrixlocation'],
};

const NEGATIVE_FIELD_RULES: Partial<Record<keyof StudentWork, string[]>> = {
  assignmentName: ['studentname', 'studentid', 'members'],
  members: ['studentid', 'idnumber'],
  studentIds: ['studentname', 'members'],
  gridLocation: ['year', 'tags'],
};

type MatchSource = 'exact' | 'history_same_db' | 'history_cross_db' | 'alias' | 'keyword' | 'fallback';

type CandidateProposal = {
  sourceCandidates: string[];
  score: number;
  reason: string;
  matchedFrom: MatchSource;
};

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
  if (['members', 'studentIds', 'moreImages', 'tags', 'methodologies'].includes(field)) return 'string[]';
  if (field === 'isStarred') return 'boolean';
  if (field === 'storyButtons') return 'json';
  if (field === 'dataSpecs') return 'json';
  return 'string';
}

function defaultValueForField(field: keyof StudentWork): unknown {
  switch (field) {
    case 'assignmentName':
      return 'Untitled';
    case 'members':
      return [];
    case 'studentIds':
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
    case 'storyButtons':
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
      return ['assignmentname', 'assignment', 'title', 'projectname', 'project title', 'topic', 'name'];
    case 'members':
      return ['studentname', 'student name', 'membername', 'member name', 'members', 'member', 'author', 'team'];
    case 'studentIds':
      return ['studentid', 'student id', 'memberid', 'member id', 'idnumber', '學號'];
    case 'description':
      return ['description', 'projectintro', 'project intro', 'summary', 'brief', 'abstract', 'overview', 'content', 'story'];
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
    case 'themeTag':
      return ['theme tag', 'themetag', 'activity type', 'category'];
    case 'year':
      return ['year', 'semester', 'date'];
    case 'startDate':
      return ['start date', 'startdate', 'date start'];
    case 'endDate':
      return ['end date', 'enddate', 'date end'];
    case 'country':
      return ['country', 'nation'];
    case 'city':
      return ['city', 'location city'];
    case 'grant':
      return ['grant', 'sponsor', 'funding'];
    case 'publicationName':
      return ['publication name', 'publicationname', 'conference', 'journal'];
    case 'isStarred':
      return ['star', 'featured', 'recommend'];
    case 'methodologies':
      return ['method', 'methodology', 'process'];
    case 'storyButtons':
      return ['button', 'urlbutton', 'cta', 'action'];
    case 'dataSpecs':
      return ['dataspec', 'data spec', 'spec', 'metric', 'timestamp', 'card', 'datacard'];
    case 'sourceDatabaseId':
      return ['sourcedatabaseid', 'source database id'];
    case 'gridLocation':
      return ['gridlocation', 'grid location', 'grid', 'cell', 'location'];
    default:
      return [];
  }
}

function rankCandidatesForField(field: keyof StudentWork, candidates: string[]): string[] {
  const normalized = [...new Set(candidates)];

  if (field === 'assignmentName') {
    return normalized
      .filter((candidate) => !/student|member|author/i.test(candidate))
      .sort((a, b) => {
        const wa = /assignment|title|projectname|topic|name/i.test(a) ? 1 : 0;
        const wb = /assignment|title|projectname|topic|name/i.test(b) ? 1 : 0;
        return wb - wa;
      });
  }

  if (field === 'members') {
    return normalized.sort((a, b) => {
      const wa = /studentname|membername|members|member/i.test(a) ? 1 : 0;
      const wb = /studentname|membername|members|member/i.test(b) ? 1 : 0;
      return wb - wa;
    });
  }

  if (field === 'studentIds') {
    return normalized.sort((a, b) => {
      const wa = /studentid|memberid|idnumber|學號/i.test(a) ? 1 : 0;
      const wb = /studentid|memberid|idnumber|學號/i.test(b) ? 1 : 0;
      return wb - wa;
    });
  }

  if (field === 'description') {
    return normalized.sort((a, b) => {
      const wa = /description|projectintro|summary|brief|abstract|overview|content|story/i.test(a) ? 1 : 0;
      const wb = /description|projectintro|summary|brief|abstract|overview|content|story/i.test(b) ? 1 : 0;
      return wb - wa;
    });
  }

  return normalized;
}

function scoreStatus(score: number, threshold: number): 'auto' | 'review' {
  if (score >= threshold) return 'auto';
  return 'review';
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isNegativeCandidate(field: keyof StudentWork, candidate: string): boolean {
  const blocklist = NEGATIVE_FIELD_RULES[field] ?? [];
  const token = normalizeToken(candidate);
  return blocklist.some((blocked) => token.includes(normalizeToken(blocked)));
}

function filterNegativeCandidates(field: keyof StudentWork, candidates: string[]): string[] {
  return candidates.filter((candidate) => !isNegativeCandidate(field, candidate));
}

function aliasCandidates(field: keyof StudentWork, availableFields: string[]): string[] {
  const aliases = FIELD_ALIASES[field] ?? [];
  if (aliases.length === 0) return [];
  const aliasTokens = aliases.map(normalizeToken);
  return availableFields.filter((name) => aliasTokens.includes(normalizeToken(name)));
}

function sortedByUpdatedAtDesc(records: FileMappingRecord[]): FileMappingRecord[] {
  return [...records].sort((a, b) => {
    const ta = Date.parse(a.updatedAt || '');
    const tb = Date.parse(b.updatedAt || '');
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

function historicalCandidatesForField(
  field: keyof StudentWork,
  sourceDatabaseId: string,
  historicalMappings: FileMappingRecord[] | undefined,
  availableLower: Map<string, string>,
): { sameDb: string[]; crossDb: string[] } {
  if (!historicalMappings?.length) {
    return { sameDb: [], crossDb: [] };
  }

  const sorted = sortedByUpdatedAtDesc(historicalMappings);
  const sameDb = sorted.filter((record) => record.sourceDatabaseId === sourceDatabaseId);
  const crossDb = sorted.filter((record) => record.sourceDatabaseId !== sourceDatabaseId);

  const fromSame = sameDb
    .flatMap((record) => record.fieldMapping[field]?.sourceCandidates ?? [])
    .map((candidate) => availableLower.get(candidate.toLowerCase()) || candidate);
  const fromCross = crossDb
    .flatMap((record) => record.fieldMapping[field]?.sourceCandidates ?? [])
    .map((candidate) => availableLower.get(candidate.toLowerCase()) || candidate);

  return {
    sameDb: unique(filterNegativeCandidates(field, fromSame)),
    crossDb: unique(filterNegativeCandidates(field, fromCross)),
  };
}

function maybeReviewReason(
  field: keyof StudentWork,
  selected: CandidateProposal,
  runnerUp: CandidateProposal | undefined,
  uiPattern: UiPattern,
): string | undefined {
  if (selected.score < 0.75) {
    return 'Low confidence mapping candidate.';
  }

  if (field === 'assignmentName' && selected.sourceCandidates.some((candidate) => /student|member|author/i.test(candidate))) {
    return 'assignmentName candidate appears person-related.';
  }

  if (uiPattern === 'data-matrix' && field === 'gridLocation' && selected.sourceCandidates.length === 0) {
    return 'gridLocation is required for data-matrix but no candidate found.';
  }

  if (runnerUp && Math.abs(selected.score - runnerUp.score) < 0.05) {
    return 'Competing candidates are too close in score.';
  }

  if (selected.sourceCandidates.some((candidate) => isNegativeCandidate(field, candidate))) {
    return 'Selected candidate violates negative mapping rule.';
  }

  return undefined;
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
  const threshold = params.confidenceThreshold ?? DEFAULT_THRESHOLD;

  const fieldMapping: FieldMapping = {};
  const confidenceReport: ConfidenceItem[] = [];
  const selectedPrimaryCandidates: Partial<Record<keyof StudentWork, string>> = {};

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
    const rankedFuzzy = rankCandidatesForField(fieldName, filterNegativeCandidates(fieldName, fuzzy));
    const alias = rankCandidatesForField(fieldName, filterNegativeCandidates(fieldName, aliasCandidates(fieldName, availableFields)));
    const history = historicalCandidatesForField(fieldName, params.sourceDatabaseId, params.historicalMappings, availableLower);

    const proposals: CandidateProposal[] = [];

    if (exact && !isNegativeCandidate(fieldName, exact)) {
      proposals.push({
        sourceCandidates: [exact],
        score: 0.95,
        reason: `Exact field match for ${fieldName}.`,
        matchedFrom: 'exact',
      });
    }

    if (history.sameDb.length > 0) {
      proposals.push({
        sourceCandidates: history.sameDb,
        score: 0.92,
        reason: `Using same-database historical mapping for ${fieldName}.`,
        matchedFrom: 'history_same_db',
      });
    }

    if (alias.length > 0) {
      proposals.push({
        sourceCandidates: alias,
        score: 0.9,
        reason: `Alias dictionary match for ${fieldName}.`,
        matchedFrom: 'alias',
      });
    }

    if (rankedFuzzy.length > 0) {
      proposals.push({
        sourceCandidates: rankedFuzzy,
        score: 0.86,
        reason: `Keyword-based match for ${fieldName}.`,
        matchedFrom: 'keyword',
      });
    }

    if (history.crossDb.length > 0) {
      proposals.push({
        sourceCandidates: history.crossDb,
        score: 0.82,
        reason: `Using cross-database historical mapping for ${fieldName}.`,
        matchedFrom: 'history_cross_db',
      });
    }

    if (proposals.length === 0) {
      proposals.push({
        sourceCandidates: [],
        score: 0.5,
        reason: 'No clear source field matched; using default.',
        matchedFrom: 'fallback',
      });
    }

    proposals.sort((a, b) => b.score - a.score);
    const selected = proposals[0];
    const runnerUp = proposals[1];
    const reviewReason = maybeReviewReason(fieldName, selected, runnerUp, params.uiPattern);
    const needsReview = Boolean(reviewReason) || scoreStatus(selected.score, threshold) === 'review';
    const status: 'auto' | 'review' = needsReview ? 'review' : 'auto';

    if (selected.sourceCandidates.length > 0) {
      selectedPrimaryCandidates[fieldName] = selected.sourceCandidates[0];
    }

    fieldMapping[fieldName] = {
      sourceCandidates: selected.sourceCandidates,
      transform: inferTransformFromField(fieldName),
      default: defaultValueForField(fieldName),
    };

    confidenceReport.push({
      targetField: fieldName,
      score: selected.score,
      reason: selected.reason,
      status,
      matchedFrom: selected.matchedFrom,
      needsReview,
      reviewReason,
    });
  }

  const memberSource = selectedPrimaryCandidates.members;
  const studentIdSource = selectedPrimaryCandidates.studentIds;
  if (memberSource && studentIdSource && memberSource.toLowerCase() === studentIdSource.toLowerCase()) {
    const membersItem = confidenceReport.find((item) => item.targetField === 'members');
    const studentIdsItem = confidenceReport.find((item) => item.targetField === 'studentIds');
    if (membersItem) {
      membersItem.status = 'review';
      membersItem.needsReview = true;
      membersItem.reviewReason = 'members and studentIds point to the same source field.';
    }
    if (studentIdsItem) {
      studentIdsItem.status = 'review';
      studentIdsItem.needsReview = true;
      studentIdsItem.reviewReason = 'members and studentIds point to the same source field.';
    }
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
      normalized.dataSpecs = parseDatacardText(text, params.timezone || 'Asia/Taipei').map((item) => {
        const prefix = item.label ? `[${item.label}] ` : '';
        const withLabel = `${prefix}${item.value}`.trim();
        return `${withLabel}${item.timestamp ? ` ${item.timestamp}` : ''}`.trim();
      }).filter(Boolean);
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
  const historicalMappings = store;

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
  if (toolName === 'profile_source_schema') {
    return profileSourceSchema({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      records: (args.records as UnknownRecord[]) || [],
      propertyMeta: (args.propertyMeta as Array<Record<string, unknown>>) || undefined,
    });
  }

  if (toolName === 'infer_ui_pattern') {
    return inferUiPattern({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      schemaProfile: args.schemaProfile as SchemaProfile,
      allowedPatterns: (args.allowedPatterns as UiPattern[]) || undefined,
    });
  }

  if (toolName === 'infer_field_mapping') {
    return inferFieldMapping({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      uiPattern: (args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK,
      schemaProfile: args.schemaProfile as SchemaProfile,
      targetSchemaFields: (args.targetSchemaFields as string[]) || TARGET_SCHEMA_FIELDS,
      historicalMappings: (args.historicalMappings as FileMappingRecord[]) || undefined,
      confidenceThreshold: typeof args.confidenceThreshold === 'number' ? args.confidenceThreshold : undefined,
    });
  }

  if (toolName === 'parse_datacard_text') {
    return parseDatacardTextTool({
      text: String(args.text || ''),
      timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
    });
  }

  if (toolName === 'normalize_student_work_record') {
    return normalizeStudentWorkRecord({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      rawRecord: (args.rawRecord as UnknownRecord) || {},
      fieldMapping: (args.fieldMapping as FieldMapping) || {},
      timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
    });
  }

  if (toolName === 'validate_records_for_pattern') {
    return validateRecordsForPattern({
      uiPattern: (args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK,
      records: (args.records as StudentWork[]) || [],
    });
  }

  if (toolName === 'upsert_file_mapping_record') {
    return upsertFileMappingRecord({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      uiPattern: (args.uiPattern as UiPattern) || UI_PATTERN_FALLBACK,
      version: String(args.version || '1.0.0'),
      fieldMapping: (args.fieldMapping as FieldMapping) || {},
      confidenceReport: (args.confidenceReport as ConfidenceItem[]) || [],
      updatedAt: String(args.updatedAt || new Date().toISOString()),
    });
  }

  if (toolName === 'run_mapping_pipeline') {
    return runMappingPipeline({
      sourceDatabaseId: String(args.sourceDatabaseId || ''),
      records: (args.records as UnknownRecord[]) || [],
      overwrite: Boolean(args.overwrite),
      confidenceThreshold: typeof args.confidenceThreshold === 'number' ? args.confidenceThreshold : undefined,
      timezone: typeof args.timezone === 'string' ? args.timezone : undefined,
      propertyMeta: (args.propertyMeta as Array<Record<string, unknown>>) || undefined,
      uiPattern: (args.uiPattern as UiPattern) || undefined,
    });
  }

  throw new Error(`Unknown tool name: ${toolName}`);
}
