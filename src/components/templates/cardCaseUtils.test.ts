import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentWork } from '../../types';
import {
  buildCardCasePrintHtml,
  collectCardCaseMemberNames,
  filterCardCaseWorksByStudent,
  getCardCaseAvailableYears,
  getCardCaseStudentLabel,
  inlinePrintDocumentImages,
  waitForPrintDocumentAssets,
} from './cardCaseUtils';

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
    mainImageThumbnail: 'https://example.com/a-thumbnail.webp',
    mainImagePreview: 'https://example.com/a-preview.webp',
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
  const html = buildCardCasePrintHtml(caseWorks, 'Group A', 'case-analysis');
  assert.match(html, /Rehab Glove/);
  assert.match(html, /Foot Trainer/);
  assert.match(html, /Alice, Bob/);
  assert.match(html, /Group A/);
  assert.match(html, /page-grid/);
  assert.match(html, /page-break-after: always/);
  assert.match(html, /hand\.png/);
  assert.match(html, /rehab/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /\/api\/image-proxy\?url=/);
  assert.match(html, /a\.jpg/);
  assert.doesNotMatch(html, /a-thumbnail\.webp/);
  assert.doesNotMatch(html, /a-preview\.webp/);
  assert.match(html, /\.keyword \{[^}]*display: inline-flex;/);
  assert.match(html, /\.keyword \{[^}]*line-height: 1;/);
  assert.match(html, /\.card \{[^}]*position: relative;/);
  assert.match(html, /\.media \{[^}]*position: absolute;/);
  assert.match(html, /\.media \{[^}]*inset: 0;/);
  assert.match(html, /\.body \{[^}]*position: absolute;/);
  assert.match(html, /\.body \{[^}]*color: #fff;/);
  assert.doesNotMatch(html, /\.body \{[^}]*background: #fff;/);
});

test('buildCardCasePrintHtml keeps the case analysis layout as dense A4 cards', () => {
  const html = buildCardCasePrintHtml([...caseWorks, { ...caseWorks[0], id: 'case-3', assignmentName: 'Third Case' }], 'Group A', 'case-analysis');

  assert.match(html, /@page \{ size: A4 landscape; margin: 10mm; \}/);
  assert.match(html, /page-break/);
  assert.match(html, /\.page-grid \{[^}]*grid-template-columns: repeat\(4, 1fr\);/);
  assert.match(html, /\.card \{[^}]*min-height: 88mm;/);
});

test('buildCardCasePrintHtml stacks two 4x6 observation photos on portrait A4 with one cut line', () => {
  const html = buildCardCasePrintHtml([...caseWorks, { ...caseWorks[0], id: 'case-3', assignmentName: 'Third Case' }], 'Group A', 'observation-photo');

  assert.match(html, /@page \{ size: A4 portrait; margin: 5mm; \}/);
  assert.match(html, /page-break/);
  assert.match(html, /\.page-grid \{[^}]*grid-template-columns: 6in;[^}]*grid-template-rows: repeat\(2, 4in\);[^}]*gap: 0;/);
  assert.match(html, /class="photo-card landscape card"/);
  assert.match(html, /\.card \{[^}]*width: 6in;[^}]*height: 4in;/);
  assert.match(html, /\.card \+ \.card \{[^}]*border-top: 0;/);
  assert.match(html, /\.portrait \.image \{[^}]*width: 4in;[^}]*height: 6in;[^}]*transform: translate\(-50%, -50%\) rotate\(90deg\);/);
  assert.match(html, /image\.naturalWidth > image\.naturalHeight/);
  assert.doesNotMatch(html, /Target User/);
  assert.doesNotMatch(html, /Alice, Bob/);
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

test('waitForPrintDocumentAssets resolves after print images finish loading', async () => {
  let loadHandler: (() => void) | undefined;
  const documentLike = {
    images: [
      {
        complete: false,
        addEventListener: (_event: string, handler: () => void) => {
          loadHandler = handler;
        },
        removeEventListener: () => {},
      },
    ],
  } as unknown as Document;

  const pending = waitForPrintDocumentAssets(documentLike, 20);
  assert.ok(loadHandler);
  loadHandler?.();
  await pending;
});

test('inlinePrintDocumentImages rewrites remote image sources to data URLs', async () => {
  const image = {
    src: 'https://example.com/image.png',
    getAttribute: (name: string) => (name === 'src' ? 'https://example.com/image.png' : null),
    setAttribute: function (name: string, value: string) {
      if (name === 'src') {
        this.src = value;
      }
    },
  };

  const documentLike = {
    images: [image],
  } as unknown as Document;

  await inlinePrintDocumentImages(
    documentLike,
    async () =>
      new Response(new Blob(['abc'], { type: 'image/png' }), {
        status: 200,
      }),
  );

  assert.match(image.src, /^data:image\/png;base64,/);
});
