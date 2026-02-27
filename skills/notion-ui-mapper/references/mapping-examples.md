# Mapping Examples

## JSON FieldMapping

```json
{
  "assignmentName": {
    "sourceCandidates": ["Title", "Assignment Name"],
    "transform": "string",
    "default": "Untitled"
  },
  "members": {
    "sourceCandidates": ["Members", "Authors"],
    "transform": "string[]"
  },
  "mainImage": {
    "sourceCandidates": ["MainImage", "Cover"],
    "transform": "string"
  }
}
```

## Line-based FieldMapping

```text
assignmentName = Title,Assignment Name|string
members = Members,Authors|string[]
mainImage = MainImage,Cover|string
```
