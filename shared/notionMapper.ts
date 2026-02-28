import { StudentWork } from '../src/types';
import { FieldMapping, MappingRule, NormalizationWarning, UI_PATTERN_FALLBACK, UI_PATTERN_MAP, UiPattern } from './contracts';

type UnknownRecord = Record<string, unknown>;

export function mapUiPattern(value: string | undefined | null, warnings: NormalizationWarning[], context: Pick<NormalizationWarning, 'courseId' | 'projectId' | 'sourceDatabaseId'>): UiPattern {
  if (!value) {
    warnings.push({
      level: 'warning',
      code: 'UI_PATTERN_MISSING',
      message: 'UiPattern is missing, fallback to GenericCard.',
      ...context,
    });
    return UI_PATTERN_FALLBACK;
  }

  const mapped = UI_PATTERN_MAP[value.trim()];
  if (mapped) {
    return mapped;
  }

  warnings.push({
    level: 'warning',
    code: 'UI_PATTERN_INVALID',
    message: `UiPattern "${value}" is invalid, fallback to GenericCard.`,
    ...context,
  });
  return UI_PATTERN_FALLBACK;
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }
  return false;
}

function firstString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        return item;
      }
    }
  }
  return '';
}

function runTransform(value: unknown, transform: string | undefined): unknown {
  switch (transform) {
    case 'string':
      return firstString(value);
    case 'string[]':
      return ensureStringArray(value);
    case 'boolean':
      return toBoolean(value);
    case 'number-string':
      return value == null ? '' : String(value);
    case 'json': {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }
    default:
      return value;
  }
}

function pickByCandidates(source: UnknownRecord, rule?: MappingRule): unknown {
  const candidates = (rule?.sourceCandidates ?? []).filter((item) => {
    const token = String(item || '').trim().toLowerCase();
    return token && token !== 'null' && token !== 'none' && token !== 'n/a' && token !== '-';
  });
  for (const key of candidates) {
    if (key in source && source[key] != null) {
      return source[key];
    }
  }
  return undefined;
}

function parseJsonObject(input: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function parseFieldMapping(raw: unknown, warnings: NormalizationWarning[], context: Pick<NormalizationWarning, 'courseId' | 'projectId' | 'sourceDatabaseId'>): FieldMapping {
  if (!raw) {
    return {};
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as FieldMapping;
  }

  if (typeof raw !== 'string') {
    warnings.push({
      level: 'warning',
      code: 'FIELDMAPPING_UNSUPPORTED',
      message: 'FieldMapping has unsupported type; ignored.',
      ...context,
    });
    return {};
  }

  const fromJson = parseJsonObject(raw);
  if (fromJson) {
    return fromJson as FieldMapping;
  }

  const map: FieldMapping = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [targetPart, sourcePart] = trimmed.split('=').map((part) => part.trim());
    if (!targetPart || !sourcePart) {
      continue;
    }

    const [sourceCandidatesPart, transform = 'string'] = sourcePart.split('|').map((part) => part.trim());
    map[targetPart as keyof StudentWork] = {
      sourceCandidates: sourceCandidatesPart
        .split(',')
        .map((item) => item.trim())
        .filter((item) => {
          const token = item.toLowerCase();
          return Boolean(item) && token !== 'null' && token !== 'none' && token !== 'n/a' && token !== '-';
        }),
      transform,
    };
  }

  return map;
}

function ensureDataSpecs(value: unknown): { label: string; value: string; timestamp: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      label: String(item.label ?? ''),
      value: String(item.value ?? ''),
      timestamp: String(item.timestamp ?? ''),
    }))
    .filter((item) => item.label || item.value || item.timestamp);
}

function buildFallbackMembers(source: UnknownRecord): string[] {
  return ensureStringArray(source.members ?? source.member ?? source.author ?? source.authors);
}

export function normalizeStudentWork(
  source: UnknownRecord,
  sourceDatabaseId: string,
  fieldMapping: FieldMapping,
  warnings: NormalizationWarning[],
  context: Pick<NormalizationWarning, 'courseId' | 'projectId' | 'sourceDatabaseId'>,
): StudentWork {
  const pick = <K extends keyof StudentWork>(field: K): unknown => {
    const rule = fieldMapping[field];
    const fromCandidate = pickByCandidates(source, rule);
    const raw = fromCandidate ?? source[field as string] ?? rule?.default;
    return runTransform(raw, rule?.transform);
  };

  const normalized: StudentWork = {
    id: String(source.id ?? source.recordId ?? crypto.randomUUID()),
    assignmentName: firstString(pick('assignmentName')) || firstString(source.title) || 'Untitled',
    members: ensureStringArray(pick('members')).length ? ensureStringArray(pick('members')) : buildFallbackMembers(source),
    description: firstString(pick('description')) || '',
    mainImage: firstString(pick('mainImage')) || firstString(source.image) || 'https://picsum.photos/seed/fallback/800/600',
    moreImages: ensureStringArray(pick('moreImages')),
    url: firstString(pick('url')) || undefined,
    video: firstString(pick('video')) || undefined,
    tags: ensureStringArray(pick('tags')),
    year: firstString(pick('year')) || undefined,
    isStarred: toBoolean(pick('isStarred')),
    methodologies: ensureStringArray(pick('methodologies')),
    dataSpecs: ensureDataSpecs(pick('dataSpecs')),
    sourceDatabaseId,
    gridLocation: firstString(pick('gridLocation')) || undefined,
  };

  if (!normalized.assignmentName || !normalized.mainImage) {
    warnings.push({
      level: 'warning',
      code: 'WORK_REQUIRED_FIELD_MISSING',
      message: 'Student work misses required fields and was defaulted.',
      workId: normalized.id,
      ...context,
    });
  }

  return normalized;
}
