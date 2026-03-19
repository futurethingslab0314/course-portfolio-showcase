import { Course, Project, StudentWork } from '../src/types';

export type UiPattern = 'card-spec' | 'data-matrix' | 'gallery-slide' | 'gallery-story' | 'generic-card' | 'blog-post' | 'activity-event';

export const UI_PATTERN_FALLBACK: UiPattern = 'generic-card';

export const UI_PATTERN_MAP: Record<string, UiPattern> = {
  'card-spec': 'card-spec',
  CardSpec: 'card-spec',
  'data-matrix': 'data-matrix',
  DataMatrix: 'data-matrix',
  'gallery-slide': 'gallery-slide',
  GallerySlide: 'gallery-slide',
  'gallery-story': 'gallery-story',
  GalleryStory: 'gallery-story',
  'generic-card': 'generic-card',
  GenericCard: 'generic-card',
  'blog-post': 'blog-post',
  BlogPost: 'blog-post',
  blogpost: 'blog-post',
  'activity-event': 'activity-event',
  ActivityEvent: 'activity-event',
  activityevent: 'activity-event',
};

export interface MappingRule {
  sourceCandidates?: string[];
  transform?: string;
  default?: unknown;
}

export type FieldMapping = Partial<Record<keyof StudentWork, MappingRule>>;

export interface NormalizationWarning {
  level: 'warning' | 'error';
  code: string;
  message: string;
  courseId?: string;
  projectId?: string;
  sourceDatabaseId?: string;
  workId?: string;
}

export interface CoursePayload {
  course: Course;
  projects: Project[];
  studentWorks: StudentWork[];
  warnings: NormalizationWarning[];
}

export interface GenerationResult extends CoursePayload {
  status: 'generated' | 'failed';
  courseLink?: string;
  error?: string;
}
