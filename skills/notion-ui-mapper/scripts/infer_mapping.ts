import { FieldMapping } from '../../../shared/contracts';

const args = process.argv.slice(2);
const propertyList = args[0] ? args[0].split(',').map((s) => s.trim()).filter(Boolean) : [];

function findCandidate(names: string[], keywords: string[]): string[] {
  return names.filter((name) => keywords.some((kw) => name.toLowerCase().includes(kw)));
}

const mapping: FieldMapping = {
  assignmentName: { sourceCandidates: findCandidate(propertyList, ['title', 'assignment', 'name']), transform: 'string' },
  members: { sourceCandidates: findCandidate(propertyList, ['member', 'author', 'student']), transform: 'string[]' },
  description: { sourceCandidates: findCandidate(propertyList, ['description', 'summary']), transform: 'string' },
  mainImage: { sourceCandidates: findCandidate(propertyList, ['image', 'cover', 'thumbnail', 'file', 'files', 'media']), transform: 'string' },
  tags: { sourceCandidates: findCandidate(propertyList, ['tag', 'category']), transform: 'string[]' },
  year: { sourceCandidates: findCandidate(propertyList, ['year', 'semester', 'date']), transform: 'string' },
};

console.log(JSON.stringify(mapping, null, 2));
