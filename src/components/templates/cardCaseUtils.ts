import { StudentWork } from '../../types';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function collectCardCaseMemberNames(works: StudentWork[]): string[] {
  return [...new Set(works.flatMap((work) => (work.memberDetails || []).map((member) => member.name).filter(Boolean)))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function filterCardCaseWorksByStudent(works: StudentWork[], selectedStudent?: string): StudentWork[] {
  if (!selectedStudent) return works;
  return works.filter((work) => (work.memberDetails || []).some((member) => member.name === selectedStudent));
}

export function getCardCaseStudentLabel(work: StudentWork): string {
  const names = (work.memberDetails || []).map((member) => member.name).filter(Boolean);
  return names.length ? names.join(', ') : 'Unknown Student';
}

export function buildCardCasePrintHtml(works: StudentWork[], title: string): string {
  const cards = works
    .map((work) => {
      const studentLabel = getCardCaseStudentLabel(work);
      const imageSection = work.mainImage
        ? `<img src="${escapeHtml(work.mainImage)}" alt="${escapeHtml(work.assignmentName)}" class="image" />`
        : `<div class="image fallback"></div>`;

      return `
        <article class="card">
          ${imageSection}
          <div class="body">
            <div class="meta">${escapeHtml(work.year || 'N/A')} • ${escapeHtml(work.designTeam || 'N/A')}</div>
            <h2>${escapeHtml(work.assignmentName)}</h2>
            <div class="student">${escapeHtml(studentLabel)}</div>
            <div class="target">Target User: ${escapeHtml(work.targetUser || 'N/A')}</div>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111; }
          .page-title { padding: 0 0 6mm; font-size: 16pt; font-weight: 700; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }
          .card { border: 1px solid #ddd; min-height: 88mm; display: flex; flex-direction: column; overflow: hidden; }
          .image { width: 100%; height: 48mm; object-fit: cover; background: #f3f4f6; }
          .fallback { background: linear-gradient(135deg, #1d4ed8 0%, #a855f7 100%); }
          .body { padding: 4mm; display: flex; flex-direction: column; gap: 2mm; font-size: 9pt; }
          .meta { color: #666; font-size: 8pt; text-transform: uppercase; }
          h2 { margin: 0; font-size: 11pt; line-height: 1.25; }
          .student { font-weight: 700; }
          .target { color: #444; }
        </style>
      </head>
      <body>
        <div class="page-title">${escapeHtml(title)}</div>
        <section class="grid">${cards}</section>
      </body>
    </html>
  `;
}
