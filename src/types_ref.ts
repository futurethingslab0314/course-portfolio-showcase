import { LucideIcon } from 'lucide-react';

export interface StudentWork {
  id: string;
  assignmentName: string;
  members: string[];
  description: string;
  mainImage: string;
  moreImages?: string[];
  url?: string;
  video?: string;
  tags?: string[];
  year?: string;
  isStarred?: boolean;
  methodologies?: string[];
  dataSpecs?: { label: string; value: string; timestamp: string }[];
  sourceDatabaseId: string;
  gridLocation?: string;
  blogContent?: {
    type: 'text' | 'image' | 'video';
    content: string;
    caption?: string;
    provider?: 'youtube' | 'vimeo' | 'direct' | 'embed';
  }[];
  // Shop Catalog Fields
  purpose?: string;
  dataInput?: string[];
  dataOutput?: string[];
  memory?: string;
  texture?: string;
  notice?: string;
  designBy?: string;
  date?: string;
  price?: string;
  // Activity Event Fields
  startDate?: string;
  endDate?: string;
  country?: string;
  city?: string;
  grant?: string;
  publicationName?: string;
  themeTag?: string;
  // CardCase Fields
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
  displayStyle: 'gallery-story' | 'generic-card' | 'gallery-slide' | 'card-spec' | 'data-matrix' | 'blog-post' | 'shop-catalog' | 'activity-event' | 'card-case';
}

export interface Course {
  id: string;
  courseName: string;
  courseSummary: string;
  coverImage: string;
  projectIds: string[];
}
