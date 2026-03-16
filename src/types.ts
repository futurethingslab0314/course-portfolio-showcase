export interface BlogRichTextSpan {
  text: string;
  href?: string;
}

export interface BlogTextSection {
  type: 'text';
  content: string;
  richText?: BlogRichTextSpan[];
}

export interface BlogImageSection {
  type: 'image';
  content: string;
  caption?: string;
}

export interface BlogTableSection {
  type: 'table';
  rows: string[][];
  richRows?: BlogRichTextSpan[][][];
  hasColumnHeader?: boolean;
  hasRowHeader?: boolean;
}

export type BlogContentSection = BlogTextSection | BlogImageSection | BlogTableSection;

export interface StudentWork {
  id: string;
  assignmentName: string;
  members: string[];
  studentIds?: string[];
  description: string;
  mainImage: string;
  moreImages?: string[];
  url?: string;
  video?: string;
  tags?: string[];
  year?: string;
  isStarred?: boolean;
  methodologies?: string[];
  storyButtons?: { label: string; url: string }[];
  dataSpecs?: string[];
  blogContent?: BlogContentSection[];
  sourceDatabaseId: string;
  gridLocation?: string;
}

export interface Project {
  id: string;
  projectName: string;
  projectDescription: string;
  courseId: string;
  tabName: string;
  order: number;
  sourceDatabaseId: string; // Used to filter student works
  displayStyle: 'gallery-story' | 'generic-card' | 'gallery-slide' | 'card-spec' | 'data-matrix' | 'blog-post';
  visibility: 'published' | 'draft';
}

export interface Course {
  id: string;
  slug?: string;
  courseName: string;
  courseSummary: string;
  coverImage: string;
  projectIds: string[];
}
