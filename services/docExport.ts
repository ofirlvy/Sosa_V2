// Hebrew-aware document export for the Document card.
// Body is rich HTML produced by the contentEditable editor. Each exporter is
// Hebrew/RTL aware. Heavy libs are dynamically imported so they don't load
// until the user actually exports.

const HEBREW = /[֐-׿]/;
export const isHebrew = (s: string) => HEBREW.test(s || '');

const safeName = (title: string) => (title.trim() || 'untitled').replace(/\s+/g, '_').toLowerCase();

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ---------- TXT ----------
export const exportTxt = (title: string, plainText: string) => {
  downloadBlob(new Blob([`${title}\n\n${plainText}`], { type: 'text/plain;charset=utf-8' }), `${safeName(title)}.txt`);
};

// ---------- shared color / size helpers ----------
const toHex = (color: string): string | undefined => {
  if (!color) return undefined;
  if (color.startsWith('#')) return color.slice(1);
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
  return undefined;
};

// <font size="1..7"> → half-points for docx
const FONT_TAG_PT: Record<string, number> = { '1': 10, '2': 13, '3': 16, '4': 18, '5': 24, '6': 32, '7': 48 };

// ---------- DOCX ----------
interface Fmt { bold?: boolean; italics?: boolean; underline?: boolean; color?: string; sizeHalfPt?: number; }

export const exportDocx = async (title: string, bodyHtml: string) => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  const dom = new DOMParser().parseFromString(`<div id="root">${bodyHtml || ''}</div>`, 'text/html');
  const root = dom.getElementById('root') as HTMLElement;

  const runsFromNode = (node: Node, fmt: Fmt): any[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text) return [];
      return [new TextRun({ text, bold: fmt.bold, italics: fmt.italics, underline: fmt.underline ? {} : undefined, color: fmt.color, size: fmt.sizeHalfPt })];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as HTMLElement;
    const tag = el.tagName;
    const next: Fmt = { ...fmt };
    if (tag === 'B' || tag === 'STRONG') next.bold = true;
    if (tag === 'I' || tag === 'EM') next.italics = true;
    if (tag === 'U') next.underline = true;
    if (tag === 'BR') return [new TextRun({ break: 1 })];
    const style = el.style;
    if (style) {
      const fw = style.fontWeight;
      if (fw === 'bold' || Number(fw) >= 600) next.bold = true;
      if (style.fontStyle === 'italic') next.italics = true;
      if ((style.textDecoration || style.textDecorationLine || '').includes('underline')) next.underline = true;
      if (style.color) next.color = toHex(style.color) || next.color;
      if (style.fontSize && style.fontSize.endsWith('px')) next.sizeHalfPt = Math.round(parseFloat(style.fontSize) * 1.5);
    }
    if (tag === 'FONT') {
      const sz = el.getAttribute('size');
      if (sz && FONT_TAG_PT[sz]) next.sizeHalfPt = FONT_TAG_PT[sz] * 2;
      const c = el.getAttribute('color');
      if (c) next.color = toHex(c) || next.color;
    }
    const out: any[] = [];
    el.childNodes.forEach(child => out.push(...runsFromNode(child, next)));
    return out;
  };

  const alignmentOf = (el: HTMLElement) => {
    const ta = el.style?.textAlign;
    if (ta === 'center') return AlignmentType.CENTER;
    if (ta === 'right') return AlignmentType.RIGHT;
    if (ta === 'justify') return AlignmentType.JUSTIFIED;
    return undefined;
  };

  const paragraphs: any[] = [];

  // Title as Heading 1
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: title || 'Untitled', bold: true, size: 40 })],
    heading: HeadingLevel.HEADING_1,
    bidirectional: isHebrew(title),
    alignment: isHebrew(title) ? AlignmentType.RIGHT : undefined,
  }));

  const pushBlock = (el: HTMLElement, opts: { heading?: any; bullet?: boolean; numberPrefix?: string } = {}) => {
    const runs = runsFromNode(el, {});
    if (opts.numberPrefix) runs.unshift(new TextRun({ text: opts.numberPrefix }));
    const text = el.textContent || '';
    paragraphs.push(new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      heading: opts.heading,
      bullet: opts.bullet ? { level: 0 } : undefined,
      bidirectional: isHebrew(text) || undefined,
      alignment: alignmentOf(el) || (isHebrew(text) ? AlignmentType.RIGHT : undefined),
    }));
  };

  const walk = (parent: Node) => {
    parent.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.textContent || '').trim()) {
          paragraphs.push(new Paragraph({ children: runsFromNode(node, {}), bidirectional: isHebrew(node.textContent || '') || undefined, alignment: isHebrew(node.textContent || '') ? AlignmentType.RIGHT : undefined }));
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      switch (el.tagName) {
        case 'H1': pushBlock(el, { heading: HeadingLevel.HEADING_1 }); break;
        case 'H2': pushBlock(el, { heading: HeadingLevel.HEADING_2 }); break;
        case 'UL': el.querySelectorAll(':scope > li').forEach(li => pushBlock(li as HTMLElement, { bullet: true })); break;
        case 'OL': { let i = 1; el.querySelectorAll(':scope > li').forEach(li => pushBlock(li as HTMLElement, { numberPrefix: `${i++}. ` })); break; }
        case 'P': case 'DIV': pushBlock(el); break;
        case 'BR': paragraphs.push(new Paragraph({ children: [] })); break;
        default: pushBlock(el);
      }
    });
  };
  walk(root);

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(title)}.docx`);
};

// ---------- printable HTML (shared by PDF + Print) ----------
const buildDocHtml = (title: string, bodyHtml: string, forScreen: boolean) => `
  <div dir="auto" style="font-family: Inter, -apple-system, 'Segoe UI', Arial, sans-serif; color:#1C1C1E; ${forScreen ? 'width:794px; padding:64px; box-sizing:border-box; background:#fff;' : 'padding:48px;'}">
    <h1 style="font-size:28px; font-weight:800; margin:0 0 16px;">${escapeHtml(title || 'Untitled')}</h1>
    <div style="font-size:15px; line-height:1.6;">${bodyHtml || ''}</div>
  </div>`;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- PDF (html2canvas → jsPDF) ----------
export const exportPdf = async (title: string, bodyHtml: string) => {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = (html2canvasMod as any).default || html2canvasMod;

  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.innerHTML = buildDocHtml(title, bodyHtml, true);
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(holder.firstElementChild as HTMLElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    const img = canvas.toDataURL('image/png');
    pdf.addImage(img, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`${safeName(title)}.pdf`);
  } finally {
    document.body.removeChild(holder);
  }
};

// ---------- Print (hidden iframe) ----------
export const printDoc = (title: string, bodyHtml: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title || 'Document')}</title>
    <style>
      body { margin:0; }
      ul { list-style: disc; padding-inline-start: 1.5em; }
      ol { list-style: decimal; padding-inline-start: 1.5em; }
    </style></head><body>${buildDocHtml(title, bodyHtml, false)}</body></html>`);
  doc.close();

  const win = iframe.contentWindow!;
  // Give the iframe a tick to lay out before printing.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
};
