# Blog Post Rich Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `blog-post` pages preserve common Notion rich-text formatting and toggle blocks.

**Architecture:** Extend the Notion-to-blog-content model with structured rich-text spans and block metadata, then render those structures through one shared blog content renderer. Keep backward compatibility by continuing to support plain-string content while layering richer formatting support on top.

**Tech Stack:** TypeScript, React, Node test runner, tsx, Notion API block parsing

---

### Task 1: Define failing parser and renderer tests

**Files:**
- Modify: `server/services/notion.test.ts`
- Modify: `src/components/projects/BlogPost.test.tsx`

**Step 1: Write the failing test**

- Add parser expectations for:
  - heading block metadata
  - annotation preservation
  - toggle child parsing
- Add renderer expectations for:
  - heading output
  - inline formatting tags/styles
  - toggle disclosure markup
  - formatted table cell output

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/notion.test.ts src/components/projects/BlogPost.test.tsx`

Expected: FAIL because heading metadata, annotations, and toggle rendering are not implemented yet.

**Step 3: Write minimal implementation**

- No production code in this task.

**Step 4: Run test to verify it still fails correctly**

Run: `./node_modules/.bin/tsx --test server/services/notion.test.ts src/components/projects/BlogPost.test.tsx`

Expected: FAIL with missing metadata/rendering behavior, not syntax errors.

### Task 2: Extend blog content types and Notion parsing

**Files:**
- Modify: `src/types.ts`
- Modify: `server/services/notion.ts`
- Modify: `server/services/supabase.ts`

**Step 1: Write the failing test**

- Use the tests from Task 1.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test server/services/notion.test.ts`

Expected: FAIL on heading metadata, annotation fields, or toggle children.

**Step 3: Write minimal implementation**

- Expand rich-text span annotations.
- Add block type metadata for text sections.
- Add toggle section shape with recursive child content.
- Parse heading, list, quote, callout, and toggle blocks into the richer model.
- Preserve backward compatibility in Supabase parsing.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test server/services/notion.test.ts`

Expected: PASS

### Task 3: Render headings, annotations, and toggles

**Files:**
- Modify: `src/components/projects/BlogPostContent.tsx`
- Modify: `src/components/projects/BlogPost.tsx`

**Step 1: Write the failing test**

- Use the tests from Task 1.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/components/projects/BlogPost.test.tsx`

Expected: FAIL because formatted output and toggle markup are missing.

**Step 3: Write minimal implementation**

- Centralize rich-text rendering with annotation-aware inline elements.
- Render heading block types with distinct semantic/visual output.
- Render toggle blocks with disclosure UI and nested content.
- Reuse the same inline renderer inside table cells.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/components/projects/BlogPost.test.tsx`

Expected: PASS

### Task 4: Verify related behavior

**Files:**
- No code changes required unless regressions appear.

**Step 1: Run focused regression checks**

Run: `./node_modules/.bin/tsx --test src/data/courseData.test.ts server/services/supabase.test.ts server/services/syncButtonAuth.test.ts server/services/notion.test.ts src/components/projects/BlogPost.test.tsx`

Expected: PASS

**Step 2: Run type checking if environment allows**

Run: `npm run lint`

Expected: PASS, or document if the sandbox hangs without returning output.
