# UI Pattern Contract

Allowed `UiPattern` values:
- `card-spec`
- `data-matrix`
- `gallery-slide`
- `gallery-story`
- `generic-card`

Enum mapping:
- `card-spec -> CardSpec`
- `data-matrix -> DataMatrix`
- `gallery-slide -> GallerySlide`
- `gallery-story -> GalleryStory`
- `generic-card -> GenericCard`

Fallback:
- Unknown or missing `UiPattern` must fallback to `generic-card`.
