# Unified Image Variants Design

## Purpose

Create one shared image pipeline for every image-based template. Content editors continue supplying each image once through Notion. The sync service stores the original image for printing or downloads and automatically creates smaller WebP variants for browser display.

The change must improve image loading without lowering print quality or requiring new Notion properties.

## Scope

The first rollout covers image fields used by:

- `card-case`
- `generic-card`
- `data-matrix`
- `gallery-story`
- `gallery-slide`
- `card-spec`

It covers `mainImage`, `moreImages`, and small image fields such as `interactionPart` where useful. Blog content images can adopt the same pipeline later, but are not required for the initial rollout.

## Image Model

Each uploaded raster image is represented internally as an image asset:

```ts
interface ImageAsset {
  original: string;
  thumbnail?: string;
  preview?: string;
}
```

The variants have these responsibilities:

| Variant | Processing | Intended use |
| --- | --- | --- |
| `original` | Unmodified source bytes | Printing and explicit original download |
| `thumbnail` | Auto-oriented WebP, maximum 640 px, quality 80 | Cards, grids, and small gallery tiles |
| `preview` | Auto-oriented WebP, maximum 1600 px, quality 85 | Large inline media, slides, and screen modals |

Images are never enlarged. EXIF orientation is applied to generated variants. The original remains byte-for-byte suitable for printing.

During migration, existing flat fields remain supported. A shared resolver supplies the best available URL:

```text
thumbnail request: thumbnail -> preview -> original
preview request:   preview -> original
original request:  original only
```

## Storage Model

R2 object keys remain content-addressed with a source hash. A source image produces deterministic sibling objects:

```text
<work-id>-<hash>.<original-extension>
<work-id>-<hash>-thumbnail.webp
<work-id>-<hash>-preview.webp
```

All objects use immutable cache headers. Repeated references to identical content reuse deterministic keys. A sync may overwrite an identical key safely, but should avoid uploading the original again when it is already stored in R2.

Variant URLs are stored in the existing Supabase metadata JSON, so no Notion schema change is required. Main and gallery images use typed asset data when read by the application. Legacy records containing only `mainImage` or `moreImages` continue working through fallback resolution.

## Sync Flow

For each source image:

1. Download the source once.
2. Calculate its content hash.
3. Preserve or upload the original.
4. For supported raster formats, auto-orient and generate thumbnail and preview WebP files.
5. Upload successful variants to R2.
6. Store original and variant URLs in Supabase metadata.
7. Continue syncing if variant generation fails, preserving the original URL and recording a warning.

SVG files remain original and may be used directly at all display sizes. Animated GIF handling must preserve animation; the first rollout falls back to the original unless an animation-preserving transformation is explicitly supported. Unsupported HEIC or unusual formats retain the original and emit a warning rather than blocking the sync.

## Frontend API

A shared resolver and image component centralize variant selection:

```ts
resolveImageSource(asset, 'thumbnail' | 'preview' | 'original')
```

```tsx
<OptimizedImage
  asset={asset}
  variant="thumbnail"
  loading="lazy"
  alt="..."
/>
```

`OptimizedImage` is responsible for:

- variant fallback;
- `loading` and `decoding` attributes;
- stable dimensions supplied by its parent layout;
- falling back to the next available variant when a requested URL fails;
- preserving existing referrer policy behavior.

It does not decide layout, cropping, aspect ratio, or print behavior. Those remain owned by each template.

## Template Mapping

| Template location | Variant |
| --- | --- |
| CardCase card | `thumbnail` |
| CardCase modal | `preview` |
| CardCase print | `original` |
| Generic Card cover | `thumbnail` |
| Generic Card modal and carousel | `preview` |
| Data Matrix coordinate and category cells | `thumbnail` |
| Data Matrix detail modal | `preview` |
| Gallery Story main inline image | `preview` |
| Gallery Story process tiles | `thumbnail` |
| Gallery Story zoom modal | `preview` |
| Gallery Slide stage and zoom modal | `preview` |
| Card Spec inline image | `thumbnail` or `preview`, selected by rendered width |
| Card Spec zoom modal | `preview` |
| Any print or original download action | `original` |

Gallery templates must generate assets for every `moreImages` entry, not only `mainImage`.

## Loading Behavior

Below-fold thumbnails use `loading="lazy"` and `decoding="async"`. Large preview variants are requested only when their inline region is visible or a modal opens. The original is not requested by ordinary screen interactions.

Above-fold images may use eager loading when measurement shows that lazy loading delays the largest visible image. This choice belongs to the template and must not change the selected image variant.

## Failure Handling

- Missing thumbnail: use preview, then original.
- Missing preview: use original.
- Broken variant URL: retry with the next fallback once.
- Variant conversion failure: retain original and add a sync warning.
- Original upload failure: retain the source URL using the existing sync fallback.
- Print: fail visibly if the original cannot load; never silently substitute a lower-resolution variant.

## Rollout

1. Generalize the current CardCase variant result into `ImageAsset` helpers while preserving existing fields.
2. Add shared resolver tests and `OptimizedImage` tests.
3. Adopt the pipeline in Generic Card and Data Matrix.
4. Extend sync metadata to represent `moreImages` assets.
5. Adopt it in Gallery Story and Gallery Slide.
6. Adopt it in Card Spec.
7. Re-sync existing courses to backfill variants.
8. Compare image transfer size and visible load time before and after rollout.

Each template migration must be independently releasable. Unmigrated templates continue reading original URLs.

## Verification

Automated tests must verify:

- one source download produces the expected original, thumbnail, and preview objects;
- generated variants are WebP, auto-oriented, bounded to their maximum dimensions, and never enlarged;
- Supabase metadata round-trips image assets and legacy fields;
- every template selects the intended variant;
- `moreImages` preserve order while receiving variants;
- failed variants fall back correctly;
- all print HTML and print image preparation use only originals;
- legacy records without variants render normally.

Manual verification uses a photo-heavy course on desktop and a throttled mobile connection. It compares request count, transferred bytes, time until visible images complete, modal sharpness, and print output quality.

## Success Criteria

- Editors provide each source image only once.
- Ordinary page browsing does not download originals when a smaller variant exists.
- Screen previews remain visually sharp at their rendered size.
- Print output continues using the original source.
- Existing records and partially generated assets remain usable.
- The image selection logic is shared rather than duplicated across templates.
