import React, { ImgHTMLAttributes, useMemo, useState } from 'react';
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

export function getActiveImageFallbackIndex(storedChainKey: string, currentChainKey: string, storedIndex: number): number {
  return storedChainKey === currentChainKey ? storedIndex : 0;
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
  const chainKey = chain.join('\n');
  const [fallbackState, setFallbackState] = useState({ chainKey, index: 0 });
  const fallbackIndex = getActiveImageFallbackIndex(fallbackState.chainKey, chainKey, fallbackState.index);

  return (
    <img
      {...props}
      src={chain[fallbackIndex] || asset.original}
      decoding={decoding || 'async'}
      onError={(event) => {
        setFallbackState((current) => {
          const activeIndex = getActiveImageFallbackIndex(current.chainKey, chainKey, current.index);
          const nextIndex = getNextImageFallbackIndex(activeIndex, chain.length);
          if (current.chainKey === chainKey && current.index === nextIndex) return current;
          return { chainKey, index: nextIndex };
        });
        onError?.(event);
      }}
    />
  );
}
