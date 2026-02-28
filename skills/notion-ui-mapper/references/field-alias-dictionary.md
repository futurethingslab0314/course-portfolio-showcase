# Field Alias Dictionary

Use this file as the canonical alias dictionary for cross-database field inference.

## Canonical Targets and Positive Aliases

### assignmentName

- `AssignmentName`
- `Title`
- `ProjectName`
- `Name`
- `Topic`

### members

- `Members`
- `StudentName`
- `MemberName`
- `Authors`
- `Team`

### studentIds

- `StudentID`
- `StudentId`
- `MemberID`
- `IDNumber`
- `學號`

### description

- `Description`
- `ProjectIntro`
- `Summary`
- `Brief`
- `Overview`
- `Abstract`

### mainImage

- `MainImage`
- `Cover`
- `Thumbnail`
- `HeroImage`

### moreImages

- `MoreImages`
- `Gallery`
- `Slides`
- `ImageSet`

### dataSpecs

- `DataSpecs`
- `DataCard`
- `Card01`
- `Card02`
- `Spec`
- `Metric`

### gridLocation

- `GridLocation`
- `Grid`
- `Cell`
- `MatrixLocation`

## Negative Rules (Do Not Map)

1. Do not map `assignmentName` from:
   - `StudentName`
   - `StudentID`
   - `Members`
2. Do not map `members` from:
   - `StudentID`
   - `IDNumber`
3. Do not map `studentIds` from:
   - `StudentName`
   - `Members`
4. Do not map `gridLocation` from:
   - `Year`
   - `Tags`

## Usage Notes

1. Prioritize exact alias matches before keyword fuzzy matching.
2. Apply negative rules after candidate generation and before final scoring.
3. If alias rule conflicts with manual Notion mapping, keep manual mapping and mark dictionary update candidate.
