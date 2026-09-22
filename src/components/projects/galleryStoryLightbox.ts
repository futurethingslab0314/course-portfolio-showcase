import { getMainImageAsset, getMoreImageAssets } from '../../lib/imageAssets';
import { ImageAsset, StudentWork } from '../../types';

export function getGalleryStoryAssets(work: StudentWork): ImageAsset[] {
  const assets = [getMainImageAsset(work), ...getMoreImageAssets(work)];
  return assets.filter((asset, index) => asset.original && assets.findIndex((item) => item.original === asset.original) === index);
}

export function getGalleryStoryImageIndex(assets: ImageAsset[], original: string | null): number {
  if (!original) return -1;
  return assets.findIndex((asset) => asset.original === original);
}

export function getAdjacentGalleryAsset(
  assets: ImageAsset[],
  selectedOriginal: string | null,
  direction: 1 | -1,
): ImageAsset | null {
  if (!assets.length) return null;
  const currentIndex = getGalleryStoryImageIndex(assets, selectedOriginal);
  if (currentIndex === -1) return assets[0];
  return assets[(currentIndex + direction + assets.length) % assets.length];
}
