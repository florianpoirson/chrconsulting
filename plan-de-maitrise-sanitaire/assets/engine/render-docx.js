// Mise en page Word (.docx) du PMS, à partir des mêmes blocs que le PDF.
// La bibliothèque docx est injectée (navigateur : window.docx ; Node : import 'docx').
import { COLORS, DISCLAIMER } from './render-pdf.js';

const hex = (c) => c.replace('#', '').toUpperCase();
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));
const PT = (n) => Math.round(n * 2);        // taille en demi-points
const TW = (pt) => Math.round(pt * 20);     // points → twips

function dataUrlToBytes(url) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(url || '');
  if (!m) return null;
  const bin = typeof atob === 'function' ? atob(m[2]) : Buffer.from(m[2], 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1].toLowerCase().startsWith('jp') ? 'jpg' : 'png', bytes };
}

function imageSize(img) {
  // Dimensions lues dans l'en-tête PNG/JPEG pour respecter les proportions
  const b = img.bytes;
  if (img.type === 'png') return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return { w: 300, h: 150 };
}

export function buildDocx(D, assembled, data, opts = {}) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType,
    Header, Footer, PageNumber, TableOfContents, HeadingLevel, ImageRun, LevelFormat, TabStopType, VerticalAlign, HeightRule, PageBreak } = D;

  const run = (r, extra = {}) => new TextRun({ text: r.text, bold: r.bold || extra.bold, color: extra.color, size: extra.size, font: extra.font });
  const runsOf = (runs, extra) => runs.map((r) => run(r, extra));
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.brume };
  const borders = { top: border, bottom: border, left: border, right: border };

  const children = [];
  let firstH1 = true;
  let listInstance = 0;

  function table(b) {
    const ncol = b.ncol || 1;
    const fs = b.font || (ncol > 12 ? 6 : ncol > 7 ? 7.5 : 8.5);
    const total = 9638; // largeur utile A4 en twips (marges 2 cm)
    const ws = b.widths && b.widths.length === ncol ? b.widths : Array.from({ length: ncol }, () => 1);
    const sum = ws.reduce((a, x) => a + x, 0);
    const colW = ws.map((w) => Math.floor((w / sum) * total));
    const rows = b.rows.map((row, ri) => {
      let col = 0;
      const cells = row.map((c) => {
        const head = c.head || ri < b.header;
        const w = colW.slice(col, col + c.span).reduce((a, x) => a + x, 0); col += c.span;
        return new TableCell({
          columnSpan: c.span > 1 ? c.span : undefined,
          width: { size: w, type: WidthType.DXA },
          borders,
          verticalAlign: VerticalAlign.CENTER,
          shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: C.marine2 } : c.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: C.ciel } : undefined,
          margins: { top: 40, bottom: 40, left: 70, right: 70 },
          children: [new Paragraph({
            alignment: c.center || (head && b.style !== 'form') ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 0, after: 0, line: 240 },
            children: runsOf(c.runs, { bold: head || c.bold, color: head ? 'FFFFFF' : C.encre, size: PT(fs) }),
          })],
        });
      });
      while (col < ncol) { cells.push(new TableCell({ width: { size: colW[col], type: WidthType.DXA }, borders, children: [new Paragraph('')] })); col++; }
      return new TableRow({ children: cells, tableHeader: ri < b.header, cantSplit: true, height: b.rowHeight ? { value: TW(b.rowHeight), rule: HeightRule.ATLEAST } : undefined });
    });
    return new Table({ rows, width: { size: total, type: WidthType.DXA }, columnWidths: colW });
  }

  function callout(b, plain = false) {
    const alert = b.style === 'alert';
    return new Table({
      width: { size: 9638, type: WidthType.DXA }, columnWidths: [9638],
      rows: [new TableRow({ children: [new TableCell({
        width: { size: 9638, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: alert ? hex(COLORS.rougeBg) : C.ciel },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.SINGLE, size: 24, color: alert ? C.rouge : C.roi } },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [new Paragraph({ alignment: plain ? AlignmentType.LEFT : AlignmentType.CENTER, spacing: { after: 0 }, children: runsOf(b.runs, { bold: plain ? undefined : true, color: alert ? C.rouge : plain ? C.gris : C.marine, size: plain ? PT(8) : undefined }) })],
      })] })],
    });
  }

  const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

  function cover() {
    const e = data.etab || {};
    const out = [];
    out.push(new Paragraph({ spacing: { before: 1200 }, children: [] }));
    const img = dataUrlToBytes(e.logo);
    if (img) {
      const s = imageSize(img); const k = Math.min(220 / s.w, 140 / s.h);
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new ImageRun({ type: img.type, data: img.bytes, transformation: { width: Math.round(s.w * k * 1.333), height: Math.round(s.h * k * 1.333) } })] }));
    } else out.push(new Paragraph({ spacing: { before: 1600 }, children: [] }));
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'PLAN DE MAÎTRISE SANITAIRE', font: 'Jost', size: PT(30), color: C.marine })] }));
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: data.nom, font: 'Jost', size: PT(20), color: C.encre })] }));
    if (e.raison_sociale && e.raison_sociale !== data.nom) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: e.raison_sociale, size: PT(10.5), color: C.gris })] }));
    const lines = [data.adresse_complete, [e.tel, e.email].filter(Boolean).join('  ·  '), e.site, e.siret ? `SIRET ${e.siret}` : ''].filter(Boolean);
    lines.forEach((l, i) => out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: i ? 0 : 240, after: 0 }, children: [new TextRun({ text: l, size: PT(9.5), color: C.gris })] })));
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 1200 }, children: [new TextRun({ text: `Version du ${data.date_version}`, bold: true, size: PT(9.5), color: C.marine })] }));
    out.push(callout({ style: 'info', runs: [{ text: 'Document à adapter et à valider par l’exploitant. ', bold: true }, { text: DISCLAIMER }] }, true));
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: 'Réalisé avec le générateur de PMS ', size: PT(7.5), color: C.gris }), new TextRun({ text: 'CHR Consulting', bold: true, size: PT(7.5), color: C.marine }), new TextRun({ text: ' · chrconsulting.fr', size: PT(7.5), color: C.gris })] }));
    return out;
  }

  const tocEntries = [];
  for (const b of assembled.blocks) {
    if (b.t === 'part') tocEntries.push({ title: b.text, level: 1 });
    else if (b.t === 'h1') tocEntries.push({ title: b.text.toUpperCase(), level: 2 });
    else if (b.t === 'fiche') tocEntries.push({ title: `Fiche n° ${b.num} : ${b.title}`, level: 3 });
  }

  for (const b of assembled.blocks) {
    switch (b.t) {
      case 'cover': break; // section séparée
      case 'toc':
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun('SOMMAIRE')] }));
        children.push(new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-3', cachedEntries: tocEntries }));
        break;
      case 'part': children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 4800 }, children: [new TextRun(b.text)] })); break;
      case 'h1': children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: !firstH1 || true, children: [new TextRun(b.text.toUpperCase())] })); firstH1 = false; break;
      case 'h2': children.push(new Paragraph({ style: 'Titre2CHR', keepNext: true, children: [new TextRun(b.text)] })); break;
      case 'h3': children.push(new Paragraph({ style: 'Titre3CHR', keepNext: true, children: [new TextRun(b.text)] })); break;
      case 'h4': children.push(new Paragraph({ style: 'Titre4CHR', keepNext: true, children: [new TextRun(b.text)] })); break;
      case 'p': children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runsOf(b.runs) })); break;
      case 'field': children.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: runsOf(b.runs) })); break;
      case 'ul': case 'ol': {
        const instance = ++listInstance;
        for (const it of b.items) children.push(new Paragraph({ numbering: { reference: b.t === 'ul' ? 'puces' : 'numeros', level: it.level, instance }, spacing: { after: 40 }, children: runsOf(it.runs) }));
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      }
      case 'callout': children.push(callout(b)); children.push(spacer()); break;
      case 'ref': children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: b.text, bold: true, size: PT(8.5), color: C.roi })] })); break;
      case 'table': children.push(table(b)); children.push(spacer()); break;
      case 'fiche':
        children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0 }, children: [new TextRun({ text: `FICHE N° ${b.num}`, font: 'Jost', size: PT(9), color: C.roi, characterSpacing: 24 })] }));
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.title)] }));
        break;
      case 'pagebreak': children.push(new Paragraph({ children: [new PageBreak()] })); break;
      case 'space': children.push(new Paragraph({ spacing: { after: 160 * b.n }, children: [] })); break;
      case 'sign':
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: [new TextRun({ text: 'NE PAS UTILISER', font: 'Jost', bold: true, size: PT(40), color: C.rouge })] }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: 'PRODUIT NON CONFORME', font: 'Jost', bold: true, size: PT(24), color: C.rouge })] }));
        break;
      default: break;
    }
  }

  const header = new Header({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9638 }],
    children: [new TextRun({ text: data.nom, font: 'Jost', size: PT(8), color: C.marine }), new TextRun({ text: '\tPLAN DE MAÎTRISE SANITAIRE', font: 'Jost', size: PT(8), color: C.azur })],
  })] });
  const footer = new Footer({ children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.brume, space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: 9638 }],
      children: [
        new TextRun({ text: `Plan de Maîtrise Sanitaire – ${data.nom} · version du ${data.date_version}`, size: PT(7), color: C.gris }),
        new TextRun({ children: ['\t', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: PT(7), bold: true, color: C.marine }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: 'CHR Consulting · chrconsulting.fr', size: PT(6), color: C.azur })] }),
  ] });

  const page = { size: { width: 11906, height: 16838 }, margin: { top: 1247, bottom: 1247, left: 1134, right: 1134, header: 560, footer: 560 } };
  const bulletLevels = ['•', '–', '·'].map((t, level) => ({ level, format: LevelFormat.BULLET, text: t, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 300, hanging: 220 } }, run: { color: C.roi, bold: true } } }));
  const numLevels = [0, 1, 2].map((level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 300, hanging: 260 } }, run: { color: C.roi, bold: true } } }));

  const fonts = opts.fonts ? [
    { name: 'Manrope', data: opts.fonts.manrope, bold: opts.fonts.manropeBold },
    { name: 'Jost', data: opts.fonts.jost, bold: opts.fonts.jostBold },
  ] : undefined;

  return new Document({
    creator: 'CHR Consulting – générateur de PMS',
    title: `Plan de Maîtrise Sanitaire – ${data.nom}`,
    features: { updateFields: true },
    fonts,
    numbering: { config: [{ reference: 'puces', levels: bulletLevels }, { reference: 'numeros', levels: numLevels }] },
    styles: {
      default: { document: { run: { font: 'Manrope', size: PT(9.5), color: C.encre }, paragraph: { spacing: { after: 100, line: 300 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Jost', size: PT(26), color: C.marine }, paragraph: { spacing: { after: 200 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Jost', size: PT(18), color: C.marine }, paragraph: { spacing: { after: 240 }, outlineLevel: 1, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.roi, space: 6 } } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Jost', size: PT(16), color: C.marine }, paragraph: { spacing: { after: 200 }, outlineLevel: 2, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.brume, space: 4 } } } },
        { id: 'Titre2CHR', name: 'Titre de section', basedOn: 'Normal', next: 'Normal', run: { font: 'Jost', size: PT(13.5), color: C.roi }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Titre3CHR', name: 'Sous-titre', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: PT(10.5), color: C.marine }, paragraph: { spacing: { before: 180, after: 80 } } },
        { id: 'Titre4CHR', name: 'Intertitre', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: PT(9.5), color: C.marine2 }, paragraph: { spacing: { before: 120, after: 60 } } },
      ],
    },
    sections: [
      { properties: { page }, children: cover() },
      { properties: { page }, headers: { default: header }, footers: { default: footer }, children },
    ],
  });
}
