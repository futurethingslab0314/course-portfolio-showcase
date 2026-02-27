<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9e81d424-336d-4875-a7ed-3c3fde03a0bf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill required vars.
3. Start backend API (Notion fetch + generation):
   `npm run dev:server`
4. Run the frontend app:
   `npm run dev`

## Notion Data APIs

- `GET /api/courses`: list courses from Notion ID1
- `GET /api/course/:slug`: fetch course + projects + normalized student works
- `POST /api/generate` with body `{ \"slug\": \"your-course-slug\" }`: generate payload and write back `CourseLink` + `Status` to ID1

## Notion Webhooks (Button)

- `POST/GET /api/admin/sync-course-link`
  - Header: `x-sync-secret: <COURSE_LINK_SYNC_SECRET>`
  - Body/query: `coursePageId` or `slug`
- `POST/GET /api/admin/sync-project-mappings`
  - Header: `x-sync-secret: <COURSE_LINK_SYNC_SECRET>`
  - Body/query: `projectPageId`
  - Optional: `overwrite=true|false`
