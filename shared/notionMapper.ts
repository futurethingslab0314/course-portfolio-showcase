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

function allCandidateKeys(rule?: MappingRule): string[] {
  return (rule?.sourceCandidates ?? []).filter((item) => {
    const token = String(item || '').trim().toLowerCase();
    return token && token !== 'null' && token !== 'none' && token !== 'n/a' && token !== '-';
  });
}

function pickAllByCandidates(source: UnknownRecord, rule?: MappingRule): unknown[] {
  const candidates = allCandidateKeys(rule);
  const values: unknown[] = [];

  for (const key of candidates) {
    if (key in source && source[key] != null) {
      values.push(source[key]);
    }
  }

  return values;
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

function ensureDataSpecs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => ensureDataSpecs(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const legacyLabel = firstString(record.label);
    const legacyValue = firstString(record.value);
    const legacyTimestamp = firstString(record.timestamp);

    if (legacyLabel || legacyValue || legacyTimestamp) {
      const prefix = legacyLabel ? `[${legacyLabel}] ` : '';
      const body = `${prefix}${legacyValue}`.trim();
      const line = `${body}${legacyTimestamp ? ` ${legacyTimestamp}` : ''}`.trim();
      return line ? [line] : [];
    }

    return [];
  }

  return [];
}

function ensureStoryButtons(value: unknown): { label: string; url: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      label: firstString(item.label).trim(),
      url: firstString(item.url).trim(),
    }))
    .filter((item) => item.label && item.url);
}

function collectStoryButtonsFromSource(source: UnknownRecord): { label: string; url: string }[] {
  const buffer = new Map<string, { label?: string; url?: string }>();

  const parseButtonLabelIndex = (key: string): string | null => {
    const match = key.match(/^button(?:[\s_-]*(\d+))?(?:[\s_-]+.*)?$/i);
    if (!match) return null;
    return (match[1] || '0').padStart(4, '0');
  };

  const parseButtonUrlIndex = (key: string): string | null => {
    const normalized = key.trim();

    let match = normalized.match(/^urlbutton(?:[\s_-]*(\d+))?(?:[\s_-]+.*)?$/i);
    if (match) return (match[1] || '0').padStart(4, '0');

    match = normalized.match(/^buttonurl(?:[\s_-]*(\d+))?(?:[\s_-]+.*)?$/i);
    if (match) return (match[1] || '0').padStart(4, '0');

    return null;
  };

  for (const [key, rawValue] of Object.entries(source)) {
    const labelIndex = parseButtonLabelIndex(key);
    const urlIndex = parseButtonUrlIndex(key);

    if (!labelIndex && !urlIndex) {
      continue;
    }

    const value = firstString(rawValue).trim();
    if (!value) {
      continue;
    }

    const index = labelIndex ?? urlIndex ?? '0000';
    const current = buffer.get(index) ?? {};

    if (labelIndex) {
      current.label = value;
    }
    if (urlIndex) {
      current.url = value;
    }

    buffer.set(index, current);
  }

  return [...buffer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, item]) => ({ label: String(item.label || '').trim(), url: String(item.url || '').trim() }))
    .filter((item) => item.label && item.url);
}

function mergeStoryButtons(primary: { label: string; url: string }[], inferred: { label: string; url: string }[]): { label: string; url: string }[] {
  const merged: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...inferred]) {
    const key = `${item.label.trim()}|${item.url.trim()}`;
    if (!item.label || !item.url || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ label: item.label.trim(), url: item.url.trim() });
  }

  return merged;
}

function collectCardNamedSpecs(source: UnknownRecord): string[] {
  return Object.entries(source)
    .filter(([key]) => /card/i.test(key))
    .flatMap(([, value]) => ensureDataSpecs(value));
}

function mergeDataSpecs(primary: string[], inferred: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...inferred]) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function mergeUniqueStrings(primary: string[], secondary: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...secondary]) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }
  return merged;
}

function buildFallbackMembers(source: UnknownRecord): string[] {
  return ensureStringArray(source.members ?? source.member ?? source.author ?? source.authors);
}

function pickFirstAlias(source: UnknownRecord, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in source && source[alias] != null) {
      return source[alias];
    }
  }
  return undefined;
}

function pickAliasString(source: UnknownRecord, aliases: string[]): string {
  return firstString(pickFirstAlias(source, aliases));
}

function pickAliasStringArray(source: UnknownRecord, aliases: string[]): string[] {
  return ensureStringArray(pickFirstAlias(source, aliases));
}

function pickActivityImageUrls(source: UnknownRecord): string[] {
  return pickAliasStringArray(source, ['Files & media', 'Files and media', 'files & media', 'files and media']);
}

function extractMemberData(source: UnknownRecord, fieldMapping: FieldMapping): { memberNames: string[]; studentIds: string[] } {
  const memberRule = fieldMapping.members;
  const collectedNames: string[] = [];
  const collectedIds: string[] = [];
  const ambiguousValues: string[] = [];
  const consumedKeys = new Set<string>();

  for (const key of allCandidateKeys(memberRule)) {
    if (!(key in source) || source[key] == null) {
      continue;
    }
    consumedKeys.add(key);
    const values = ensureStringArray(source[key]);
    const token = key.toLowerCase();

    if (token.includes('id')) {
      collectedIds.push(...values);
    } else if (token.includes('name') || token.includes('member') || token.includes('student')) {
      collectedNames.push(...values);
    } else {
      ambiguousValues.push(...values);
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (consumedKeys.has(key) || value == null) {
      continue;
    }
    const token = key.toLowerCase();
    if (/student[_\s-]*id|member[_\s-]*id|學號/.test(token)) {
      collectedIds.push(...ensureStringArray(value));
      consumedKeys.add(key);
      continue;
    }
    if (/student[_\s-]*name|member[_\s-]*name|姓名|名字/.test(token)) {
      collectedNames.push(...ensureStringArray(value));
      consumedKeys.add(key);
    }
  }

  const memberNames = collectedNames.length
    ? collectedNames
    : ambiguousValues.length
      ? ambiguousValues
      : buildFallbackMembers(source);

  return {
    memberNames,
    studentIds: collectedIds,
  };
}

export function normalizeStudentWork(
  source: UnknownRecord,
  sourceDatabaseId: string,
  fieldMapping: FieldMapping,
  warnings: NormalizationWarning[],
  context: Pick<NormalizationWarning, 'courseId' | 'projectId' | 'sourceDatabaseId'>,
): StudentWork {
  const extractedMemberData = extractMemberData(source, fieldMapping);
  const activityImages = pickActivityImageUrls(source);
  const themeTagAlias = pickAliasString(source, ['theme tag', 'Theme Tag', 'themeTag', 'ThemeTag']);
  const assignmentNameAlias = pickAliasString(source, ['Activity Name', 'activity name', 'ActivityName']);
  const startDateAlias = pickAliasString(source, ['start date', 'Start Date', 'startDate', 'StartDate']);
  const endDateAlias = pickAliasString(source, ['end date', 'End Date', 'endDate', 'EndDate']);
  const publicationNameAlias = pickAliasString(source, ['publication name', 'Publication Name', 'publicationName', 'PublicationName']);
  const grantAlias = pickAliasString(source, ['grant', 'Grant', 'sponsor', 'Sponsor']);
  const countryAlias = pickAliasString(source, ['country', 'Country']);
  const cityAlias = pickAliasString(source, ['city', 'City']);
  const yearAlias = pickAliasString(source, ['year', 'Year']);

  const pick = <K extends keyof StudentWork>(field: K): unknown => {
    const rule = fieldMapping[field];
    if (field === 'members') {
      if (extractedMemberData.memberNames.length) {
        return extractedMemberData.memberNames;
      }
      const values = pickAllByCandidates(source, rule).flatMap((item) => ensureStringArray(runTransform(item, rule?.transform)));
      if (values.length) {
        return values;
      }
      return buildFallbackMembers(source);
    }
    if (field === 'studentIds') {
      if (extractedMemberData.studentIds.length) {
        return extractedMemberData.studentIds;
      }
      const values = pickAllByCandidates(source, rule).flatMap((item) => ensureStringArray(runTransform(item, rule?.transform)));
      if (values.length) {
        return values;
      }
      return [];
    }
    const fromCandidate = pickByCandidates(source, rule);
    const raw = fromCandidate ?? source[field as string] ?? rule?.default;
    return runTransform(raw, rule?.transform);
  };

  const normalized: StudentWork = {
    id: String(source.id ?? source.recordId ?? crypto.randomUUID()),
    assignmentName: firstString(pick('assignmentName')) || assignmentNameAlias || firstString(source.title) || 'Untitled',
    members: ensureStringArray(pick('members')).length ? ensureStringArray(pick('members')) : extractedMemberData.memberNames,
    studentIds: ensureStringArray(pick('studentIds')),
    description: firstString(pick('description')) || '',
    mainImage: firstString(pick('mainImage')) || activityImages[0] || firstString(source.image) || 'https://picsum.photos/seed/fallback/800/600',
    moreImages: ensureStringArray(pick('moreImages')).length ? ensureStringArray(pick('moreImages')) : activityImages.slice(1),
    url: firstString(pick('url')) || undefined,
    video: firstString(pick('video')) || undefined,
    tags: mergeUniqueStrings(
      ensureStringArray(pick('tags')),
      mergeUniqueStrings(
        ensureStringArray(source.themeTag ?? source.themetag ?? source.ThemeTag ?? source.Themetag),
        themeTagAlias ? [themeTagAlias] : [],
      ),
    ),
    year: firstString(pick('year')) || yearAlias || undefined,
    isStarred: toBoolean(pick('isStarred')),
    methodologies: ensureStringArray(pick('methodologies')),
    storyButtons: mergeStoryButtons(ensureStoryButtons(pick('storyButtons')), collectStoryButtonsFromSource(source)),
    dataSpecs: mergeDataSpecs(ensureDataSpecs(pick('dataSpecs')), collectCardNamedSpecs(source)),
    themeTag: themeTagAlias || undefined,
    startDate: startDateAlias || undefined,
    endDate: endDateAlias || undefined,
    country: countryAlias || undefined,
    city: cityAlias || undefined,
    grant: grantAlias || undefined,
    publicationName: publicationNameAlias || undefined,
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
