import { Project, StudentWork } from '../../types';

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function workKeywordTags(work: StudentWork): string[] {
  return uniqueStrings(work.tags || []);
}

export function workThemeTags(work: StudentWork): string[] {
  return uniqueStrings([work.themeTag || '', ...(work.tags || [])]);
}

export function collectThemeTags(works: StudentWork[]): string[] {
  return uniqueStrings(works.flatMap((work) => workThemeTags(work))).sort((a, b) => a.localeCompare(b));
}

export function collectKeywordTags(works: StudentWork[]): string[] {
  return uniqueStrings(works.flatMap((work) => workKeywordTags(work))).sort((a, b) => a.localeCompare(b));
}

function activitySortTimestamp(work: StudentWork): number {
  const primary = work.startDate || work.endDate;
  if (primary) {
    const parsed = Date.parse(primary);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (work.year) {
    const parsed = Date.parse(`${work.year}-12-31`);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NEGATIVE_INFINITY;
}

function createdAtTimestamp(work: StudentWork): number {
  if (!work.createdAt) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(work.createdAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function filterAndSortWorksForDisplay(
  works: StudentWork[],
  options: {
    displayStyle?: Project['displayStyle'];
    selectedYear: string;
    selectedThemeTag: string;
    selectedKeywordTag: string;
    starredOnly: boolean;
  },
): StudentWork[] {
  const supportsThemeFilter = options.displayStyle === 'blog-post' || options.displayStyle === 'activity-event';
  const supportsKeywordFilter = options.displayStyle === 'gallery-story';

  let result = works;

  if (options.selectedYear !== 'ALL') {
    result = result.filter((work) => work.year === options.selectedYear);
  }

  if (supportsThemeFilter && options.selectedThemeTag !== 'ALL') {
    result = result.filter((work) => workThemeTags(work).includes(options.selectedThemeTag));
  }

  if (supportsKeywordFilter && options.selectedKeywordTag !== 'ALL') {
    result = result.filter((work) => workKeywordTags(work).includes(options.selectedKeywordTag));
  }

  if (options.starredOnly) {
    result = result.filter((work) => work.isStarred);
  }

  if (options.displayStyle === 'data-matrix') return result;

  return [...result].sort((left, right) => {
    const isInstruction = (work: StudentWork) =>
      (work.tags || []).some((tag) => tag.trim().toLowerCase() === 'instruction');
    const instructionDelta = Number(isInstruction(right)) - Number(isInstruction(left));
    if (instructionDelta) return instructionDelta;

    const timestamp = options.displayStyle === 'activity-event'
      ? activitySortTimestamp
      : createdAtTimestamp;
    const leftTime = timestamp(left);
    const rightTime = timestamp(right);
    if (leftTime !== rightTime) return leftTime > rightTime ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
}

export function sortCardCaseWorks(works: StudentWork[]): StudentWork[] {
  return filterAndSortWorksForDisplay(works, {
    displayStyle: 'card-case',
    selectedYear: 'ALL',
    selectedThemeTag: 'ALL',
    selectedKeywordTag: 'ALL',
    starredOnly: false,
  });
}
