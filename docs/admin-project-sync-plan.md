# Admin Project Sync Implementation Plan

Spec: admin-project-sync-spec.md. Execute natively in the current checkout as requested.

1. Add a shared typed job contract, bounded background job registry, and shared sync serialization. Test duplicate requests and queue recovery after errors.
2. Add server-side opaque sessions, origin checks, throttled password login, logout and authenticated project-job routes. Test unauthorized requests, cookie flags, invalid credentials and origin rejection.
3. Add a project-filtered Notion payload builder and Supabase ownership preflight. Reuse the media pipeline with actual image progress callbacks; scope persistence/deletion to one project. Test source errors, empty payloads and ownership conflicts.
4. Add an application-level admin provider, login dialog, persistent progress notification, and assignment sync button. Remove public refresh controls and refresh only the affected visible course on completion.
5. Run focused tests, type checks, production build and UI checks. Document ADMIN_PASSWORD, ADMIN_ORIGIN and single-instance limitations. Do not deploy or trigger production writes.

Review focus: cookie-based CSRF, global work-ID upsert collisions, course-vs-project races, empty-source deletions, and UI state across navigation.
