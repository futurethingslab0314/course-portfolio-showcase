# Homepage Published Courses Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure homepage course data from Supabase only includes published courses.

**Architecture:** Keep the rule in the server data layer by updating `fetchCoursesFromSupabase()` to request only active and published rows. Protect the change with a focused regression test in `server/services/supabase.test.ts`.

**Tech Stack:** Node test runner, TypeScript, Supabase REST API

---

### Task 1: Add regression test for homepage filtering

**Files:**
- Modify: `server/services/supabase.test.ts`

**Step 1: Write the failing test**

Add a test that mocks the Supabase courses response with one published and one unpublished course, then expects `fetchCoursesFromSupabase()` to return only the published one.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`
Expected: FAIL because the function still returns unpublished courses and the request URL does not include the publish filter.

### Task 2: Filter homepage courses in Supabase query

**Files:**
- Modify: `server/services/supabase.ts`
- Test: `server/services/supabase.test.ts`

**Step 1: Write minimal implementation**

Update the `fetchCoursesFromSupabase()` query so it filters rows to active courses where `is_published` is not false.

**Step 2: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test server/services/supabase.test.ts`
Expected: PASS

### Task 3: Verify no type regressions

**Files:**
- Modify: none unless verification reveals an issue

**Step 1: Run project type checks**

Run: `npm run lint`
Expected: PASS
