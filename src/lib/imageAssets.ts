import { ImageAsset, ImageVariant, StudentWork } from '../types';

export function resolveImageSource(asset: ImageAsset, variant: ImageVariant): string {
  if (variant === 'original') return asset.original;
  if (variant === 'preview') return asset.preview || asset.original;
  return asset.thumbnail || asset.preview || asset.original;
}

export function getMainImageAsset(
  work: Pick<StudentWork, 'mainImage' | 'mainImageAsset' | 'mainImageThumbnail' | 'mainImagePreview'>,
): ImageAsset {
  return work.mainImageAsset || {
    original: work.mainImage,
    thumbnail: work.mainImageThumbnail,
    preview: work.mainImagePreview,
  };
}

export function getMoreImageAssets(
  work: Pick<StudentWork, 'moreImages' | 'moreImageAssets'>,
): ImageAsset[] {
  const stored = new Map((work.moreImageAssets || []).map((asset) => [asset.original, asset]));
  return (work.moreImages || []).map((original) => stored.get(original) || { original });
}
