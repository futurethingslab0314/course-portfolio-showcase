export interface BlogRichTextSpan {
  text: string;
  href?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface BlogTextSection {
  type: 'text';
  content: string;
  blockType?: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4' | 'quote' | 'callout' | 'bulleted_list_item' | 'numbered_list_item';
  richText?: BlogRichTextSpan[];
  children?: BlogContentSection[];
}

export interface BlogImageSection {
  type: 'image';
  content: string;
  caption?: string;
}

export interface BlogVideoSection {
  type: 'video';
  content: string;
  caption?: string;
  provider?: 'youtube' | 'vimeo' | 'direct' | 'embed';
}

export interface BlogCodeSection {
  type: 'code';
  content: string;
  language?: string;
}

export interface BlogTableSection {
  type: 'table';
  rows: string[][];
  richRows?: BlogRichTextSpan[][][];
  hasColumnHeader?: boolean;
  hasRowHeader?: boolean;
}

export interface BlogToggleSection {
  type: 'toggle';
  content: string;
  blockType?: 'toggle' | 'heading_1' | 'heading_2' | 'heading_3' | 'heading_4';
  richText?: BlogRichTextSpan[];
  children: BlogContentSection[];
}

export interface BlogColumnSection {
  children: BlogContentSection[];
}

export interface BlogColumnListSection {
  type: 'column_list';
  columns: BlogColumnSection[];
}

export type BlogContentSection = BlogTextSection | BlogImageSection | BlogVideoSection | BlogCodeSection | BlogTableSection | BlogToggleSection | BlogColumnListSection;

export interface StudentWork {
  id: string;
  createdAt?: string;
  assignmentName: string;
  members: string[];
  studentIds?: string[];
  group?: string;
  cardCaseRecordType?: 'group' | 'case';
  caseIds?: string[];
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
  themeTag?: string;
  startDate?: string;
  endDate?: string;
  country?: string;
  city?: string;
  grant?: string;
  publicationName?: string;
  sourceDatabaseId: string;
  gridLocation?: string;
  interactionPart?: string;
  targetUser?: string;
  designTeam?: string;
  foundBy?: string;
  memberDetails?: { name: string; id: string }[];
}

export interface Project {
  id: string;
  projectName: string;
  projectDescription: string;
  courseId: string;
  tabName: string;
  order: number;
  sourceDatabaseId: string; // Used to filter student works
  displayStyle: 'gallery-story' | 'generic-card' | 'gallery-slide' | 'card-spec' | 'data-matrix' | 'blog-post' | 'activity-event' | 'card-case';
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
