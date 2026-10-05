# Admin Assignment Sync Setup

## Production

1. Set `ADMIN_PASSWORD` to a strong unique password in Railway environment variables. Do not commit it or send it through chat.
2. Set `ADMIN_ORIGIN` to the exact browser origin, for example `https://your-site.example`. It defaults to `BASE_URL` when omitted.
3. Set `NODE_ENV=production` so the HttpOnly session cookie requires HTTPS.
4. Keep the existing Notion, Supabase and R2 settings. Assignment sync requires the course to have been synced to Supabase once.
5. Deploy and sign in using Admin in the header. Open an assignment and select Sync This Assignment.

The visitor-facing Sync Data / Refresh controls are removed. Notion token-based synchronization remains available. Legacy global-secret synchronization now fails closed if `COURSE_LINK_SYNC_SECRET` / `SYNC_SECRET` is missing; configure that secret if using those endpoints.

## Behavior and Limits

- Sessions last eight hours and are revoked by logout. Passwords are never stored in the browser.
- The notification stays visible while switching course routes and assignment tabs. Image progress counts source image references, not individual generated thumbnail/preview files.
- Existing image variants are skipped by the existing media pipeline. Failed image processing produces a completion warning; source read errors stop database updates.
- Empty assignment results are blocked to protect old works. Intentional full deletion requires a separate reviewed operation.
- Shared source databases or works owned by another assignment are blocked instead of reassigned silently.
- All course and assignment sync writes use the same in-process queue. The initial release supports one backend instance only.
- Sessions and job state are in memory. Server restarts require login again and can interrupt running jobs. The UI reports unavailable status; check stored data before retrying an interrupted save. Writes are not transactional across the entire assignment.
- Login is limited to ten attempts per fifteen minutes per server-visible IP. Reverse proxies may group clients under one IP; forwarded IP headers are not trusted automatically.
- Configure server and image-provider timeouts/monitoring for production. A stalled provider call can delay queued work.

## Local Development

Set `ADMIN_ORIGIN=http://localhost:<vite-port>`, `ADMIN_PASSWORD` locally and use a non-production `NODE_ENV`. Run the API server and Vite. The Vite proxy keeps authentication requests same-origin. Do not use production credentials for UI testing.

No production deployment or data synchronization is performed by the automated tests.
