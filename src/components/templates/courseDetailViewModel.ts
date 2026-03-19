import { Project, StudentWork } from '../../types';

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function workThemeTags(work: StudentWork): string[] {
  return uniqueStrings([work.themeTag || '', ...(work.tags || [])]);
}

export function collectThemeTags(works: StudentWork[]): string[] {
  return uniqueStrings(works.flatMap((work) => workThemeTags(work))).sort((a, b) => a.localeCompare(b));
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

export function filterAndSortWorksForDisplay(
  works: StudentWork[],
  options: {
    displayStyle?: Project['displayStyle'];
    selectedYear: string;
    selectedThemeTag: string;
    starredOnly: boolean;
  },
): StudentWork[] {
  const supportsThemeFilter = options.displayStyle === 'blog-post' || options.displayStyle === 'activity-event';

  let result = works;

  if (options.selectedYear !== 'ALL') {
    result = result.filter((work) => work.year === options.selectedYear);
  }

  if (supportsThemeFilter && options.selectedThemeTag !== 'ALL') {
    result = result.filter((work) => workThemeTags(work).includes(options.selectedThemeTag));
  }

  if (options.starredOnly) {
    result = result.filter((work) => work.isStarred);
  }

  if (options.displayStyle === 'activity-event') {
    result = [...result]
      .map((work, index) => ({ work, index }))
      .sort((left, right) => {
        const timeDelta = activitySortTimestamp(right.work) - activitySortTimestamp(left.work);
        if (timeDelta !== 0) {
          return timeDelta;
        }
        return left.index - right.index;
      })
      .map(({ work }) => work);
  }

  return result;
}
