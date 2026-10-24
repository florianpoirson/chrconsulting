// Mise en page PDF (pdfmake) : PMS complet ou recueil de protocoles.
// Identité CHR Consulting : Jost (titres), Manrope (texte), bleu marine / bleu roi.
export const COLORS = {
  marine: '#0F2F63', marine2: '#143A78', roi: '#0042AE', azur: '#7890C0', brume: '#A9BAD6',
  ciel: '#EAF0FA', ciel2: '#F4F8FF', encre: '#12203A', gris: '#5B6B84', rouge: '#C6472F', rougeBg: '#FBECE8',
};
const C = COLORS;

export const PDF_FONTS = {
  Manrope: { normal: 'Manrope-400.ttf', bold: 'Manrope-700.ttf', italics: 'Manrope-400.ttf', bolditalics: 'Manrope-700.ttf' },
  Jost: { normal: 'Jost-500.ttf', bold: 'Jost-600.ttf', italics: 'Jost-400.ttf', bolditalics: 'Jost-600.ttf' },
};

const txt = (runs, extra = {}) => ({ text: runs.map((r) => ({ text: r.text, bold: r.bold || undefined })), ...extra });

function tableNode(b, ctx) {
  const ncol = b.ncol || 1;
  const fs = b.font || (ncol > 12 ? 6 : ncol > 7 ? 7.5 : 8.5);
  const body = b.rows.map((row, ri) => {
    const out = [];
    for (const c of row) {
      const isHead = c.head || ri < b.header;
      const cell = txt(c.runs, {
        fontSize: fs, bold: isHead || c.bold || undefined,
        color: isHead ? '#FFFFFF' : C.encre,
        fillColor: isHead ? C.marine2 : c.fill ? C.ciel : undefined,
        alignment: c.center || (isHead && b.style !== 'form') ? 'center' : 'left',
        margin: [3, b.rowHeight ? Math.max(1, (b.rowHeight - fs * 1.3) / 2) : 2.5, 3, b.rowHeight ? Math.max(1, (b.rowHeight - fs * 1.3) / 2) : 2.5],
      });
      if (c.span > 1) cell.colSpan = c.span;
      out.push(cell);
      for (let k = 1; k < c.span; k++) out.push({});
    }
    while (out.length < ncol) out.push({ text: ' ', fontSize: fs });
    return out;
  });
  let widths;
  if (b.widths && b.widths.length === ncol) { const tot = b.widths.reduce((a, x) => a + x, 0); widths = b.widths.map((w) => `${(w / tot) * 100}%`); }
  else widths = Array.from({ length: ncol }, () => '*');
  return {
    table: { headerRows: b.header || 0, keepWithHeaderRows: b.header ? 1 : 0, dontBreakRows: true, widths, body },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => C.brume, vLineColor: () => C.brume, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [0, 4, 0, 10],
  };
}

function signNode() {
  // Panneau « NE PAS UTILISER – PRODUIT NON CONFORME » (triangle rouge)
  return {
    stack: [
      { canvas: [{ type: 'polyline', lineWidth: 6, closePath: true, lineColor: C.rouge, points: [{ x: 247, y: 0 }, { x: 487, y: 400 }, { x: 7, y: 400 }] }] },
      { text: 'NE PAS\nUTILISER', relativePosition: { x: 0, y: -250 }, alignment: 'center', font: 'Jost', bold: true, fontSize: 30, color: C.rouge },
      { text: 'PRODUIT NON CONFORME', relativePosition: { x: 0, y: -90 }, alignment: 'center', font: 'Jost', bold: true, fontSize: 18, color: C.rouge },
    ],
    margin: [0, 30, 0, 0], unbreakable: true,
  };
}

function blockNodes(blocks, ctx) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'part':
        out.push({ text: b.text, style: 'part', pageBreak: 'before', tocItem: ctx.toc, tocStyle: { bold: true, color: C.marine }, tocMargin: [0, 8, 0, 2] });
        break;
      case 'h1':
        out.push({ text: b.text.toUpperCase(), style: 'h1', pageBreak: ctx.protoMode ? undefined : 'before', tocItem: ctx.toc, tocMargin: [10, 2, 0, 0] });
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 2.5, lineColor: C.roi }], margin: [0, 0, 0, 12] });
        break;
      case 'h2': out.push({ text: b.text, style: 'h2', headlineLevel: 2 }); break;
      case 'h3': out.push({ text: b.text, style: 'h3', headlineLevel: 3 }); break;
      case 'h4': out.push({ text: b.text, style: 'h4' }); break;
      case 'p': out.push(txt(b.runs, { style: 'p' })); break;
      case 'ul': case 'ol': {
        // Listes à niveaux : retrait par niveau
        for (const it of b.items) {
          const bullet = b.t === 'ol' ? `${it.n}.` : (it.level ? '–' : '•');
          out.push({ columns: [{ width: 12 + it.level * 14, text: bullet, alignment: 'right', color: C.roi, fontSize: 9.5, bold: true }, { width: '*', ...txt(it.runs, { style: 'li' }) }], columnGap: 6, margin: [0, 0, 0, 2.5] });
        }
        out.push({ text: '', margin: [0, 0, 0, 4] });
        break;
      }
      case 'callout': {
        const alert = b.style === 'alert';
        out.push({
          table: { widths: ['*'], body: [[txt(b.runs, { bold: true, fontSize: 9.5, color: alert ? C.rouge : C.marine, alignment: 'center', margin: [10, 7, 10, 7] })]] },
          layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => (alert ? C.rouge : C.roi), fillColor: () => (alert ? C.rougeBg : C.ciel) },
          margin: [0, 6, 0, 10], unbreakable: true,
        });
        break;
      }
      case 'ref': out.push({ text: b.text, style: 'ref' }); break;
      case 'table': out.push(tableNode(b, ctx)); break;
      case 'fiche':
        out.push({ text: `FICHE N° ${b.num}`, style: 'ficheNum', pageBreak: 'before' });
        out.push({ text: b.title, style: 'ficheTitle', tocItem: ctx.tocFiches || undefined, tocMargin: [10, 1, 0, 0] });
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.8, lineColor: C.brume }], margin: [0, 2, 0, 10] });
        break;
      case 'fiche-end': case 'proto': case 'proto-end': break;
      case 'pagebreak': out.push({ text: '', pageBreak: 'after' }); break;
      case 'space': out.push({ text: ' ', margin: [0, 0, 0, 8 * b.n] }); break;
      case 'field': out.push(txt(b.runs, { style: 'p', margin: [0, 6, 0, 6] })); break;
      case 'sign': out.push(signNode()); break;
      case 'toc':
        out.push({ text: 'SOMMAIRE', style: 'h1', pageBreak: 'before' });
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 2.5, lineColor: C.roi }], margin: [0, 0, 0, 12] });
        out.push({ toc: { id: ctx.toc, title: { text: '' }, textStyle: { fontSize: 9.5 }, numberStyle: { fontSize: 9.5 } } });
        break;
      case 'cover': out.push(...coverNodes(ctx)); break;
      default: break;
    }
  }
  return out;
}

function coverNodes(ctx) {
  const d = ctx.data; const e = d.etab || {};
  const nodes = [];
  nodes.push({ text: ' ', margin: [0, 40, 0, 0] });
  if (ctx.logo) nodes.push({ image: ctx.logo, fit: [220, 140], alignment: 'center', margin: [0, 0, 0, 30] });
  else nodes.push({ text: ' ', margin: [0, 0, 0, 90] });
  nodes.push({ text: ctx.title, font: 'Jost', fontSize: 28, color: C.marine, alignment: 'center', characterSpacing: 0.6, margin: [0, 10, 0, 6] });
  nodes.push({ canvas: [{ type: 'line', x1: 207, y1: 0, x2: 287, y2: 0, lineWidth: 3, lineColor: C.roi }], margin: [0, 6, 0, 22] });
  nodes.push({ text: d.nom, font: 'Jost', fontSize: 20, color: C.encre, alignment: 'center' });
  if (e.raison_sociale && e.raison_sociale !== d.nom) nodes.push({ text: e.raison_sociale, fontSize: 10.5, color: C.gris, alignment: 'center', margin: [0, 4, 0, 0] });
  const lines = [d.adresse_complete, [e.tel, e.email].filter(Boolean).join('  ·  '), e.site, e.siret ? `SIRET ${e.siret}` : ''].filter(Boolean);
  nodes.push({ text: lines.join('\n'), fontSize: 9.5, color: C.gris, alignment: 'center', lineHeight: 1.4, margin: [0, 14, 0, 0] });
  nodes.push({ text: `Version du ${d.date_version}`, fontSize: 9.5, color: C.marine, bold: true, alignment: 'center', margin: [0, 26, 0, 0] });
  nodes.push({
    absolutePosition: { x: 50, y: 640 },
    table: { widths: [495], body: [[{
      stack: [
        { text: 'Document à adapter et à valider par l’exploitant', bold: true, fontSize: 8.5, color: C.marine, margin: [0, 0, 0, 3] },
        { text: ctx.disclaimer, fontSize: 7.5, color: C.gris, lineHeight: 1.3 },
        { text: [{ text: 'Réalisé avec le générateur de PMS ', color: C.gris }, { text: 'CHR Consulting', bold: true, color: C.marine }, { text: ' · chrconsulting.fr', color: C.gris }], fontSize: 7, margin: [0, 6, 0, 0] },
      ], margin: [10, 8, 10, 8],
    }]] },
    layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => C.roi, fillColor: () => C.ciel2 },
  });
  return nodes;
}

export const DISCLAIMER = 'Ce plan de maîtrise sanitaire a été établi à partir des déclarations de l’exploitant, sans visite des locaux. Il constitue une base de travail conforme à la structure attendue par les services de contrôle : l’exploitant reste responsable de son adaptation aux pratiques réelles de l’établissement, de sa mise en œuvre, de la tenue des enregistrements et de sa mise à jour. CHR Consulting est tenu à une obligation de moyens et ne saurait garantir l’issue d’un contrôle officiel.';

export function buildPdfDefinition(assembled, data, opts = {}) {
  const mode = opts.mode || 'pms';            // 'pms' | 'protocoles'
  const ctx = { data, toc: 'sommaire', tocFiches: 'sommaire', logo: data.etab?.logo || null, title: mode === 'pms' ? 'PLAN DE MAÎTRISE SANITAIRE' : 'PROTOCOLES', disclaimer: DISCLAIMER, protoMode: mode === 'protocoles' };
  let content;
  if (mode === 'pms') content = blockNodes(assembled.blocks, ctx);
  else {
    content = coverNodes(ctx);
    for (const p of opts.protocols) {
      content.push({ text: p.title.toUpperCase(), style: 'h1', pageBreak: 'before', tocItem: ctx.toc });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 2.5, lineColor: C.roi }], margin: [0, 0, 0, 12] });
      const blocks = p.blocks[0] && ['h1', 'h2'].includes(p.blocks[0].t) ? p.blocks.slice(1) : p.blocks;
      content.push(...blockNodes(blocks, { ...ctx, protoMode: true, toc: undefined, tocFiches: undefined }));
    }
  }
  const footLabel = mode === 'pms' ? 'Plan de Maîtrise Sanitaire' : 'Protocoles';
  return {
    pageSize: 'A4', pageMargins: [50, 62, 50, 62],
    info: { title: `${footLabel} – ${data.nom}`, author: data.nom, creator: 'CHR Consulting – générateur de PMS', producer: 'CHR Consulting' },
    defaultStyle: { font: 'Manrope', fontSize: 9.5, color: C.encre, lineHeight: 1.3 },
    header: (page) => (page === 1 ? null : {
      columns: [
        { text: data.nom, font: 'Jost', fontSize: 8, color: C.marine },
        { text: footLabel.toUpperCase(), font: 'Jost', fontSize: 8, color: C.azur, alignment: 'right', characterSpacing: 0.5 },
      ], margin: [50, 28, 50, 0],
    }),
    footer: (page, pages) => (page === 1 ? null : {
      stack: [
        { canvas: [{ type: 'line', x1: 50, y1: 0, x2: 545, y2: 0, lineWidth: 0.5, lineColor: C.brume }] },
        { columns: [
          { text: `${footLabel} – ${data.nom} · version du ${data.date_version}`, fontSize: 7, color: C.gris },
          { text: `${page} / ${pages}`, fontSize: 7, color: C.marine, alignment: 'right', bold: true },
        ], margin: [50, 5, 50, 0] },
        { text: 'CHR Consulting · chrconsulting.fr', fontSize: 6, color: C.azur, margin: [50, 1, 50, 0] },
      ], margin: [0, 18, 0, 0],
    }),
    content,
    styles: {
      part: { font: 'Jost', fontSize: 26, color: C.marine, margin: [0, 250, 0, 0], alignment: 'center' },
      h1: { font: 'Jost', fontSize: 18, color: C.marine, characterSpacing: 0.4, margin: [0, 0, 0, 6] },
      h2: { font: 'Jost', fontSize: 13.5, color: C.roi, margin: [0, 12, 0, 6] },
      h3: { bold: true, fontSize: 10.5, color: C.marine, margin: [0, 9, 0, 4] },
      h4: { bold: true, fontSize: 9.5, color: C.marine2, margin: [0, 6, 0, 3] },
      p: { margin: [0, 0, 0, 6], alignment: 'justify' },
      li: { fontSize: 9.5 },
      ref: { fontSize: 8.5, color: C.roi, bold: true, margin: [0, 2, 0, 8] },
      ficheNum: { font: 'Jost', fontSize: 9, color: C.roi, characterSpacing: 1.2 },
      ficheTitle: { font: 'Jost', fontSize: 16, color: C.marine, margin: [0, 2, 0, 0] },
    },
    pageBreakBefore: (node, q) => !!(node.headlineLevel && q.getFollowingNodesOnPage().length === 0),
  };
}
