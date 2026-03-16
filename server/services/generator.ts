import { CoursePayload, GenerationResult, NormalizationWarning } from '../../shared/contracts';
import { fetchCourseBySlug, fetchProjectsByCourse, fetchStudentWorksForProject, updateCourseGenerationStatus } from './notion';

type ProjectPayloadRow = Awaited<ReturnType<typeof fetchProjectsByCourse>>[number];

function logWithContext(message: string, context: Record<string, unknown>) {
  console.log(JSON.stringify({ message, ...context }));
}

export function filterVisibleProjectRowsForPayload(projectRows: ProjectPayloadRow[]): ProjectPayloadRow[] {
  return projectRows.filter((row) => row.project.visibility === 'published');
}

export async function buildCoursePayloadBySlug(slug: string): Promise<CoursePayload> {
  const warnings: NormalizationWarning[] = [];

  const { course, pageId: coursePageId } = await fetchCourseBySlug(slug, warnings);
  const projectRows = filterVisibleProjectRowsForPayload(
    await fetchProjectsByCourse(coursePageId, course.projectIds, warnings),
  );

  const projects = projectRows.map((row) => row.project);
  const studentWorks = [];

  for (const row of projectRows) {
    logWithContext('Fetching project source records', {
      courseId: coursePageId,
      projectId: row.project.id,
      sourceDatabaseId: row.project.sourceDatabaseId,
    });

    try {
      const works = await fetchStudentWorksForProject(row.project, row.fieldMapping, warnings);
      studentWorks.push(...works);
    } catch (error) {
      warnings.push({
        level: 'error',
        code: 'SOURCE_DB_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown source DB fetch failure',
        courseId: coursePageId,
        projectId: row.project.id,
        sourceDatabaseId: row.project.sourceDatabaseId,
      });
    }
  }

  return {
    course,
    projects,
    studentWorks,
    warnings,
  };
}

export async function generateCourseWebsite(slug: string, baseUrl: string): Promise<GenerationResult> {
  const payload = await buildCoursePayloadBySlug(slug);
  const courseLink = `${baseUrl.replace(/\/$/, '')}/course/${payload.course.slug || slug}`;

  try {
    await updateCourseGenerationStatus(payload.course.id, 'generated', courseLink);

    logWithContext('Course generation completed', {
      courseId: payload.course.id,
      status: 'generated',
      warningCount: payload.warnings.length,
    });

    return {
      ...payload,
      status: 'generated',
      courseLink,
    };
  } catch (error) {
    await updateCourseGenerationStatus(payload.course.id, 'failed').catch(() => undefined);

    const errMsg = error instanceof Error ? error.message : 'Unknown generation failure';
    logWithContext('Course generation failed', {
      courseId: payload.course.id,
      status: 'failed',
      error: errMsg,
    });

    return {
      ...payload,
      status: 'failed',
      error: errMsg,
    };
  }
}
