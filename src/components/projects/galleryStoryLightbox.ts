export function getGalleryStoryImages(mainImage: string, moreImages?: string[]): string[] {
  const merged = [mainImage, ...(moreImages ?? [])].filter(Boolean);
  return [...new Set(merged)];
}

export function getGalleryStoryImageIndex(images: string[], image: string | null): number {
  if (!image) return -1;
  return images.indexOf(image);
}

export function getNextGalleryStoryImage(images: string[], currentImage: string | null): string | null {
  const currentIndex = getGalleryStoryImageIndex(images, currentImage);
  if (currentIndex === -1 || images.length === 0) return null;
  return images[(currentIndex + 1) % images.length];
}

export function getPrevGalleryStoryImage(images: string[], currentImage: string | null): string | null {
  const currentIndex = getGalleryStoryImageIndex(images, currentImage);
  if (currentIndex === -1 || images.length === 0) return null;
  return images[(currentIndex - 1 + images.length) % images.length];
}
