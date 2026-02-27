import { normalizeStudentWork, parseFieldMapping } from '../../../shared/notionMapper';
import { NormalizationWarning } from '../../../shared/contracts';

const [rawMapping = '{}', rawRecords = '[]', sourceDatabaseId = 'unknown-db'] = process.argv.slice(2);

const warnings: NormalizationWarning[] = [];
const mapping = parseFieldMapping(rawMapping, warnings, { sourceDatabaseId });
const records = JSON.parse(rawRecords) as Record<string, unknown>[];

const normalized = records.map((record) =>
  normalizeStudentWork(record, sourceDatabaseId, mapping, warnings, { sourceDatabaseId }),
);

console.log(JSON.stringify({ normalized, warnings }, null, 2));
