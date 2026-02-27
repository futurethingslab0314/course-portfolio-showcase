import { Course, Project, StudentWork } from '../types';
import { COURSES, PROJECTS, STUDENT_WORKS } from '../mockData';
import { CoursePayload } from '../../shared/contracts';

function fallbackPayloadBySlug(slugOrId: string): CoursePayload {
  const course = COURSES.find((item) => item.id === slugOrId || item.slug === slugOrId) || COURSES[0];
  const projects = PROJECTS.filter((item) => item.courseId === course.id).sort((a, b) => a.order - b.order);
  const sourceIds = new Set(projects.map((item) => item.sourceDatabaseId));
  const studentWorks = STUDENT_WORKS.filter((item) => sourceIds.has(item.sourceDatabaseId));

  return {
    course,
    projects,
    studentWorks,
    warnings: [
      {
        level: 'warning',
        code: 'FALLBACK_TO_MOCK_DATA',
        message: 'API unavailable. Using mockData fallback.',
      },
    ],
  };
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function loadCoursePayloadBySlug(slugOrId: string): Promise<CoursePayload> {
  try {
    const response = await fetch(`/api/course/${encodeURIComponent(slugOrId)}`);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const payload = await safeJson<CoursePayload>(response);
    if (!payload?.course || !Array.isArray(payload.projects) || !Array.isArray(payload.studentWorks)) {
      throw new Error('Invalid payload shape');
    }

    return payload;
  } catch {
    return fallbackPayloadBySlug(slugOrId);
  }
}

export async function loadCoursesForHome(): Promise<Course[]> {
  try {
    const response = await fetch('/api/courses');
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const payload = await safeJson<{ courses: Course[] }>(response);
    if (!Array.isArray(payload.courses) || !payload.courses.length) {
      throw new Error('No courses from API');
    }
    return payload.courses;
  } catch {
    return COURSES;
  }
}

export function fallbackCourses(): Course[] {
  return COURSES;
}

export function filterWorksForProject(studentWorks: StudentWork[], projects: Project[], activeProjectId?: string): StudentWork[] {
  const sourceDatabaseId = projects.find((p) => p.id === activeProjectId)?.sourceDatabaseId;
  return studentWorks.filter((sw) => sw.sourceDatabaseId === sourceDatabaseId);
}
