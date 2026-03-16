# Project Visibility Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store both draft and published projects in Supabase while returning only published projects to the website.

**Architecture:** Read each project's `Visibility` value from Notion and keep it on the server-side project model. The website payload path filters draft projects before returning tabs and works, while the sync path writes all projects to Supabase and marks whether each row is published so draft entries can be promoted later without rebuilding from scratch.

**Tech Stack:** TypeScript, Node.js `node:test`, Express/Vite app server, Notion API, Supabase sync layer

---

### Task 1: Add a failing test for payload filtering

**Files:**
- Create: `server/services/generator.test.ts`
- Modify: `server/services/generator.ts`

**Step 1: Write the failing test**

Add a test that passes one published project row and one draft project row into a new filtering helper and expects only the published row to remain.

**Step 2: Run test to verify it fails**

Run: `node --test server/services/generator.test.ts`
Expected: FAIL because the helper does not exist yet.

### Task 2: Implement Visibility parsing and filtering

**Files:**
- Modify: `src/types.ts`
- Modify: `server/services/notion.ts`
- Modify: `server/services/generator.ts`

**Step 1: Add server-side project visibility field**

Extend the `Project` type with a `visibility` field that can represent `published` and `draft`.

**Step 2: Read Visibility from Notion**

Parse the `Visibility` property in the project fetcher, defaulting missing values to `published` for backward compatibility.

**Step 3: Split website and sync payload behavior**

Keep a website helper in `generator.ts` that filters draft projects before returning payloads, but add a sync path that keeps all projects for Supabase persistence.

### Task 3: Persist visibility in Supabase

**Files:**
- Modify: `server/services/supabase.ts`
- Modify: `server/services/syncToSupabase.ts`
- Test: `server/services/supabase.test.ts`

**Step 1: Write the failing test**

Add tests that verify project upserts include a publication flag and that reading website payloads from Supabase only returns published projects and works.

**Step 2: Store project visibility**

Write the project visibility flag into Supabase and map it back into `Project` when reading.

**Step 3: Keep all projects during sync**

Update the sync service to build its payload from all projects so draft rows stay stored in Supabase.

### Task 4: Verify behavior

**Files:**
- Test: `server/services/generator.test.ts`

**Step 1: Run the focused test**

Run: `node --test server/services/generator.test.ts`
Expected: PASS

**Step 2: Run related regression tests**

Run: `node --test server/services/notion.test.ts server/services/supabase.test.ts src/data/courseData.test.ts`
Expected: PASS
