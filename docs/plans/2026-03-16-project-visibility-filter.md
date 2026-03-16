# Project Visibility Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exclude projects marked as `Visibility = draft` from the course payload returned to the website.

**Architecture:** Read each project's `Visibility` value from Notion, keep it in the server-side project model, and filter out draft projects while building the course payload. Because student works are fetched from the filtered project list, the frontend will only receive published tabs and their works.

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

**Step 3: Filter draft projects out of the payload**

Add a helper in `generator.ts` and use it before fetching student works so only published projects contribute to the response.

### Task 3: Verify behavior

**Files:**
- Test: `server/services/generator.test.ts`

**Step 1: Run the focused test**

Run: `node --test server/services/generator.test.ts`
Expected: PASS

**Step 2: Run related regression tests**

Run: `node --test server/services/notion.test.ts server/services/supabase.test.ts src/data/courseData.test.ts`
Expected: PASS
