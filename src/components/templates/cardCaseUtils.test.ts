import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentWork } from '../../types';
import { buildCardCasePrintHtml, collectCardCaseMemberNames, filterCardCaseWorksByStudent, getCardCaseAvailableYears, getCardCaseStudentLabel } from './cardCaseUtils';

const caseWorks: StudentWork[] = [
  {
    id: 'case-1',
    assignmentName: 'Rehab Glove',
    members: ['Alice', 'Bob'],
    memberDetails: [
      { name: 'Alice', id: 'S001' },
      { name: 'Bob', id: 'S002' },
    ],
    description: '',
    mainImage: 'https://example.com/a.jpg',
    interactionPart: 'https://example.com/hand.png',
    targetUser: 'Stroke Patient',
    designTeam: 'Team Alpha',
    year: '2026',
    tags: ['rehab'],
    sourceDatabaseId: 'student-db',
    cardCaseRecordType: 'case',
    group: 'A',
  },
  {
    id: 'case-2',
    assignmentName: 'Foot Trainer',
    members: ['Bob'],
    memberDetails: [{ name: 'Bob', id: 'S002' }],
    description: '',
    mainImage: 'https://example.com/b.jpg',
    targetUser: 'Runner',
    designTeam: 'Team Alpha',
    year: '2026',
    tags: ['sport'],
    sourceDatabaseId: 'student-db',
    cardCaseRecordType: 'case',
    group: 'A',
  },
];

test('collectCardCaseMemberNames returns sorted unique student names from visible cases', () => {
  assert.deepEqual(collectCardCaseMemberNames(caseWorks), ['Alice', 'Bob']);
});

test('filterCardCaseWorksByStudent returns all works when no student is selected', () => {
  assert.deepEqual(
    filterCardCaseWorksByStudent(caseWorks, undefined).map((work) => work.id),
    ['case-1', 'case-2'],
  );
});

test('filterCardCaseWorksByStudent returns only cases owned by the selected student', () => {
  assert.deepEqual(
    filterCardCaseWorksByStudent(caseWorks, 'Alice').map((work) => work.id),
    ['case-1'],
  );
});

test('getCardCaseStudentLabel shows the student names for a card', () => {
  assert.equal(getCardCaseStudentLabel(caseWorks[0]), 'Alice, Bob');
});

test('buildCardCasePrintHtml includes student labels and card names for print output', () => {
  const html = buildCardCasePrintHtml(caseWorks, 'Group A');
  assert.match(html, /Rehab Glove/);
  assert.match(html, /Foot Trainer/);
  assert.match(html, /Alice, Bob/);
  assert.match(html, /Group A/);
  assert.match(html, /page-grid/);
  assert.match(html, /page-break-after: always/);
  assert.match(html, /hand\.png/);
  assert.match(html, /rehab/);
});

test('getCardCaseAvailableYears only uses group-level years', () => {
  const works: StudentWork[] = [
    {
      id: 'group-a',
      assignmentName: 'Group A',
      members: [],
      description: '',
      mainImage: '',
      sourceDatabaseId: 'student-db',
      cardCaseRecordType: 'group',
      group: 'A',
      year: '2024',
    },
    {
      id: 'group-b',
      assignmentName: 'Group B',
      members: [],
      description: '',
      mainImage: '',
      sourceDatabaseId: 'student-db',
      cardCaseRecordType: 'group',
      group: 'B',
      year: '2026',
    },
    {
      id: 'case-99',
      assignmentName: 'Case 99',
      members: [],
      description: '',
      mainImage: '',
      sourceDatabaseId: 'student-db',
      cardCaseRecordType: 'case',
      group: 'B',
      year: '2030',
    },
  ];

  assert.deepEqual(getCardCaseAvailableYears(works), ['ALL', '2026', '2024']);
});
