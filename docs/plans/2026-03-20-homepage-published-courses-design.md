# Homepage Published Courses Design

**Goal:** Make unpublished courses stay off the homepage when the site reads course data from Supabase.

**Decision:** Apply the rule in the server-side Supabase homepage query instead of in the React UI. This keeps the behavior centralized and makes the homepage depend on `courses.is_published`, which is already populated during sync.

**Chosen Scope:** Only change the homepage Supabase read path. The Notion fallback path remains unchanged for now because the requested behavior was specifically to add `is_published=true` filtering to the homepage data query.

**Testing:** Add a server test that proves unpublished courses are filtered out from `fetchCoursesFromSupabase()`.
