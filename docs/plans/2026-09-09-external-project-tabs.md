# External project tabs implementation plan

Goal: Render External projects inline while preserving Database behavior for existing projects.
Architecture: Read ContentType and ExternalURL from Notion, default to database. Persist project content settings under field_mapping.projectContent in Supabase's existing JSON column. External projects skip source queries and render an iframe with a direct-link fallback; reject non-HTTP(S) URLs.
Tech stack: React, TypeScript, Notion REST, Supabase REST, node:test.

1. Add regression tests in server/services/notion.test.ts for Notion properties and skipping source requests, including stale source IDs.
2. Add Supabase persistence and React rendering regression tests; run them before implementation.
3. Extend src/types.ts, Notion reading, generator skipping, Supabase serialization and deserialization.
4. Add ExternalProject component and branch CourseDetailTemplate before filters and work layouts.
5. Run regression suite, TypeScript checks, production build, and inspect diff.

No deployment or live database changes are part of this change. ContentType accepts External case-insensitively; missing or other values default to Database. ExternalURL is ignored for Database projects. Embedding restrictions cannot be detected reliably cross-origin; always provide a direct link.
