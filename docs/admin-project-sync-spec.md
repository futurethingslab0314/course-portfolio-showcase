# Admin Project Sync

## Approved User Experience

- Visitors see an Admin entry in the header, but no Sync Data or Refresh controls.
- Admin opens a password login dialog. Authenticated administrators can log out.
- Each selected database-backed assignment has a Sync This Assignment button.
- Synchronization reads that assignment's Notion content and related records, processes images, and updates its stored works.
- A persistent top-right notification shows the assignment name, stage, progress, and completion or failure.
- Changing assignment tabs or course routes does not discard the notification.
- Completion reloads data when the affected course is visible. Other courses are not replaced with the completed job's data.
- External-link assignments offer admin-only synchronization of the URL and assignment settings, without processing images or changing stored works. Blank or invalid HTTP(S) URLs are rejected before writing.

## Authentication

- Configure a dedicated ADMIN_PASSWORD server-side; never expose it in frontend assets, URLs, or logs.
- Reject login when the password is not configured. Do not ship a default password.
- Use short-lived, opaque, server-tracked sessions with HttpOnly, SameSite=Strict cookies and Secure cookies in production.
- Sessions expire after eight hours; logout revokes the session and clears the cookie.
- Rate-limit login attempts. Validate same-origin requests for state-changing cookie-authenticated endpoints.
- Authenticate every new synchronization and job-status endpoint; hiding a button is not authorization.
- Existing token-authenticated Notion automation endpoints remain compatible and do not become public.

## Assignment Isolation

- Accept only a course identifier and assignment identifier, not caller-supplied database IDs, image URLs, or mappings.
- Resolve the course and confirm assignment membership server-side before fetching works.
- Read works only for the selected assignment. CardCase includes its related student, case, and body-part records.
- Reuse mapping and media transformation logic, including HEIC conversion and existing-image checks.
- Resolve the existing stored course; do not update its cover, publication state, or unrelated course metadata as a side effect.
- Upsert only the selected assignment and its works. Scope stale-work removal to that assignment.
- Never invoke course-wide stale-project deletion during an assignment sync.
- Detect shared-source or shared-work ownership conflicts before writing; do not move another assignment's rows silently through a global upsert key.
- Abort before database changes on source read errors, invalid mappings, or an unexpected empty result. Preserve existing works and report a useful error.
- Skip stale-work deletion if any work was skipped or failed during persistence. Do not describe a partial write as a rollback.

## Jobs and Progress

- Start an authenticated background job and return its ID promptly. The frontend polls status independently of the selected assignment.
- Reuse the active job when the same assignment is requested again.
- Serialize database sync execution in the first version, including existing course sync entry points, to avoid overlapping course and assignment writes.
- Stages: queued, reading Notion, processing images, updating database, complete, failed.
- Reading Notion and database writes show indeterminate progress when totals are unknown.
- After reading data, enumerate image references using the same traversal as the media pipeline. Report processed/total images and uploaded, skipped, and failed counts.
- The determinate bar represents image processing, not an invented percentage of total elapsed time. Reaching the image total is followed by a separate database stage.
- Retain bounded job history. Restore the administrator's current job after reload using a non-secret job ID; validate its status through authenticated requests.
- Show recoverable polling errors and retry without starting another sync. Do not treat a failed status request as a failed background job.
- Completion with image warnings is visibly distinct from clean success.
- The initial deployment assumes one backend instance. Sessions and jobs may live in bounded server memory; a restart expires sessions and interrupts jobs. Unknown jobs must produce an explicit interrupted/status-unavailable message, not endless loading. Multi-instance deployment requires shared sessions, locks, and durable jobs before enabling this feature.

## Verification

- Authentication: missing configuration, bad password, rate limits, session expiry, logout, cross-origin writes, and unauthenticated job access.
- Isolation: invalid course/assignment pairing, unrelated projects retained, shared-work conflicts, source errors, empty reads, and persistence failures.
- Progress: accurate image totals, existing-image skips, failed images, duplicate starts, and completion only after persistence.
- UI: visitor controls absent, login/logout, tab and route changes while syncing, polling recovery, and automatic refresh of the affected course.
- Verify responsive header/dialog/notification layout and keyboard accessibility.
- Run type checks, focused backend/frontend tests, and production build before completion.

## Delivery Boundaries

- No production synchronization, password configuration, or deployment is performed merely by implementing this feature.
- The administrator sets ADMIN_PASSWORD through the deployment environment, not in chat or a committed file.
- This feature does not by itself restore previously missing data or repair unverified mapping configurations.
