---
id: ai-skill-machine-plan-v1
version: "1.0.0"
owner: "course-portfolio-showcase"
language: "zh-TW"
status: "active"
last_updated: "2026-02-27"
---

# AI + Skill 執行規劃（Machine-Readable）

## 1) Goal

```yaml
goal:
  primary: "辨識不同 SourceDatabaseId 的資料結構，並自動 mapping 到 UiPattern template 欄位"
  outcomes:
    - "每筆資料可產生穩定的 canonical payload"
    - "可依 UiPattern 正確渲染，不因 schema 差異崩潰"
    - "filemapping 可追蹤 mapping 規則、信心與版本"
  constraints:
    - "不修改既有 UI component/layout/interaction"
    - "先做資料層 normalization 與 mapping"
```

## 2) Runtime Components

```yaml
components:
  - name: schema-profiler
    type: skill
    input: ["sourceDatabaseId", "sampleRecords[]", "propertyMeta[]"]
    output: ["schemaProfile"]
  - name: field-mapper
    type: skill+llm
    input: ["schemaProfile", "uiPatternContract", "historicalMappings[]"]
    output: ["fieldMapping", "confidenceReport"]
  - name: value-transformer
    type: skill
    input: ["rawRecord", "fieldMapping"]
    output: ["normalizedStudentWork", "warnings[]"]
  - name: pattern-validator
    type: script
    input: ["uiPattern", "normalizedStudentWork[]"]
    output: ["valid", "findings[]"]
```

## 3) Canonical Contracts

### 3.1 UiPattern Enum

```json
{
  "uiPatternEnum": [
    "card-spec",
    "data-matrix",
    "gallery-slide",
    "gallery-story",
    "generic-card"
  ],
  "fallback": "generic-card"
}
```

### 3.2 Canonical StudentWork Schema

```json
{
  "$id": "StudentWork",
  "type": "object",
  "required": ["id", "assignmentName", "members", "description", "mainImage", "sourceDatabaseId"],
  "properties": {
    "id": { "type": "string" },
    "assignmentName": { "type": "string" },
    "members": { "type": "array", "items": { "type": "string" } },
    "description": { "type": "string" },
    "mainImage": { "type": "string" },
    "moreImages": { "type": "array", "items": { "type": "string" } },
    "url": { "type": "string" },
    "video": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "year": { "type": "string" },
    "isStarred": { "type": "boolean" },
    "methodologies": { "type": "array", "items": { "type": "string" } },
    "dataSpecs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label", "value", "timestamp"],
        "properties": {
          "label": { "type": "string" },
          "value": { "type": "string" },
          "timestamp": { "type": "string" }
        }
      }
    },
    "sourceDatabaseId": { "type": "string" },
    "gridLocation": { "type": "string" }
  }
}
```

### 3.3 FileMapping Record Schema

```json
{
  "$id": "FileMappingRecord",
  "type": "object",
  "required": ["sourceDatabaseId", "uiPattern", "version", "fieldMapping", "updatedAt"],
  "properties": {
    "sourceDatabaseId": { "type": "string" },
    "uiPattern": { "type": "string" },
    "version": { "type": "string" },
    "fieldMapping": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "sourceCandidates": { "type": "array", "items": { "type": "string" } },
          "transform": { "type": "string" },
          "default": {}
        }
      }
    },
    "confidenceReport": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["targetField", "score", "reason"],
        "properties": {
          "targetField": { "type": "string" },
          "score": { "type": "number" },
          "reason": { "type": "string" },
          "status": { "type": "string", "enum": ["auto", "review"] }
        }
      }
    },
    "updatedAt": { "type": "string" }
  }
}
```

## 4) Execution Pipeline (Deterministic Order)

```yaml
pipeline:
  - step: P1_schema_profile
    action: "extract property names/types/null-rate/examples from source DB"
    output: "schemaProfile"
  - step: P2_pattern_inference
    action: "infer uiPattern by required-field signals; fallback generic-card"
    output: "uiPattern"
  - step: P3_field_mapping
    action: "generate mapping rules by rule-first + LLM fallback"
    output: "fieldMapping + confidenceReport"
  - step: P4_value_normalization
    action: "transform each raw record to StudentWork schema"
    output: "normalizedStudentWork[] + warnings[]"
  - step: P5_pattern_validation
    action: "validate pattern-specific minimum data sufficiency"
    output: "valid/findings"
  - step: P6_publish_mapping
    action: "write filemapping record with version bump"
    output: "mapping artifact"
```

## 5) Decision Rules

```yaml
decision_rules:
  ui_pattern:
    data-matrix:
      requires: ["gridLocation"]
    card-spec:
      recommends: ["dataSpecs"]
    gallery-slide:
      recommends: ["moreImages"]
    gallery-story:
      recommends: ["moreImages", "methodologies", "url"]
    generic-card:
      default: true
  confidence_threshold:
    auto_accept: "score >= 0.85"
    human_review: "0.60 <= score < 0.85"
    reject: "score < 0.60"
  fallback:
    unknown_ui_pattern: "generic-card"
    missing_required_field: "apply default + warning"
```

## 6) LLM Task Specs

### 6.1 Mapping Inference Prompt Contract

```json
{
  "task": "infer_field_mapping",
  "inputs": {
    "sourceDatabaseId": "string",
    "schemaProfile": "object",
    "targetSchema": "StudentWork",
    "uiPattern": "string"
  },
  "output_format": {
    "fieldMapping": "object",
    "confidenceReport": "array"
  },
  "rules": [
    "Prefer exact-name/type matches first",
    "Use semantic mapping only when exact mapping unavailable",
    "Always provide reason for each target field",
    "Do not invent non-existing source fields"
  }
}
```

### 6.2 Datacard Parse Contract

```json
{
  "task": "parse_datacard_text",
  "input": "[timestamp] 2026/02/02 10:00 ;; [location] 廚房門把 ;; [data type] 有無震動 ;; [data value] 1",
  "output": {
    "label_value_pairs": [
      { "label": "timestamp", "value": "2026/02/02 10:00", "timestamp": "2026-02-02T10:00:00+08:00" },
      { "label": "location", "value": "廚房門把", "timestamp": "" },
      { "label": "data type", "value": "有無震動", "timestamp": "" },
      { "label": "data value", "value": "1", "timestamp": "" }
    ]
  }
}
```

## 7) Skill Packaging Plan

```yaml
skills:
  - name: schema-profiler
    deliverables:
      - "SKILL.md"
      - "scripts/profile_schema.ts"
      - "references/type-inference-rules.md"
  - name: field-mapper
    deliverables:
      - "SKILL.md"
      - "scripts/infer_mapping.ts"
      - "references/ui-pattern-contract.md"
      - "references/mapping-examples.md"
  - name: value-transformer
    deliverables:
      - "SKILL.md"
      - "scripts/normalize_records.ts"
      - "scripts/validate_for_pattern.ts"
```

## 8) API/Job Interface (Recommended)

```yaml
jobs:
  - id: infer-and-sync-mapping
    input:
      sourceDatabaseId: "string"
      overwrite: "boolean"
    output:
      uiPattern: "string"
      fieldMapping: "object"
      warnings: "array"
      findings: "array"
```

## 9) Failure Codes

```yaml
errors:
  - code: UI_PATTERN_MISSING
    severity: warning
  - code: UI_PATTERN_INVALID
    severity: warning
  - code: FIELDMAPPING_UNSUPPORTED
    severity: warning
  - code: WORK_REQUIRED_FIELD_MISSING
    severity: warning
  - code: MAPPING_LOW_CONFIDENCE
    severity: review
```

## 10) MVP Rollout

```yaml
mvp_scope:
  phase_1:
    - "完成 schema-profiler + field-mapper（先支援 generic-card, gallery-slide）"
  phase_2:
    - "加上 card-spec datacard parser 與 validation"
  phase_3:
    - "加上 data-matrix gridLocation 自動判斷與完整 5 pattern 支援"
done_criteria:
  - "新 sourceDatabaseId 可在一次流程內得到可用 mapping"
  - "低信心欄位會被標記 review，不阻斷發布"
  - "前端模板渲染不需改動，資料可直接套用"
```

