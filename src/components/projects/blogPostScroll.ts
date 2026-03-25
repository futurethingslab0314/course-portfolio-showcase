import { BlogQuickJumpItem } from './blogPostNavigation';

export function findActiveHeadingAnchorId(
  items: BlogQuickJumpItem[],
  topsByAnchorId: Record<string, number>,
  threshold = 120,
): string | undefined {
  if (!items.length) return undefined;

  let active = items[0]?.anchorId;

  for (const item of items) {
    const top = topsByAnchorId[item.anchorId];
    if (typeof top !== 'number') continue;
    if (top <= threshold) {
      active = item.anchorId;
    } else {
      break;
    }
  }

  return active;
}
