import { ImageAsset, StudentWork } from '../../src/types';

export function mediaIdentity(value: string) {
  try {
    const url = new URL(value);
    // Strip only expiring signatures of known Notion file hosts, not arbitrary
    // external query parameters (which may select a different image).
    if (/^(prod-files-secure|s3)[.-].*amazonaws\.com$/.test(url.hostname) || url.hostname === 'file.notion.so') {
      return url.origin + url.pathname;
    }
  } catch { /* Non-URL text is significant. */ }
  return value;
}
function canonical(value: unknown): unknown {
  if (typeof value === 'string') return mediaIdentity(value);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export const workFingerprint = (work: StudentWork) => JSON.stringify(canonical(work));

export function reuseWorkMedia(previous: StudentWork | undefined, stored: StudentWork | undefined, next: StudentWork) {
  const work = structuredClone(next);
  const assets = new Map<string, ImageAsset>();
  const urls = new Set<string>();
  if (!previous || !stored) return { work, assets, urls };
  const imageMap = new Map<string, ImageAsset>();
  const add = (source: string | undefined, asset: ImageAsset | undefined) => {
    if (source && asset?.original) imageMap.set(mediaIdentity(source), asset);
  };
  add(previous.mainImage, stored.mainImageAsset || { original: stored.mainImage });
  previous.moreImages?.forEach((url, i) => add(url, stored.moreImageAssets?.[i] || (stored.moreImages?.[i] ? { original: stored.moreImages[i] } : undefined)));
  const reuse = (url: string) => {
    const asset = imageMap.get(mediaIdentity(url));
    if (!asset) return url;
    assets.set(asset.original, asset); urls.add(asset.original);
    return asset.original;
  };
  work.mainImage = reuse(work.mainImage);
  if (assets.has(work.mainImage)) {
    work.mainImageAsset = assets.get(work.mainImage);
    work.mainImageThumbnail = work.mainImageAsset?.thumbnail;
    work.mainImagePreview = work.mainImageAsset?.preview;
  }
  work.moreImages = work.moreImages?.map(reuse);
  if (work.interactionPart && previous.interactionPart && mediaIdentity(work.interactionPart) === mediaIdentity(previous.interactionPart) && stored.interactionPart) {
    work.interactionPart = stored.interactionPart;
    assets.set(work.interactionPart, { original: work.interactionPart, thumbnail: work.interactionPart });
    urls.add(work.interactionPart);
  }
  // Pair original and stored blog image positions; text/section edits in next
  // are independent, because lookup is by source file identity rather than index.
  const blogImages = (value: unknown, found: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach(item => blogImages(item, found));
    else if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if (item.type === 'image' && typeof item.content === 'string') found.push(item.content);
      for (const [key, child] of Object.entries(item)) if (key !== 'content') blogImages(child, found);
    }
    return found;
  };
  const before = blogImages(previous.blogContent), after = blogImages(stored.blogContent);
  const blogMap = new Map(before.map((url, i) => [mediaIdentity(url), after[i]]));
  const rewrite = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(rewrite);
    else if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if (item.type === 'image' && typeof item.content === 'string') {
        const known = blogMap.get(mediaIdentity(item.content));
        if (known) { item.content = known; urls.add(known); }
      }
      for (const [key, child] of Object.entries(item)) if (key !== 'content') rewrite(child);
    }
  };
  rewrite(work.blogContent);
  return { work, assets, urls };
}
