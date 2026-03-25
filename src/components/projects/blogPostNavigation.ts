import { StudentWork } from '../../types';

export interface BlogQuickJumpItem {
  label: string;
  anchorId: string;
  index: number;
}

export function slugifyBlogHeading(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export function buildBlogQuickJumpItems(blogContent: StudentWork['blogContent']): BlogQuickJumpItem[] {
  return (blogContent ?? [])
    .map((section, index) => {
      if (section.type !== 'text' || section.blockType !== 'heading_1' || !section.content.trim()) {
        return null;
      }
      return {
        label: section.content.trim(),
        anchorId: `blog-section-${slugifyBlogHeading(section.content)}-${index}`,
        index,
      };
    })
    .filter((item): item is BlogQuickJumpItem => Boolean(item));
}
