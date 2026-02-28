# FieldMapping SSOT Policy

Version: v1  
Updated: 2026-02-28

## Purpose

Define single source of truth (SSOT) for FieldMapping rules and prevent duplicated or conflicting rules across docs and skill references.

## Scope

This policy applies to:

1. `docs/source-database-schema-guideline.md`
2. `docs/notion-data-contract.md`
3. `docs/ui-pattern-json-spec.md`
4. `skills/notion-ui-mapper/references/*.md`

## Authority Order (High -> Low)

1. Notion manual corrections (latest `updated_at` on project/source mapping)
2. Historical mapping for same `sourceDatabaseId`
3. Cross-database alias and pattern rules
4. Keyword/fuzzy inference fallback

## Rule Ownership

1. Canonical field semantics and naming:
   - Owner: `docs/source-database-schema-guideline.md`
2. Enum lock and fallback guarantees:
   - Owner: `docs/notion-data-contract.md`
3. Mapping payload format and minimum pattern coverage:
   - Owner: `docs/ui-pattern-json-spec.md`
4. Alias and negative matching rules:
   - Owner: `skills/notion-ui-mapper/references/field-alias-dictionary.md`
5. Historical reuse and conflict resolution behavior:
   - Owner: `skills/notion-ui-mapper/references/historical-mapping-guide.md`
   - Owner: `skills/notion-ui-mapper/references/conflict-resolution-rules.md`

## Conflict Handling

When two rules disagree:

1. Follow authority order first.
2. If authority level is equal, use latest `updated_at`.
3. If still tied, prefer the rule with explicit negative constraints.
4. Mark result as `needs_review` if conflict cannot be resolved deterministically.

## Documentation Hygiene Rules

1. Keep each rule in one owner file only.
2. In non-owner files, reference owner file instead of re-defining rule text.
3. Any rule update must include:
   - why the change is needed
   - effective date
   - impacted canonical fields

## Change Checklist

1. Update owner file.
2. Check whether related files duplicate outdated wording.
3. Update cross-references in `skills/notion-ui-mapper/SKILL.md`.
4. Validate review thresholds for new/changed rules.
