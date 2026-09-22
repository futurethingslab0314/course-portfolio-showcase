import React, { ImgHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { ImageAsset, ImageVariant } from '../types';

export function buildImageFallbackChain(asset: ImageAsset, variant: ImageVariant): string[] {
  const candidates = variant === 'original'
    ? [asset.original]
    : variant === 'preview'
      ? [asset.preview, asset.original]
      : [asset.thumbnail, asset.preview, asset.original];

  return [...new Set(candidates.filter((url): url is string => Boolean(url)))];
}

export function getNextImageFallbackIndex(currentIndex: number, chainLength: number): number {
  if (chainLength <= 0) return 0;
  return Math.min(currentIndex + 1, chainLength - 1);
}

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  asset: ImageAsset;
  variant: ImageVariant;
};

export function OptimizedImage({ asset, variant, decoding, onError, ...props }: OptimizedImageProps) {
  const chain = useMemo(
    () => buildImageFallbackChain(asset, variant),
    [asset.original, asset.preview, asset.thumbnail, variant],
  );
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    setFallbackIndex(0);
  }, [asset.original, asset.preview, asset.thumbnail, variant]);

  return (
    <img
      {...props}
      src={chain[fallbackIndex] || asset.original}
      decoding={decoding || 'async'}
      onError={(event) => {
        setFallbackIndex((current) => getNextImageFallbackIndex(current, chain.length));
        onError?.(event);
      }}
    />
  );
}
