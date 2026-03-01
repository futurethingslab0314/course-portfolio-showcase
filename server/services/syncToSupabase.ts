import { randomUUID } from 'node:crypto';
import { CoursePayload, NormalizationWarning } from '../../shared/contracts';
import { buildCoursePayloadBySlug } from './generator';
import { findCourseSlugByPageId } from './notion';
import { isR2ImageSyncEnabled, uploadImageUrlToR2 } from './imageStoreR2';
import {
  appendSyncLog,
  upsertCourseToSupabase,
  upsertProjectsToSupabase,
  upsertStudentWorksToSupabase,
} from './supabase';

function logWithContext(message: string, context: Record<string, unknown>) {
  console.log(JSON.stringify({ message, ...context }));
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
      const imageCount = 1 + (Array.isArray(work.moreImages) ? work.moreImages.length : 0);
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

    const rewriteOne = async (sourceUrl: string, label: 'mainImage' | 'moreImage', index?: number): Promise<string> => {
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

    work.mainImage = await rewriteOne(work.mainImage, 'mainImage');

    if (Array.isArray(work.moreImages) && work.moreImages.length > 0) {
      const next: string[] = [];
      for (let i = 0; i < work.moreImages.length; i += 1) {
        next.push(await rewriteOne(work.moreImages[i], 'moreImage', i));
      }
      work.moreImages = next.filter((item) => item.trim().length > 0);
    }
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

export async function syncCourseToSupabase(params: {
  slug?: string;
  coursePageId?: string;
}): Promise<{
  runId: string;
  slug: string;
  courseNotionPageId: string;
  projectCount: number;
  workCount: number;
  workUpserted: number;
  workSkipped: number;
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

  const payload = await buildCoursePayloadBySlug(slug);

  const imageResult = await rewriteWorkImagesToR2(payload, runId);

  const courseRow = await upsertCourseToSupabase(payload.course);
  const projectRows = await upsertProjectsToSupabase(payload.projects, courseRow.id);
  const projectLookup = buildProjectLookup(projectRows);

  const workResult = await upsertStudentWorksToSupabase({
    studentWorks: payload.studentWorks,
    projectIdBySourceDb: projectLookup,
    warnings: payload.warnings,
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
      imageUploaded: imageResult.uploaded,
      imageSkipped: imageResult.skipped,
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
    imageUploaded: imageResult.uploaded,
    imageSkipped: imageResult.skipped,
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
    imageUploaded: imageResult.uploaded,
    imageSkipped: imageResult.skipped,
    warnings,
  };
}
