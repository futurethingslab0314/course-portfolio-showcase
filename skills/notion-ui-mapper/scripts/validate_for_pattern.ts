import { StudentWork } from '../../../src/types';
import { UiPattern } from '../../../shared/contracts';

const [patternArg = 'generic-card', rawRecords = '[]'] = process.argv.slice(2);
const pattern = patternArg as UiPattern;
const records = JSON.parse(rawRecords) as StudentWork[];

const findings: string[] = [];

for (const record of records) {
  if (!record.assignmentName) findings.push(`${record.id}: assignmentName missing`);
  if (!record.mainImage) findings.push(`${record.id}: mainImage missing`);

  if (pattern === 'data-matrix' && !record.gridLocation) {
    findings.push(`${record.id}: gridLocation required for data-matrix`);
  }

  if (pattern === 'card-spec' && (!record.dataSpecs || !record.dataSpecs.length)) {
    findings.push(`${record.id}: dataSpecs recommended for card-spec`);
  }
}

console.log(JSON.stringify({ valid: findings.length === 0, findings }, null, 2));
