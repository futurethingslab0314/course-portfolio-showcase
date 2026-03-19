# Blog Post Rich Format Design

**Goal:** Extend the `blog-post` Notion renderer so common rich-text formatting and toggle blocks are preserved in the web article.

## Scope

- Support `heading_1`, `heading_2`, `heading_3` as distinct visual heading levels.
- Support rich-text annotations for `bold`, `italic`, `underline`, `strikethrough`, and `code`.
- Preserve existing `link` behavior.
- Support `toggle` blocks, including nested child content.
- Reuse the same rich-text renderer for normal text blocks and table cells.

## Approach

- Expand the blog content model to carry structured rich-text spans instead of only plain strings.
- Add block metadata so the frontend can distinguish paragraphs, headings, quotes, callouts, list items, and toggles.
- Parse toggle children recursively from Notion blocks into nested blog content sections.
- Centralize rendering in the `blog-post` renderer so all rich-text formatting is styled consistently.

## Rendering Rules

- Paragraphs stay visually close to the current blog layout.
- `heading_1/2/3` render as progressively smaller heading styles.
- `bold`, `italic`, `underline`, `strikethrough`, and `inline code` are rendered inline within text and table cells.
- `toggle` renders as a collapsible disclosure block with a clear summary row and nested content container.
- Table cells keep the current table shell and render formatted text inside each cell.

## Compatibility

- Existing plain-text blog content should continue to render without migration.
- Existing table support and link support must remain intact.
- Supabase parsing should accept both old and new blog content payloads.

## Testing

- Add parser tests for:
  - heading block metadata
  - rich-text annotations
  - toggle blocks with nested child content
- Add renderer tests for:
  - heading output
  - inline formatting output
  - toggle markup
  - formatted table cells
