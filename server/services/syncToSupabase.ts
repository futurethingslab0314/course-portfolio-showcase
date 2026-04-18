import { randomUUID } from 'node:crypto';
import { CoursePayload, NormalizationWarning } from '../../shared/contracts';
import { buildCourseSyncPayloadBySlug } from './generator';
import { fetchAllCoursesWithMeta, findCourseSlugByPageId, NotionCourseMeta } from './notion';
import { isR2ImageSyncEnabled, uploadImageUrlToR2 } from './imageStoreR2';
import {
  appendSyncLog,
  deleteProjectsNotInCourse,
  deleteStudentWorksNotInProjects,
  getLastSyncAllCheckpoint,
  setCoursesInactiveByNotionIds,
  upsertCourseToSupabase,
  upsertProjectsToSupabase,
  upsertStudentWorksToSupabase,
} from './supabase';
import { BlogContentSection, StudentWork } from '../../src/types';

function logWithContext(message: string, context: Record<string, unknown>) {
  console.log(JSON.stringify({ message, ...context }));
}

type BlogImageRewriteResult = {
  blogContent: StudentWork['blogContent'];
  uploaded: number;
  skipped: number;
};

async function rewriteBlogContentImagesToR2(
  blogContent: StudentWork['blogContent'],
  rewriteUrl: (sourceUrl: string) => Promise<string>,
): Promise<BlogImageRewriteResult> {
  if (!Array.isArray(blogContent) || !blogContent.length) {
    return { blogContent, uploaded: 0, skipped: 0 };
  }

  let uploaded = 0;
  let skipped = 0;

  const rewriteSection = async (section: BlogContentSection): Promise<BlogContentSection> => {
    if (section.type === 'image') {
      const nextUrl = await rewriteUrl(section.content);
      if (nextUrl !== section.content) {
        uploaded += 1;
      } else {
        skipped += 1;
      }
      return { ...section, content: nextUrl };
    }

    if (section.type === 'toggle') {
      const children = await Promise.all(section.children.map((child) => rewriteSection(child)));
      return { ...section, children };
    }

    return section;
  };

  const nextContent = await Promise.all(blogContent.map((section) => rewriteSection(section)));
  return { blogContent: nextContent, uploaded, skipped };
}

export async function rewriteBlogContentImagesToR2ForTest(
  blogContent: StudentWork['blogContent'],
  rewriteUrl: (sourceUrl: string) => Promise<string>,
): Promise<BlogImageRewriteResult> {
  return rewriteBlogContentImagesToR2(blogContent, rewriteUrl);
}

async function rewriteWorkMediaToR2(
  work: StudentWork,
  rewriteUrl: (sourceUrl: string) => Promise<string>,
): Promise<void> {
  const mainImage = String(work.mainImage || '').trim();
  if (mainImage) {
    work.mainImage = await rewriteUrl(mainImage);
  }

  const interactionPart = String(work.interactionPart || '').trim();
  if (interactionPart) {
    work.interactionPart = await rewriteUrl(interactionPart);
  }
}

export async function rewriteWorkMediaToR2ForTest(
  work: StudentWork,
  rewriteUrl: (sourceUrl: string) => Promise<string>,
): Promise<void> {
  return rewriteWorkMediaToR2(work, rewriteUrl);
}

async function rewriteCourseCoverToR2(payload: CoursePayload, runId: string): Promise<{ uploaded: number; skipped: number }> {
  if (!isR2ImageSyncEnabled()) {
    return { uploaded: 0, skipped: 1 };
  }

  const sourceUrl = String(payload.course.coverImage || '').trim();
  if (!sourceUrl) {
    return { uploaded: 0, skipped: 1 };
  }

  try {
    // Course cover has no dedicated project row, use a stable pseudo path segment.
    const result = await uploadImageUrlToR2({
      sourceUrl,
      courseSlug: payload.course.slug || payload.course.id,
      projectNotionId: 'course-cover',
      workNotionId: `${payload.course.id}-cover`,
    });
    payload.course.coverImage = result.publicUrl;
    return { uploaded: result.uploaded ? 1 : 0, skipped: result.uploaded ? 0 : 1 };
  } catch (error) {
    payload.warnings.push({
      level: 'warning',
      code: 'R2_COURSE_COVER_UPLOAD_FAILED',
      message: error instanceof Error ? error.message : 'Unknown R2 course cover upload failure',
      courseId: payload.course.id,
    });

    await appendSyncLog({
      runId,
      entityType: 'course_cover',
      entityNotionId: payload.course.id,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown R2 course cover upload failure',
    }).catch(() => undefined);

    return { uploaded: 0, skipped: 1 };
  }
}

async function rewriteWorkImagesToR2(payload: CoursePayload, runId: string): Promise<{ uploaded: number; skipped: number }> {
  if (!isR2ImageSyncEnabled()) {
    return { uploaded: 0, skipped: payload.studentWorks.length };
  }

  let uploaded = 0;
  let skipped = 0;

  for (const work of payload.studentWorks) {
    const project = payload.projects.find((item) => item.sourceDatabaseId === work.sourceDatabaseId);
    if (!project) {
      const countBlogImages = (sections: StudentWork['blogContent']): number => {
        if (!Array.isArray(sections)) return 0;
        return sections.reduce((count, section) => {
          if (section.type === 'image') return count + 1;
          if (section.type === 'toggle') return count + countBlogImages(section.children);
          return count;
        }, 0);
      };

      const imageCount = 1 + (Array.isArray(work.moreImages) ? work.moreImages.length : 0) + countBlogImages(work.blogContent);
      skipped += imageCount;
      payload.warnings.push({
        level: 'warning',
        code: 'R2_PROJECT_NOT_FOUND',
        message: `Cannot resolve project for sourceDatabaseId (${work.sourceDatabaseId}), image uploads skipped.`,
        sourceDatabaseId: work.sourceDatabaseId,
        workId: work.id,
      });
      continue;
    }

    const rewriteOne = async (sourceUrl: string, label: 'mainImage' | 'moreImage' | 'interactionPart', index?: number): Promise<string> => {
      const trimmed = String(sourceUrl || '').trim();
      if (!trimmed) {
        skipped += 1;
        return trimmed;
      }

      try {
        const result = await uploadImageUrlToR2({
          sourceUrl: trimmed,
          courseSlug: payload.course.slug || payload.course.id,
          projectNotionId: project.id,
          workNotionId: work.id,
        });
        if (result.uploaded) {
          uploaded += 1;
        } else {
          skipped += 1;
        }
        return result.publicUrl;
      } catch (error) {
        skipped += 1;
        payload.warnings.push({
          level: 'warning',
          code: 'R2_IMAGE_UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown R2 upload failure',
          sourceDatabaseId: work.sourceDatabaseId,
          workId: work.id,
        });

        await appendSyncLog({
          runId,
          entityType: 'image',
          entityNotionId: work.id,
          status: 'failed',
          message: `${label}${typeof index === 'number' ? `[${index}]` : ''}: ${
            error instanceof Error ? error.message : 'Unknown R2 upload failure'
          }`,
        }).catch(() => undefined);
        return trimmed;
      }
    };

    const originalMainImage = String(work.mainImage || '').trim();
    const originalInteractionPart = String(work.interactionPart || '').trim();
    await rewriteWorkMediaToR2(work, async (sourceUrl) => {
      if (sourceUrl === originalMainImage) {
        return rewriteOne(sourceUrl, 'mainImage');
      }
      if (sourceUrl === originalInteractionPart) {
        return rewriteOne(sourceUrl, 'interactionPart');
      }
      return rewriteOne(sourceUrl, 'moreImage');
    });

    if (Array.isArray(work.moreImages) && work.moreImages.length > 0) {
      const next: string[] = [];
      for (let i = 0; i < work.moreImages.length; i += 1) {
        next.push(await rewriteOne(work.moreImages[i], 'moreImage', i));
      }
      work.moreImages = next.filter((item) => item.trim().length > 0);
    }

    const blogImageResult = await rewriteBlogContentImagesToR2(work.blogContent, async (sourceUrl) => {
      const trimmed = String(sourceUrl || '').trim();
      if (!trimmed) {
        return trimmed;
      }

      try {
        const result = await uploadImageUrlToR2({
          sourceUrl: trimmed,
          courseSlug: payload.course.slug || payload.course.id,
          projectNotionId: project.id,
          workNotionId: `${work.id}-blog`,
        });
        return result.publicUrl;
      } catch (error) {
        payload.warnings.push({
          level: 'warning',
          code: 'R2_BLOG_IMAGE_UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown R2 blog image upload failure',
          sourceDatabaseId: work.sourceDatabaseId,
          workId: work.id,
        });

        await appendSyncLog({
          runId,
          entityType: 'image',
          entityNotionId: work.id,
          status: 'failed',
          message: `blogContent: ${error instanceof Error ? error.message : 'Unknown R2 blog image upload failure'}`,
        }).catch(() => undefined);

        return trimmed;
      }
    });
    work.blogContent = blogImageResult.blogContent;
    uploaded += blogImageResult.uploaded;
    skipped += blogImageResult.skipped;
  }

  return { uploaded, skipped };
}

function buildProjectLookup(rows: Array<{ id: string; notion_page_id: string; source_database_id: string | null }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const sourceDatabaseId = String(row.source_database_id || '').trim();
    if (!sourceDatabaseId) continue;
    map.set(sourceDatabaseId, row.id);
  }
  return map;
}

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function byUpdatedDesc(a: NotionCourseMeta, b: NotionCourseMeta): number {
  const mb = toMs(b.lastEditedTime) || 0;
  const ma = toMs(a.lastEditedTime) || 0;
  return mb - ma;
}

export async function syncCourseToSupabase(params: {
  slug?: string;
  coursePageId?: string;
  publishedStatus?: boolean;
  notionLastEditedTime?: string;
}): Promise<{
  runId: string;
  slug: string;
  courseNotionPageId: string;
  projectCount: number;
  workCount: number;
  workUpserted: number;
  workSkipped: number;
  workDeleted: number;
  imageUploaded: number;
  imageSkipped: number;
  warnings: NormalizationWarning[];
}> {
  const runId = `sync-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const slug = (params.slug || '').trim() || (params.coursePageId ? await findCourseSlugByPageId(params.coursePageId) : '');

  if (!slug) {
    throw new Error('Missing target course identifier (slug or coursePageId).');
  }

  logWithContext('Sync to Supabase started', { runId, slug });

  const payload = await buildCourseSyncPayloadBySlug(slug);

  const coverResult = await rewriteCourseCoverToR2(payload, runId);
  const imageResult = await rewriteWorkImagesToR2(payload, runId);

  const courseRow = await upsertCourseToSupabase(payload.course, {
    isPublished: typeof params.publishedStatus === 'boolean' ? params.publishedStatus : undefined,
    notionLastEditedTime: typeof params.notionLastEditedTime === 'string' ? params.notionLastEditedTime : undefined,
    isActive: true,
  });
  const projectRows = await upsertProjectsToSupabase(payload.projects, courseRow.id);
  await deleteProjectsNotInCourse({
    courseId: courseRow.id,
    activeProjectNotionIds: payload.projects.map((project) => project.id),
  });
  const projectLookup = buildProjectLookup(projectRows);

  const workResult = await upsertStudentWorksToSupabase({
    studentWorks: payload.studentWorks,
    projectIdBySourceDb: projectLookup,
    warnings: payload.warnings,
  });
  const workDeleted = await deleteStudentWorksNotInProjects({
    projectIds: projectRows.map((row) => row.id),
    activeWorkNotionIds: payload.studentWorks.map((work) => work.id),
  });

  const warnings = payload.warnings;

  await appendSyncLog({
    runId,
    entityType: 'course',
    entityNotionId: payload.course.id,
    status: 'success',
    message: 'Course sync completed',
    payload: {
      slug,
      projectCount: payload.projects.length,
      workCount: payload.studentWorks.length,
      workUpserted: workResult.upserted,
      workSkipped: workResult.skipped,
      workDeleted,
      imageUploaded: coverResult.uploaded + imageResult.uploaded,
      imageSkipped: coverResult.skipped + imageResult.skipped,
      warningCount: warnings.length,
    },
  });

  logWithContext('Sync to Supabase completed', {
    runId,
    slug,
    courseId: payload.course.id,
    projectCount: payload.projects.length,
    workCount: payload.studentWorks.length,
    workUpserted: workResult.upserted,
    workSkipped: workResult.skipped,
    workDeleted,
    imageUploaded: coverResult.uploaded + imageResult.uploaded,
    imageSkipped: coverResult.skipped + imageResult.skipped,
    warningCount: warnings.length,
  });

  return {
    runId,
    slug,
    courseNotionPageId: payload.course.id,
    projectCount: payload.projects.length,
    workCount: payload.studentWorks.length,
    workUpserted: workResult.upserted,
    workSkipped: workResult.skipped,
    workDeleted,
    imageUploaded: coverResult.uploaded + imageResult.uploaded,
    imageSkipped: coverResult.skipped + imageResult.skipped,
    warnings,
  };
}

export async function syncAllCoursesToSupabase(options?: {
  updatedOnly?: boolean;
  publishOnly?: boolean;
  deactivate?: boolean;
  dryRun?: boolean;
}): Promise<{
  runId: string;
  totalCoursesInNotion: number;
  selectedCourses: number;
  syncedCourses: number;
  failedCourses: number;
  deactivatedCourses: number;
  checkpointFrom: string | null;
  checkpointTo: string | null;
  warnings: NormalizationWarning[];
}> {
  const runId = `syncall-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const updatedOnly = Boolean(options?.updatedOnly);
  const publishOnly = Boolean(options?.publishOnly);
  const deactivate = Boolean(options?.deactivate);
  const dryRun = Boolean(options?.dryRun);

  const allCourses = await fetchAllCoursesWithMeta();
  const totalCoursesInNotion = allCourses.length;
  const checkpointFrom = updatedOnly ? await getLastSyncAllCheckpoint() : null;
  const checkpointMs = toMs(checkpointFrom);
  const warnings: NormalizationWarning[] = [];

  let effective = publishOnly ? allCourses.filter((item) => item.publishedStatus) : allCourses.slice();
  effective = effective.sort(byUpdatedDesc);

  if (publishOnly) {
    const unpublishedCount = allCourses.length - effective.length;
    if (unpublishedCount > 0) {
      warnings.push({
        level: 'warning',
        code: 'SYNC_ALL_PUBLISH_FILTERED_OUT',
        message: `${unpublishedCount} course(s) skipped by PublishedStatus filter.`,
      });
    }
  }

  const selected = updatedOnly
    ? effective.filter((item) => {
        if (!checkpointMs) return true;
        const editedMs = toMs(item.lastEditedTime);
        if (!editedMs) return true;
        return editedMs > checkpointMs;
      })
    : effective;

  let syncedCourses = 0;
  let failedCourses = 0;
  let checkpointTo: string | null = checkpointFrom;

  if (!dryRun) {
    for (const course of selected) {
      try {
        const result = await syncCourseToSupabase({
          slug: course.slug,
          coursePageId: course.pageId,
          publishedStatus: course.publishedStatus,
          notionLastEditedTime: course.lastEditedTime,
        });
        warnings.push(...result.warnings);
        syncedCourses += 1;
        if (course.lastEditedTime && (!checkpointTo || (toMs(course.lastEditedTime) || 0) > (toMs(checkpointTo) || 0))) {
          checkpointTo = course.lastEditedTime;
        }
      } catch (error) {
        failedCourses += 1;
        warnings.push({
          level: 'error',
          code: 'SYNC_ALL_COURSE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown course sync failure',
          courseId: course.pageId,
        });
      }
    }
  } else {
    syncedCourses = selected.length;
    checkpointTo = selected
      .map((item) => item.lastEditedTime)
      .filter(Boolean)
      .sort((a, b) => (toMs(b) || 0) - (toMs(a) || 0))[0] || checkpointFrom;
  }

  let deactivatedCourses = 0;
  if (deactivate && !dryRun) {
    const activeIds = effective.map((item) => item.pageId);
    deactivatedCourses = await setCoursesInactiveByNotionIds(activeIds);
  }

  await appendSyncLog({
    runId,
    entityType: 'sync_all',
    status: 'success',
    message: dryRun ? 'Sync-all dry run completed' : 'Sync-all completed',
    payload: {
      updatedOnly,
      publishOnly,
      deactivate,
      dryRun,
      totalCoursesInNotion,
      selectedCourses: selected.length,
      syncedCourses,
      failedCourses,
      deactivatedCourses,
      checkpointFrom,
      checkpointTo,
      warningCount: warnings.length,
    },
  });

  return {
    runId,
    totalCoursesInNotion,
    selectedCourses: selected.length,
    syncedCourses,
    failedCourses,
    deactivatedCourses,
    checkpointFrom,
    checkpointTo,
    warnings,
  };
}
