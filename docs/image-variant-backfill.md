# Image Variant Backfill

## Purpose

Backfill browser-sized image variants for existing courses after the unified image pipeline is deployed. Editors continue uploading each source image once in Notion.

## Required Configuration

```text
READ_FROM_SUPABASE=true
IMAGE_BACKEND=r2
IMAGE_SYNC_ENABLED=true
```

No new Notion properties or Supabase columns are required. Variant metadata is stored in the existing student-work metadata JSON.

## Backfill Procedure

1. Deploy the application with the required environment variables.
2. Run the existing course Sync once for each course that uses `generic-card`, `data-matrix`, `gallery-story`, `gallery-slide`, `card-spec`, or `card-case`.
3. Confirm the sync completes. Review sync warnings for `R2_IMAGE_VARIANT_FAILED`.
4. Re-run failed courses after correcting unsupported or inaccessible source files.

Re-running Sync is safe because R2 object keys are content-addressed. Existing originals remain available, and an original already hosted in R2 is not uploaded again when only variants are missing.

Sync checks each object using signed HEAD requests to R2. Existing originals and variants are reused; only missing variants are converted and uploaded. A complete R2 asset also skips the source download. Notion source URLs still require one download to calculate the content hash, so changed image content receives new keys even if its URL is unchanged. The R2 credential must permit object reads as well as writes. Only a 404 is treated as missing; other check failures are reported through the existing sync warning flow.

SVG and animated GIF files remain original-only. HEIC/HEIF photos are decoded on the server and converted to JPEG at quality 1 without resizing. The JPEG becomes the original URL for display and printing, with WebP variants generated from it. JPEG conversion is lossy despite preserving pixel dimensions. The main image is used for multi-image HEIC containers. Existing R2 HEIC files are migrated on the next Sync; their old objects are not deleted. Corrupt or unsupported inputs retain their source URL through the existing sync failure handling and produce a warning.

## Browser Verification

Use a photo-heavy course and disable browser cache.

1. Confirm Generic Card and Data Matrix cells request `-thumbnail.webp`.
2. Confirm Gallery Story process tiles and Card Spec inline media request `-thumbnail.webp`.
3. Confirm Generic Card modals, Data Matrix details, Gallery Story main/modal media, Gallery Slide stages/modals, Card Spec modals, and CardCase modals request `-preview.webp`.
4. Trigger both CardCase print layouts and confirm requests use the original extension, never either WebP variant.
5. Confirm legacy records without variant metadata still display their original image.

## Performance Record

Measure the same initial route before and after deployment with mobile throttling and browser cache disabled. Record only image requests completed while visible content settles.

| Course and route | Version | Image requests | Image transferred bytes | Visible images complete | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| _Fill during deployment verification_ | Before |  |  |  |  |
| _Same course and route_ | After |  |  |  |  |

The migrated route must transfer fewer image bytes. Investigate before release if visible images complete more slowly or if ordinary browsing requests an original while a suitable variant exists.
