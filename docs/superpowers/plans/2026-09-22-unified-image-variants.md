# Unified Image Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every image-based template use automatically generated thumbnail and preview variants while preserving original images for print and explicit downloads.

**Architecture:** Extend the working CardCase R2 variant flow into a shared `ImageAsset` contract, a single variant resolver, and a reusable `OptimizedImage` component. Sync generates deterministic variants for `mainImage` and `moreImages`, stores them in Supabase metadata, and keeps legacy flat URLs readable during a staged template migration.

**Tech Stack:** TypeScript, React 19, Node 20, Express, Sharp, Cloudflare R2, Supabase metadata JSON, Node test runner through `tsx`

**Spec:** `docs/superpowers/specs/2026-09-22-unified-image-variants-design.md`

## Global Constraints

- Editors provide each source image once through Notion; no new Notion properties are required.
- `original` preserves source bytes and is the only variant allowed for print or original download.
- `thumbnail` is auto-oriented WebP, maximum 640 px, quality 80, and is never enlarged.
- `preview` is auto-oriented WebP, maximum 1600 px, quality 85, and is never enlarged.
- Legacy `mainImage`, `mainImageThumbnail`, `mainImagePreview`, and `moreImages` records must continue rendering.
- SVG and unsupported animated or HEIC inputs must retain a usable original when variants cannot be generated.
- Every template migration must be independently releasable.

## Review Focus

- A source URL already hosted in R2 must generate missing variants without uploading the original again; Task 2 adds this test.
- Duplicate or reordered `moreImages` must preserve UI order and map each original to the correct asset; Task 3 adds this test.
- A broken thumbnail URL must fall back once to preview and then original without an infinite error loop; Task 4 adds this test.
- Animated GIF and SVG sources must remain usable when WebP conversion would remove required behavior; Task 2 adds these tests.
- Print HTML must use original URLs even after all screen templates migrate; Task 7 retains and broadens the print regression test.

---

### Task 1: Shared Image Asset Contract and Resolver

**Files:**
- Create: `src/lib/imageAssets.ts`
- Create: `src/lib/imageAssets.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: existing `StudentWork.mainImage`, `mainImageThumbnail`, `mainImagePreview`, and `moreImages` fields.
- Produces: `ImageAsset`, `ImageVariant`, `resolveImageSource(asset, variant)`, `getMainImageAsset(work)`, and `getMoreImageAssets(work)`.

- [ ] **Step 1: Write failing resolver and compatibility tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMainImageAsset, getMoreImageAssets, resolveImageSource } from './imageAssets';

test('resolveImageSource follows thumbnail and preview fallback order', () => {
  const asset = { original: 'original.jpg', preview: 'preview.webp' };
  assert.equal(resolveImageSource(asset, 'thumbnail'), 'preview.webp');
  assert.equal(resolveImageSource(asset, 'preview'), 'preview.webp');
  assert.equal(resolveImageSource(asset, 'original'), 'original.jpg');
});

test('legacy flat main image fields become an ImageAsset', () => {
  const asset = getMainImageAsset({
    mainImage: 'original.jpg',
    mainImageThumbnail: 'thumb.webp',
    mainImagePreview: 'preview.webp',
  });
  assert.deepEqual(asset, {
    original: 'original.jpg',
    thumbnail: 'thumb.webp',
    preview: 'preview.webp',
  });
});

test('more image assets preserve original array order', () => {
  const assets = getMoreImageAssets({
    moreImages: ['b.jpg', 'a.jpg'],
    moreImageAssets: [
      { original: 'b.jpg', thumbnail: 'b-thumb.webp' },
      { original: 'a.jpg', thumbnail: 'a-thumb.webp' },
    ],
  });
  assert.deepEqual(assets.map((asset) => asset.original), ['b.jpg', 'a.jpg']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `./node_modules/.bin/tsx --test src/lib/imageAssets.test.ts`

Expected: FAIL because `imageAssets.ts`, `ImageAsset`, and `moreImageAssets` do not exist.

- [ ] **Step 3: Add the typed model and minimal resolvers**

```ts
export type ImageVariant = 'thumbnail' | 'preview' | 'original';

export interface ImageAsset {
  original: string;
  thumbnail?: string;
  preview?: string;
}
```

Define both exported types in `src/types.ts`; import them into `src/lib/imageAssets.ts` with `StudentWork`.

Add to `StudentWork`:

```ts
mainImageAsset?: ImageAsset;
moreImageAssets?: ImageAsset[];
```

Implement resolver behavior:

```ts
export function resolveImageSource(asset: ImageAsset, variant: ImageVariant): string {
  if (variant === 'original') return asset.original;
  if (variant === 'preview') return asset.preview || asset.original;
  return asset.thumbnail || asset.preview || asset.original;
}

export function getMainImageAsset(work: Pick<StudentWork, 'mainImage' | 'mainImageAsset' | 'mainImageThumbnail' | 'mainImagePreview'>): ImageAsset {
  return work.mainImageAsset || {
    original: work.mainImage,
    thumbnail: work.mainImageThumbnail,
    preview: work.mainImagePreview,
  };
}

export function getMoreImageAssets(work: Pick<StudentWork, 'moreImages' | 'moreImageAssets'>): ImageAsset[] {
  const stored = new Map((work.moreImageAssets || []).map((asset) => [asset.original, asset]));
  return (work.moreImages || []).map((original) => stored.get(original) || { original });
}
```

- [ ] **Step 4: Run resolver tests and type checking**

Run: `./node_modules/.bin/tsx --test src/lib/imageAssets.test.ts && npm run lint`

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the shared contract**

```bash
git add src/lib/imageAssets.ts src/lib/imageAssets.test.ts src/types.ts
git commit -m "feat: add shared image asset contract"
```

### Task 2: Generalize R2 Variant Generation

**Files:**
- Modify: `server/services/imageStoreR2.ts`
- Modify: `server/services/imageStoreR2.test.ts`

**Interfaces:**
- Consumes: `ImageAsset` from `src/types.ts` and source URLs.
- Produces: `uploadImageAssetToR2(params): Promise<ImageAssetUploadResult>` while retaining `uploadImageUrlToR2` for original-only callers.

- [ ] **Step 1: Write failing tests for dimensions, existing R2 originals, and format exceptions**

Add a `withR2TestEnv` helper that snapshots/restores the six existing R2 environment variables and `globalThis.fetch`. Inside each test, generate a 2400 x 1800 JPEG with Sharp and collect PUT requests as `{ url, body: Buffer, contentType }[]`. Locate buffers with `uploads.find(({ url }) => url.endsWith(suffix))!.body` and inspect them with Sharp:

```ts
test('uploadImageAssetToR2 creates bounded WebP variants without enlarging', async () => {
  const result = await uploadImageAssetToR2({
    sourceUrl: 'https://notion.example/photo.jpg',
    courseSlug: 'course',
    projectNotionId: 'project',
    workNotionId: 'work',
    variants: 'standard',
  });
  const bodyFor = (suffix: string) => uploads.find(({ url }) => url.endsWith(suffix))!.body;
  assert.equal((await sharp(bodyFor('-thumbnail.webp')).metadata()).width, 640);
  assert.equal((await sharp(bodyFor('-preview.webp')).metadata()).width, 1600);
  assert.match(result.asset.thumbnail || '', /-thumbnail\.webp$/);
  assert.match(result.asset.preview || '', /-preview\.webp$/);
});

test('an existing R2 original is fetched for variants but is not uploaded again', async () => {
  const result = await uploadImageAssetToR2({
    sourceUrl: 'https://images.example.com/course/project/work/main.jpg',
    courseSlug: 'course',
    projectNotionId: 'project',
    workNotionId: 'work',
    variants: 'standard',
  });
  assert.equal(uploads.filter(({ url }) => url.endsWith('/main.jpg')).length, 0);
  assert.ok(result.asset.thumbnail);
  assert.ok(result.asset.preview);
});

test('SVG and animated GIF retain original-only assets', async () => {
  // Run once with an SVG response and once with a two-page GIF fixture created by Sharp.
  // In each case, assert result.asset equals { original: result.asset.original }
  // and no -thumbnail.webp or -preview.webp PUT occurred.
});
```

Keep each fetch mock self-contained: GET returns its source fixture; PUT appends to `uploads` and returns HTTP 200. For the existing-R2 test, GET of the public R2 URL returns the JPEG fixture while PUT assertions verify only the two derived keys.

Add two more Sharp-backed assertions:

- A 320 x 240 source produces 320 x 240 thumbnail and preview variants, proving `withoutEnlargement`.
- A 1200 x 800 JPEG written with EXIF orientation 6 produces portrait metadata (`width: 800`, `height: 1200`) after preview conversion, proving `.rotate()` applies orientation.

- [ ] **Step 2: Run the R2 tests and verify RED**

Run: `./node_modules/.bin/tsx --test server/services/imageStoreR2.test.ts`

Expected: FAIL because `uploadImageAssetToR2` and format policies do not exist.

- [ ] **Step 3: Extract the generic asset upload API**

Implement:

```ts
export async function uploadImageAssetToR2(params: {
  sourceUrl: string;
  courseSlug: string;
  projectNotionId: string;
  workNotionId: string;
  variants?: 'standard' | 'thumbnail-only';
}): Promise<ImageAssetUploadResult>;

export interface ImageAssetUploadResult {
  asset: ImageAsset;
  uploaded: boolean;
  warning?: string;
}
```

Keep deterministic sibling keys. Use `sharp(body).rotate()` for raster variants, `withoutEnlargement: true`, and existing immutable cache headers. Detect SVG from content type and animated GIF from `sharp(body).metadata().pages`; return original-only for those formats. Catch conversion errors around variant creation only, return the original asset, and expose a warning value or typed error that sync can record.

- [ ] **Step 4: Keep the existing original-only wrapper**

Implement `uploadImageUrlToR2` by calling the shared download/storage internals with no variants. Do not generate browser variants for course covers or blog images during this rollout.

- [ ] **Step 5: Run R2 tests and server type checking**

Run: `./node_modules/.bin/tsx --test server/services/imageStoreR2.test.ts && npm run lint`

Expected: all tests pass.

- [ ] **Step 6: Commit R2 generalization**

```bash
git add server/services/imageStoreR2.ts server/services/imageStoreR2.test.ts
git commit -m "feat: generalize R2 image variants"
```

### Task 3: Persist Main and Gallery Image Assets During Sync

**Files:**
- Modify: `server/services/syncToSupabase.ts`
- Modify: `server/services/syncToSupabase.test.ts`
- Modify: `server/services/supabase.ts`
- Modify: `server/services/supabase.test.ts`

**Interfaces:**
- Consumes: `uploadImageAssetToR2`, project template type, and ordered `StudentWork.moreImages`.
- Produces: populated `mainImageAsset` and `moreImageAssets` metadata, while retaining flat original URL fields.

- [ ] **Step 1: Write failing sync tests for main image, ordered gallery images, and conversion fallback**

```ts
test('rewriteWorkMedia stores one main asset and ordered more image assets', async () => {
  const work: StudentWork = {
    id: 'work', assignmentName: 'Work', members: [], description: '',
    mainImage: 'main.jpg',
    moreImages: ['second.jpg', 'first.jpg'],
  };
  const upload = async ({ sourceUrl }: { sourceUrl: string }) => ({
    asset: {
      original: `r2/${sourceUrl}`,
      thumbnail: `r2/${sourceUrl.replace(/\.[^.]+$/, '-thumbnail.webp')}`,
      preview: `r2/${sourceUrl.replace(/\.[^.]+$/, '-preview.webp')}`,
    },
    uploaded: true,
  });
  await rewriteWorkMediaToR2ForTest(work, upload);
  assert.equal(work.mainImage, 'r2/main.jpg');
  assert.equal(work.mainImageAsset?.thumbnail, 'r2/main-thumbnail.webp');
  assert.deepEqual(work.moreImageAssets?.map((asset) => asset.original), [
    'r2/second.jpg',
    'r2/first.jpg',
  ]);
});

test('variant failure preserves the original and sync continues', async () => {
  const work: StudentWork = {
    id: 'work', assignmentName: 'Work', members: [], description: '',
    mainImage: 'unsupported.heic',
  };
  await rewriteWorkMediaToR2ForTest(work, async () => ({
    asset: { original: 'r2/unsupported.heic' },
    uploaded: true,
    warning: 'Variant conversion failed',
  }));
  assert.equal(work.mainImage, 'r2/unsupported.heic');
  assert.equal(work.mainImageAsset?.preview, undefined);
});
```

- [ ] **Step 2: Write failing Supabase round-trip tests**

Extend the existing request mocks to assert `metadata.mainImageAsset` and `metadata.moreImageAssets` are written and read without order changes. Include a legacy row containing only `main_image_url` and `metadata.moreImages`.

- [ ] **Step 3: Run sync and Supabase tests and verify RED**

Run: `./node_modules/.bin/tsx --test server/services/syncToSupabase.test.ts server/services/supabase.test.ts`

Expected: FAIL because generalized asset persistence is absent.

- [ ] **Step 4: Generate assets for all image templates**

Use `uploadImageAssetToR2({ variants: 'standard' })` for `mainImage` and every `moreImages` item belonging to `generic-card`, `data-matrix`, `gallery-story`, `gallery-slide`, `card-spec`, or `card-case`. Resolve template type through the matching project rather than `cardCaseRecordType`.

Change `rewriteWorkMediaToR2` and its existing exported test seam `rewriteWorkMediaToR2ForTest` to accept `(params: ImageAssetUploadParams) => Promise<ImageAssetUploadResult>`. It must mutate `mainImage`, `mainImageAsset`, `mainImageThumbnail`, `mainImagePreview`, `moreImages`, and `moreImageAssets` together. Keep the old string-returning callback behavior only in the separate interaction-icon rewrite path.

Use `thumbnail-only` for `interactionPart`. Keep original-only behavior for unrelated image fields in this rollout.

- [ ] **Step 5: Store and read asset metadata**

Add these properties to `buildStudentWorkMetadata` and `mapWorkRowToStudentWork`:

```ts
mainImageAsset: work.mainImageAsset || null,
moreImageAssets: work.moreImageAssets || null,
```

Continue writing `main_image_url` and `moreImages` originals for backward compatibility.

- [ ] **Step 6: Run sync tests, Supabase tests, and lint**

Run: `./node_modules/.bin/tsx --test server/services/syncToSupabase.test.ts server/services/supabase.test.ts && npm run lint`

Expected: all tests pass.

- [ ] **Step 7: Commit generalized sync persistence**

```bash
git add server/services/syncToSupabase.ts server/services/syncToSupabase.test.ts server/services/supabase.ts server/services/supabase.test.ts
git commit -m "feat: sync image assets for visual templates"
```

### Task 4: Shared OptimizedImage Component

**Files:**
- Create: `src/components/OptimizedImage.tsx`
- Create: `src/components/OptimizedImage.test.tsx`

**Interfaces:**
- Consumes: `ImageAsset`, `ImageVariant`, `resolveImageSource`.
- Produces: `buildImageFallbackChain(asset, variant): string[]`, `getNextImageFallbackIndex(currentIndex, chainLength): number`, and `OptimizedImage(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { asset: ImageAsset; variant: ImageVariant })` with deterministic fallback and native image loading attributes.

- [ ] **Step 1: Write failing component tests**

```tsx
test('renders the requested thumbnail with lazy async loading', () => {
  const html = renderToStaticMarkup(
    <OptimizedImage
      asset={{ original: 'original.jpg', thumbnail: 'thumb.webp' }}
      variant="thumbnail"
      alt="Work"
      loading="lazy"
    />,
  );
  assert.match(html, /src="thumb\.webp"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
});

test('buildImageFallbackChain is finite and ordered', () => {
  assert.deepEqual(
    buildImageFallbackChain({ original: 'o.jpg', preview: 'p.webp', thumbnail: 't.webp' }, 'thumbnail'),
    ['t.webp', 'p.webp', 'o.jpg'],
  );
});

test('fallback progression stops after original', () => {
  assert.equal(getNextImageFallbackIndex(0, 3), 1);
  assert.equal(getNextImageFallbackIndex(1, 3), 2);
  assert.equal(getNextImageFallbackIndex(2, 3), 2);
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `./node_modules/.bin/tsx --test src/components/OptimizedImage.test.tsx`

Expected: FAIL because the component and fallback builder do not exist.

- [ ] **Step 3: Implement finite fallback behavior**

Use component state and `getNextImageFallbackIndex` to advance through a de-duplicated URL chain on `onError`. Stop changing `src` after the original fails. Reset the index when `asset` or `variant` changes. Forward standard `<img>` props except `src`, set `decoding="async"`, and preserve caller-provided `loading`, classes, alt, and referrer policy.

- [ ] **Step 4: Run component tests and lint**

Run: `./node_modules/.bin/tsx --test src/components/OptimizedImage.test.tsx && npm run lint`

Expected: all tests pass.

- [ ] **Step 5: Commit the shared component**

```bash
git add src/components/OptimizedImage.tsx src/components/OptimizedImage.test.tsx
git commit -m "feat: add optimized image component"
```

### Task 5: Migrate Generic Card and Data Matrix

**Files:**
- Modify: `src/components/projects/GenericCard.tsx`
- Create: `src/components/projects/GenericCard.test.tsx`
- Modify: `src/components/projects/DataMatrix.tsx`
- Modify: `src/components/projects/DataMatrix.test.tsx`

**Interfaces:**
- Consumes: `OptimizedImage`, `getMainImageAsset`, `getMoreImageAssets`.
- Produces: `getGenericCardImageAssets(work): ImageAsset[]`, `getDataMatrixModalImage(work): ImageAsset`, thumbnail-based grids, and preview-based modals.

- [ ] **Step 1: Write failing rendering tests**

For Generic Card, assert the closed SSR output contains the main thumbnail and not original. Test `getGenericCardImageAssets(work)` with main and `moreImages` assets; assert `assets.map((asset) => resolveImageSource(asset, 'preview'))` matches main-first source order and duplicate originals are removed by first occurrence.

For Data Matrix, render an `A32` work and assert the cell uses thumbnail. Assert `resolveImageSource(getDataMatrixModalImage(work), 'preview')` returns its preview URL.

- [ ] **Step 2: Run template tests and verify RED**

Run: `./node_modules/.bin/tsx --test src/components/projects/GenericCard.test.tsx src/components/projects/DataMatrix.test.tsx`

Expected: FAIL because both templates still use original URLs.

- [ ] **Step 3: Migrate Generic Card**

Use `variant="thumbnail" loading="lazy"` for the card cover. Build modal assets from `[getMainImageAsset(work), ...getMoreImageAssets(work)]`, preserve deduplication by `asset.original`, and render the selected asset with `variant="preview"`.

- [ ] **Step 4: Migrate Data Matrix**

Use thumbnail for coordinate and categorized cells. Use preview in the selected-work modal. Retain existing layout IDs, navigation, and filtering behavior.

- [ ] **Step 5: Run tests and lint**

Run: `./node_modules/.bin/tsx --test src/components/projects/GenericCard.test.tsx src/components/projects/DataMatrix.test.tsx && npm run lint`

Expected: all tests pass.

- [ ] **Step 6: Commit the first template migration**

```bash
git add src/components/projects/GenericCard.tsx src/components/projects/GenericCard.test.tsx src/components/projects/DataMatrix.tsx src/components/projects/DataMatrix.test.tsx
git commit -m "feat: optimize generic card and matrix images"
```

### Task 6: Migrate Gallery Story and Gallery Slide

**Files:**
- Modify: `src/components/projects/galleryStoryLightbox.ts`
- Modify: `src/components/projects/galleryStoryLightbox.test.ts`
- Modify: `src/components/projects/GalleryStory.tsx`
- Modify: `src/components/projects/GalleryStory.test.tsx`
- Modify: `src/components/projects/GallerySlide.tsx`
- Create: `src/components/projects/GallerySlide.test.tsx`

**Interfaces:**
- Consumes: ordered `ImageAsset[]` and `OptimizedImage`.
- Produces: `getGalleryStoryAssets(work): ImageAsset[]`, `getAdjacentGalleryAsset(assets, selectedOriginal, direction): ImageAsset`, `getGallerySlideAssets(work): ImageAsset[]`, thumbnail process grids, preview stages, and preview modals without changing navigation semantics.

- [ ] **Step 1: Write failing asset-aware gallery navigation tests**

Change gallery lightbox helpers to navigate assets by `original` identity rather than resolved display URL. Define duplicate handling as first-occurrence deduplication before navigation. Tests must cover duplicate originals, previous/next wraparound, missing selected identity falling back to the first asset, and preserved `moreImages` order.

- [ ] **Step 2: Write failing render tests for variant selection**

Assert Gallery Story process tiles use thumbnails and its main image/modal use previews. Assert Gallery Slide stage and zoom image use previews and never include original `src` when preview is present.

- [ ] **Step 3: Run gallery tests and verify RED**

Run: `./node_modules/.bin/tsx --test src/components/projects/galleryStoryLightbox.test.ts src/components/projects/GalleryStory.test.tsx src/components/projects/GallerySlide.test.tsx`

Expected: FAIL because gallery code still navigates plain URL strings.

- [ ] **Step 4: Migrate Gallery Story**

Build one ordered asset list. Store the selected original URL as identity, resolve preview only at render time, and keep keyboard/navigation behavior unchanged. Main and modal use preview; process tiles use thumbnail with lazy loading.

- [ ] **Step 5: Migrate Gallery Slide**

Replace `allImages: string[]` with ordered assets. Use preview for the stage and modal. Keep slide indexes and controls unchanged, and lazy-load non-current images only when they enter the rendered tree.

- [ ] **Step 6: Run gallery tests and lint**

Run: `./node_modules/.bin/tsx --test src/components/projects/galleryStoryLightbox.test.ts src/components/projects/GalleryStory.test.tsx src/components/projects/GallerySlide.test.tsx && npm run lint`

Expected: all tests pass.

- [ ] **Step 7: Commit gallery migration**

```bash
git add src/components/projects/galleryStoryLightbox.ts src/components/projects/galleryStoryLightbox.test.ts src/components/projects/GalleryStory.tsx src/components/projects/GalleryStory.test.tsx src/components/projects/GallerySlide.tsx src/components/projects/GallerySlide.test.tsx
git commit -m "feat: optimize gallery image loading"
```

### Task 7: Migrate Card Spec and Consolidate CardCase

**Files:**
- Modify: `src/components/projects/CardSpec.tsx`
- Create: `src/components/projects/CardSpec.test.tsx`
- Modify: `src/components/projects/CardCase.tsx`
- Modify: `src/components/projects/CardCase.test.tsx`
- Modify: `src/components/templates/cardCaseUtils.test.ts`

**Interfaces:**
- Consumes: shared resolver and `OptimizedImage`.
- Produces: no remaining template-specific image fallback logic for Card Spec or CardCase; print remains original-only.

- [ ] **Step 1: Write failing tests for Card Spec and CardCase shared behavior**

Assert Card Spec inline media uses thumbnail and modal uses preview. Update CardCase tests to assert it renders through `OptimizedImage` behavior and still supports legacy flat variant fields.

Extend both CardCase print layout tests with assets whose thumbnail and preview URLs are unique, then assert neither derived URL appears in print HTML.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `./node_modules/.bin/tsx --test src/components/projects/CardSpec.test.tsx src/components/projects/CardCase.test.tsx src/components/templates/cardCaseUtils.test.ts`

Expected: FAIL because Card Spec uses originals and CardCase still owns variant selection directly.

- [ ] **Step 3: Migrate Card Spec**

Use thumbnail for its inline square image and preview for its zoom modal. Keep modal identity based on `asset.original` so existing parent state remains compatible.

- [ ] **Step 4: Consolidate CardCase**

Replace local `thumbnail || preview || original` expressions with `getMainImageAsset` and `OptimizedImage`. Keep card lazy loading, preview modal behavior, fallback gradients, and print logic unchanged.

- [ ] **Step 5: Run focused tests and lint**

Run: `./node_modules/.bin/tsx --test src/components/projects/CardSpec.test.tsx src/components/projects/CardCase.test.tsx src/components/templates/cardCaseUtils.test.ts && npm run lint`

Expected: all tests pass.

- [ ] **Step 6: Commit final template migration**

```bash
git add src/components/projects/CardSpec.tsx src/components/projects/CardSpec.test.tsx src/components/projects/CardCase.tsx src/components/projects/CardCase.test.tsx src/components/templates/cardCaseUtils.test.ts
git commit -m "feat: unify card template image variants"
```

### Task 8: Full Verification and Backfill Documentation

**Files:**
- Modify: `docs/notion-supabase-main-read-plan.md`
- Create: `docs/image-variant-backfill.md`

**Interfaces:**
- Consumes: completed shared image pipeline.
- Produces: operator instructions for backfilling existing courses and evidence that all templates and print paths remain valid.

- [ ] **Step 1: Document the backfill procedure**

Document that operators run the existing course Sync once per course after deployment. Include required environment switches:

```text
READ_FROM_SUPABASE=true
IMAGE_BACKEND=r2
IMAGE_SYNC_ENABLED=true
```

State that no Notion properties are added, original URLs remain present, variant failures appear as sync warnings, and re-running Sync is safe because R2 keys are content-addressed.

- [ ] **Step 2: Run the complete automated suite**

Run: `./node_modules/.bin/tsx --test src/**/*.test.ts src/**/*.test.tsx server/**/*.test.ts`

Expected: zero failures.

- [ ] **Step 3: Run static and production checks**

Run: `npm run lint && npm run build`

Expected: both commands exit 0 with no TypeScript or Vite errors.

- [ ] **Step 4: Verify repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Perform manual browser checks**

Using one photo-heavy course, verify Generic Card, Data Matrix, Gallery Story, Gallery Slide, Card Spec, and CardCase. In browser Network tools confirm card/grid requests end in `-thumbnail.webp`, modal/stage requests end in `-preview.webp`, and triggering both CardCase print layouts requests the original extension rather than either WebP variant.

With browser cache disabled and mobile throttling enabled, record for the same initial route before and after migration: total image transferred bytes, image request count, and the time when visible images finish loading. Add the measured values and test course/route to `docs/image-variant-backfill.md`; the migrated result must reduce transferred image bytes, and any regression in visible completion time must be investigated before release.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/notion-supabase-main-read-plan.md docs/image-variant-backfill.md
git commit -m "docs: add image variant backfill guide"
```
