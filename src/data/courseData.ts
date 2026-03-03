import { Course, Project, StudentWork } from '../types';
import { CoursePayload } from '../../shared/contracts';

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function loadCoursePayloadBySlug(slugOrId: string, options?: { refresh?: boolean }): Promise<CoursePayload> {
  try {
    const refresh = options?.refresh ? '?refresh=true' : '';
    const response = await fetch(`/api/course/${encodeURIComponent(slugOrId)}${refresh}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const payload = await safeJson<CoursePayload>(response);
    if (!payload?.course || !Array.isArray(payload.projects) || !Array.isArray(payload.studentWorks)) {
      throw new Error('Invalid payload shape');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to load course payload');
  }
}

export async function loadCoursesForHome(options?: { refresh?: boolean }): Promise<Course[]> {
  try {
    const refresh = options?.refresh ? '?refresh=true' : '';
    const response = await fetch(`/api/courses${refresh}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const payload = await safeJson<{ courses: Course[] }>(response);
    if (!Array.isArray(payload.courses) || !payload.courses.length) {
      throw new Error('No courses from API');
    }
    return payload.courses;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Failed to load courses');
  }
}

export function filterWorksForProject(studentWorks: StudentWork[], projects: Project[], activeProjectId?: string): StudentWork[] {
  const sourceDatabaseId = projects.find((p) => p.id === activeProjectId)?.sourceDatabaseId;
  return studentWorks.filter((sw) => sw.sourceDatabaseId === sourceDatabaseId);
}
