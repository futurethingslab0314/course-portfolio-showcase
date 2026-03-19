# Activity Event Template Design

## Goal

Add a first-class `activity-event` project template that renders activity and event records from Notion with the same end-to-end flow as existing project templates.

## Why This Needs a Dedicated Template

The current app only supports a fixed set of `displayStyle` values and the existing `StudentWork` shape does not formally include activity-specific metadata such as `themeTag`, date range, location, grant, or publication details. A dedicated template keeps the data model explicit and lets project pages render event records without overloading `generic-card`.

## Approved Scope

- Add `activity-event` as a valid `displayStyle`.
- Add activity-specific optional fields to `StudentWork`.
- Normalize common Notion field names for activity records without requiring manual `FieldMapping`.
- Keep `FieldMapping` as an override layer when a project uses different property names.
- Render the approved card + modal experience in the same folder as other project templates.

## Data Contract

The normalized `StudentWork` record will support these fields for the new template:

- `themeTag`
- `startDate`
- `endDate`
- `country`
- `city`
- `grant`
- `publicationName`

Existing shared fields still apply:

- `assignmentName`
- `description`
- `mainImage`
- `moreImages`
- `year`
- `members`
- `url`

## Notion Alias Mapping

The default activity-event aliases should work even when the Notion project does not define `FieldMapping`.

Primary aliases:

- `Activity Name` -> `assignmentName`
- `description` -> `description`
- `Files & media` -> `mainImage` + `moreImages`
- `theme tag` -> `themeTag`
- `year` -> `year`
- `start date` -> `startDate`
- `end date` -> `endDate`
- `country` -> `country`
- `city` -> `city`
- `grant` -> `grant`
- `publication name` -> `publicationName`
- `members` -> `members`

Fallback behavior:

- First file from `Files & media` becomes `mainImage`.
- Remaining files become `moreImages`.
- `themeTag` should also be merged into `tags` so filtering and label fallbacks continue to work.
- If `publicationName` is absent, the UI simply hides the publication section.
- If `members` is absent, the authors section is hidden.

## Rendering Design

Component path:

- `src/components/projects/ActivityEvent.tsx`

Behavior:

- Card shows main image, theme tag, year, location, description, and grant.
- Clicking the card opens a modal.
- Modal shows the image gallery on the left and event metadata on the right.
- Optional sections render only when data exists.

## Architecture Changes

Files expected to change:

- `src/types.ts`
- `shared/contracts.ts`
- `shared/notionMapper.ts`
- `server/services/supabase.ts`
- `src/App.tsx`
- `src/components/projects/ActivityEvent.tsx`

Tests expected to change:

- `server/services/supabase.test.ts`
- add a new component test for `ActivityEvent`

## Risks and Guardrails

- Existing projects must keep working, so new aliases must be additive and not replace current fallback rules.
- Supabase parsing must preserve new metadata stored in `student_works.metadata`.
- `activity-event` should fall back cleanly when optional fields are missing.
