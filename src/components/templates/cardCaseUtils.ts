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

export function getCardCaseAvailableYears(works: StudentWork[]): string[] {
  const years = [...new Set(
    works
      .filter((work) => work.cardCaseRecordType === 'group')
      .map((work) => (work.year || '').trim())
      .filter(Boolean),
  )].sort((left, right) => right.localeCompare(left));

  return ['ALL', ...years];
}

export function getCardCaseStudentLabel(work: StudentWork): string {
  const names = (work.memberDetails || []).map((member) => member.name).filter(Boolean);
  return names.length ? names.join(', ') : 'Unknown Student';
}

export function waitForPrintDocumentAssets(doc: Document, timeoutMs = 1500): Promise<void> {
  const images = Array.from(doc.images || []).filter((image) => !image.complete);
  if (!images.length) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    let remaining = images.length;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const handleAssetDone = () => {
      remaining -= 1;
      if (remaining <= 0) {
        finish();
      }
    };

    images.forEach((image) => {
      image.addEventListener('load', handleAssetDone, { once: true });
      image.addEventListener('error', handleAssetDone, { once: true });
    });

    setTimeout(finish, timeoutMs);
  });
}

export function buildCardCasePrintHtml(works: StudentWork[], title: string): string {
  const pages = works.reduce<StudentWork[][]>((accumulator, work, index) => {
    const pageIndex = Math.floor(index / 8);
    if (!accumulator[pageIndex]) accumulator[pageIndex] = [];
    accumulator[pageIndex].push(work);
    return accumulator;
  }, []);

  const pageHtml = pages
    .map((pageWorks, pageIndex) => {
      const cards = pageWorks.map((work) => {
      const studentLabel = getCardCaseStudentLabel(work);
      const imageSection = work.mainImage
        ? `<img src="${escapeHtml(work.mainImage)}" alt="${escapeHtml(work.assignmentName)}" class="image" referrerpolicy="no-referrer" />`
        : `<div class="image fallback"></div>`;
      const iconSection = work.interactionPart
        ? `<img src="${escapeHtml(work.interactionPart)}" alt="" class="icon-image" referrerpolicy="no-referrer" />`
        : `<div class="icon-placeholder"></div>`;
      const keywords = (work.tags || [])
        .map((tag) => `<span class="keyword">${escapeHtml(tag)}</span>`)
        .join('');

      return `
        <article class="card">
          <div class="media">
            ${imageSection}
            <div class="overlay"></div>
            <div class="icon-shell">${iconSection}</div>
            <div class="hero-copy">
              <div class="target-label">Target User</div>
              <div class="target-value">${escapeHtml(work.targetUser || 'N/A')}</div>
            </div>
          </div>
          <div class="body">
            <div class="meta">${escapeHtml(work.year || 'N/A')} • ${escapeHtml(work.designTeam || 'N/A')}</div>
            <h2>${escapeHtml(work.assignmentName)}</h2>
            <div class="keywords">${keywords}</div>
            <div class="student">${escapeHtml(studentLabel)}</div>
          </div>
        </article>
      `;
      }).join('');

      return `
        <section class="print-page ${pageIndex < pages.length - 1 ? 'page-break' : ''}">
          <div class="page-title">${escapeHtml(title)}</div>
          <div class="page-grid">${cards}</div>
        </section>
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
          .print-page { min-height: 190mm; }
          .page-break { page-break-after: always; }
          .page-title { padding: 0 0 6mm; font-size: 16pt; font-weight: 700; }
          .page-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }
          .card { border: 1px solid #ddd; min-height: 88mm; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
          .media { position: relative; height: 48mm; overflow: hidden; background: #e5e7eb; }
          .image { width: 100%; height: 100%; object-fit: cover; background: #f3f4f6; }
          .fallback { background: linear-gradient(135deg, #1d4ed8 0%, #a855f7 100%); }
          .overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.1)); }
          .icon-shell { position: absolute; top: 4mm; left: 4mm; width: 12mm; height: 12mm; border-radius: 999px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .icon-image { width: 100%; height: 100%; object-fit: cover; }
          .icon-placeholder { width: 100%; height: 100%; }
          .hero-copy { position: absolute; left: 4mm; bottom: 4mm; color: #fff; }
          .target-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.65; margin-bottom: 1mm; }
          .target-value { font-size: 9pt; font-weight: 700; }
          .body { padding: 4mm; display: flex; flex-direction: column; gap: 2mm; font-size: 9pt; }
          .meta { color: #666; font-size: 8pt; text-transform: uppercase; }
          h2 { margin: 0; font-size: 11pt; line-height: 1.25; }
          .keywords { display: flex; flex-wrap: wrap; gap: 1.2mm; min-height: 8mm; }
          .keyword { display: inline-flex; align-items: center; padding: 0.7mm 1.8mm; border-radius: 2.6mm; border: 1px solid #d4d4d8; font-size: 7pt; line-height: 1; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
          .student { font-weight: 700; margin-top: auto; }
        </style>
      </head>
      <body>
        ${pageHtml}
      </body>
    </html>
  `;
}
