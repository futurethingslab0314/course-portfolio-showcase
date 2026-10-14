# Shared Taiwan Solution wall

The existing `digital-wall/digital-wall.html` remains a browser-local editor when
opened as a file. `/shared-wall/` serves the same editor with a collaboration
adapter. Anyone can view the public URL. Editing and version restore require
the shared editing password; there is no per-person ownership in this mode.

## Storage and deployment

1. Run `sql/2026-10-14-shared-wall.sql` in the existing Supabase project.
2. Keep `SUPABASE_URL` and either `SUPABASE_SECRET_KEY` or
   `SUPABASE_SERVICE_ROLE_KEY` on the server. They are never sent to the browser.
3. Deploy the repository, including `digital-wall/shared-sync.js`, the generated
   HTML/data, and `digital-wall/note-originals`. The server exposes only the needed
   wall assets, not the local backup HTML or other directory contents.
4. Open the original file-based wall in the same browser where the latest edits
   were made. Use **Export Positions** after refreshing to the current code.
5. Open `/shared-wall/` on the deployed host, unlock with the editing password,
   and import that JSON using the setup
   button. Initialization is create-only: later visitors cannot replace the
   existing wall by initializing again.

Do not seed from the checked-in JSON when the browser contains newer manual edits.
The import includes pending/placed status, photo positions, notes, and grid shape.
Zoom and display size stay personal to each browser.

## Collaboration behavior

- Changes are saved after 700 ms of inactivity. Other clients check for updates
  every two seconds. No remote state is applied during dragging or text editing.
- Changes to different photos or notes merge. Editing the same record from stale
  state returns a conflict instead of overwriting another person's work.
- Unsynced drafts survive reloads in local storage. Conflict UI permits downloading
  the draft or explicitly discarding it in favor of the shared version.
- Supabase updates use revision compare-and-swap. A database trigger archives each
  committed snapshot in the same transaction. Restore creates a new revision and
  checks that no one changed the wall since the user viewed it.
- The UI exposes the latest 50 revisions; the database retains earlier revisions.

## Local preview

Run the server with `PORT=8788` and
`SHARED_WALL_LOCAL_FILE=/tmp/taiwan-shared-wall-preview.json`, then open
`http://localhost:8788/shared-wall/`.

This opt-in file store is only for a single-process local preview. It is rejected
when `NODE_ENV=production`; public hosting uses Supabase. Local preview and
production do not share changes.

## Checks

`node --import tsx --test server/services/sharedWall.test.ts`

`node node_modules/typescript/bin/tsc -p tsconfig.server.json --noEmit`

Browser verification covers two independent sessions, initial import preservation,
cross-client note changes, offline draft recovery, and version listing.
## Password-Protected Editing and Undo

Public visitors may read the wall without logging in. Set `SHARED_WALL_PASSWORD`
to a strong unique password and `SHARED_WALL_ORIGIN` to the exact HTTPS origin
of the deployed site. Keep the password in server environment variables, never
in the generated HTML. Missing configuration disables editing. All write APIs,
including initialization and version restore, require an authenticated session
and a matching Origin header.

Editor sessions use HttpOnly, SameSite=Strict cookies (Secure in production),
expire after eight hours, and are cleared on server restart. Sessions and login
rate limits are process-local; deploy one application instance, or replace them
with a shared session store before enabling multiple replicas. Use HTTPS.

The arrow controls undo/redo up to 100 edits in the current page session.
Reloading or using a layout command that reloads the page clears this history.
Local saved positions and notes are preserved. Shared undo changes only the
affected items and rejects a restore when another editor changed those items.
Version history remains available separately for whole-wall recovery.
