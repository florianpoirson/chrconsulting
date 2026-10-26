// Protocoles illustrés (pdfmake) : une affiche A4 par protocole, à imprimer et à afficher en cuisine.
// Chaque affiche reprend le texte du protocole (mêmes conditions, mêmes renvois) avec un bandeau de couleur par thème,
// un pictogramme, les chiffres clés (@chiffre du modèle), des puces illustrées et les étapes numérotées en vignettes.
import { PICTOS } from './pictos.js';
import { COLORS as C, DISCLAIMER, signNode } from './render-pdf.js';

export const THEMES = {
  reception: { nom: 'Réception et stockage', c: '#0042AE', fonce: '#0F2F63', clair: '#E8EFFB' },
  preparation: { nom: 'Préparations', c: '#B4560F', fonce: '#6B3207', clair: '#FBEFE4' },
  temperatures: { nom: 'Températures', c: '#0B7285', fonce: '#07434E', clair: '#E2F3F5' },
  personnel: { nom: 'Hygiène du personnel', c: '#5F3DC4', fonce: '#34206F', clair: '#EFEBFB' },
  nettoyage: { nom: 'Nettoyage et déchets', c: '#2B8A3E', fonce: '#184F23', clair: '#E5F4E8' },
  dangers: { nom: 'Dangers et alertes', c: '#C6472F', fonce: '#7A2414', clair: '#FBECE8' },
};
const ORDRE_THEMES = Object.keys(THEMES);

const W = 527;              // largeur utile (A4, marges de 34 pt)
const H_UTILE = 766;        // hauteur utile (marges haute 30, basse 46)

// ---------- pictogrammes ----------
const inner = (n) => PICTOS[n] || PICTOS['circle-check'];
const picto = (n, color, size) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner(n)}</svg>`,
  width: size, height: size,
});
// Pictogramme sur pastille (carré arrondi ou rond)
const pastille = (n, fg, bg, size, rond = false) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">${rond ? `<circle cx="20" cy="20" r="20" fill="${bg}"/>` : `<rect width="40" height="40" rx="10" fill="${bg}"/>`}<g transform="translate(9 9) scale(0.9167)" fill="none" stroke="${fg}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${inner(n)}</g></svg>`,
  width: size, height: size,
});

// ---------- pictogramme d'une puce selon son texte ----------
const INTERDIT = /\b(ne (?:pas|jamais|rien)|jamais|interdit|interdite|aucun(?:e)?\b|pas de\b)/i;
const REGLES = [
  [/savon|lave-mains/i, 'soap-dispenser-droplet'],
  [/\bmains?\b|ongles/i, 'hand'],
  [/gants?\b/i, 'hand'],
  [/bijoux|montre/i, 'watch'],
  [/t[ée]l[ée]phone/i, 'smartphone'],
  [/fumer|vapoter/i, 'cigarette-off'],
  [/tousser|[ée]ternu|masque|rhino/i, 'wind'],
  [/go[uû]ter|cuill[eè]re/i, 'utensils'],
  [/allerg/i, 'wheat'],
  [/m[ée]decin|malad|sant[ée]|plaie|l[ée]sion|pansement/i, 'stethoscope'],
  [/tenue|blouse|tablier|charlotte|v[êe]tement|linge|kit visiteur/i, 'shirt'],
  [/form(?:er|ation)/i, 'graduation-cap'],
  [/client|consommateur|inform/i, 'message-square'],
  [/fournisseur|livr|livreur|transport|collecte/i, 'truck'],
  [/huile|friture|friteuse/i, 'flame'],
  [/viande|steak|hach|muscle|tartare|volaille/i, 'beef'],
  [/l[ée]gume|fruit|v[ée]g[ée]ta/i, 'carrot'],
  [/couteau|tranch|d[ée]coup|planche|trancheuse/i, 'slice'],
  [/d[ée]chet|poubelle|conteneur|[ée]vacu|biod[ée]chet|tri\b/i, 'trash-2'],
  [/nettoy|d[ée]sinfect|lavette|lingette|d[ée]tergent|javel/i, 'spray-can'],
  [/[ée]tiquet/i, 'tag'],
  [/\bDLC\b|\bDDM\b|date|dur[ée]e de (?:vie|conservation)|\bjours?\b|\bJ\+\d/i, 'calendar-clock'],
  [/sonde|thermom[eè]tre|temp[ée]rature|°C/i, 'thermometer'],
  [/cuisson|cuire|chaud|four|r[ée]chauff/i, 'flame'],
  [/cong[ée]l|surgel/i, 'snowflake'],
  [/froid|r[ée]frig[ée]r|enceinte|cellule|chambre/i, 'refrigerator'],
  [/rinc|eau\b|tremp|mouill|laver|lavage/i, 'droplets'],
  [/couvr|film|herm[ée]tique|couvercle|prot[ée]g|emballage|sachet|conditionn/i, 'package'],
  [/stock|rang|[ée]tag[eè]re|bac\b|bacs\b/i, 'archive'],
  [/heure|minute|imm[ée]diat|rapidement|dernier moment|d[eè]s\b|aussit[ôo]t|d[ée]lai/i, 'timer'],
  [/enregistr|not(?:er|é)|consign|fiche|archiv|registre/i, 'clipboard-list'],
  [/v[ée]rifi|contr[ôo]l|s['’]assurer|visuel/i, 'eye'],
  [/porte|acc[eè]s|local/i, 'door-closed'],
  [/verre|bris|corps [ée]tranger/i, 'glass-water'],
];
export function pictoPour(text) {
  if (INTERDIT.test(text)) return { picto: 'ban', interdit: true };
  for (const [re, p] of REGLES) if (re.test(text)) return { picto: p, interdit: false };
  return { picto: 'circle-check', interdit: false };
}

// ---------- texte ----------
const plain = (runs) => runs.map((r) => r.text).join('');
const txt = (runs, extra = {}) => ({ text: runs.map((r) => ({ text: r.text, bold: r.bold || undefined })), ...extra });

// Estimation de la hauteur d'un texte (largeur moyenne d'un caractère ≈ 0,5 em pour Manrope)
const lignes = (s, fs, width) => Math.max(1, Math.ceil((String(s).length * fs * 0.5) / Math.max(40, width)));

function estimer(blocks, fs) {
  const lh = fs * 1.38; let h = 0;
  for (const b of blocks) {
    switch (b.t) {
      case 'h1': case 'h2': case 'h3': case 'h4': h += fs * 1.6 + 14; break;
      case 'p': case 'field': h += lignes(plain(b.runs), fs, W) * lh + 7; break;
      case 'ul': {
        const { deuxCol, items } = disposeListe(b);
        if (deuxCol) { const half = Math.ceil(items.length / 2); for (let k = 0; k < half; k++) h += Math.max(fs * 2, Math.max(lignes(plain(items[k].runs), fs, W / 2 - 40), lignes(plain(items[k + half]?.runs || []), fs, W / 2 - 40)) * lh) + 5; }
        else for (const it of items) h += it.level ? lignes(plain(it.runs), fs * 0.94, W - 70) * lh + 2 : Math.max(fs * 2, lignes(plain(it.runs), fs, W - 34) * lh) + 5;
        h += 6; break;
      }
      case 'ol': {
        const cols = colonnesEtapes(b.items);
        for (let k = 0; k < b.items.length; k += cols) {
          const row = b.items.slice(k, k + cols);
          h += Math.max(...row.map((it) => lignes(plain(it.runs), fs, W / cols - 26) * lh)) + fs * 2.2 + 26;
        }
        h += 6; break;
      }
      case 'callout': h += lignes(plain(b.runs), fs, W - 60) * lh + 24; break;
      case 'table': {
        const fsT = taillePoliceTableau(b, fs); const lhT = fsT * 1.35;
        const ws = largeursColonnes(b);
        for (const row of b.rows) {
          let k = 0; let m = 1;
          for (const c of row) { const w = ws.slice(k, k + (c.span || 1)).reduce((a, x) => a + x, 0); m = Math.max(m, lignes(plain(c.runs), fsT, w - 8)); k += c.span || 1; }
          h += Math.max(m * lhT + 7, b.rowHeight ? b.rowHeight * 0.8 : 0);
        }
        h += 12; break;
      }
      case 'ref': h += 26; break;
      case 'sign': h += 430; break;
      case 'space': h += 8 * b.n; break;
      default: break;
    }
  }
  return h;
}

function disposeListe(b) {
  const items = b.items;
  const top = items.filter((it) => !it.level);
  const nested = items.some((it) => it.level);
  const moy = top.reduce((a, it) => a + plain(it.runs).length, 0) / Math.max(1, top.length);
  return { items, deuxCol: !nested && top.length >= 6 && moy < 85 };
}
const colonnesEtapes = (items) => {
  const moy = items.reduce((a, it) => a + plain(it.runs).length, 0) / Math.max(1, items.length);
  if (items.length <= 3) return items.length;
  if (items.length === 4) return moy < 70 ? 4 : 2;
  return moy < 120 ? 3 : 2;
};
function largeursColonnes(b) {
  const n = b.ncol || 1;
  if (b.widths && b.widths.length === n) { const t = b.widths.reduce((a, x) => a + x, 0); return b.widths.map((x) => (x / t) * W); }
  return Array.from({ length: n }, () => W / n);
}
const taillePoliceTableau = (b, fs) => Math.max(6.5, Math.min(fs - 1, b.font ? b.font + (fs - 9) * 0.8 : fs - 1, b.ncol > 4 ? fs - 2 : 99));

// ---------- éléments de l'affiche ----------
function bandeau(titre, meta, num, th) {
  const h = 92;
  return [
    { canvas: [{ type: 'rect', x: 0, y: 0, w: W, h, r: 14, color: th.c }], pageBreak: 'before' },
    {
      columns: [
        { ...pastille(meta.picto, th.c, '#FFFFFF', 62, true), width: 62 },
        { width: '*', stack: [
          { text: `${th.nom.toUpperCase()}  ·  PROTOCOLE N° ${num}`, font: 'Jost', fontSize: 8.5, color: '#FFFFFF', characterSpacing: 1.4, opacity: 0.85, margin: [0, 0, 0, 3] },
          { text: titre, font: 'Jost', fontSize: titre.length > 42 ? 18 : 22, color: '#FFFFFF', lineHeight: 1.05 },
        ] },
      ],
      columnGap: 16, margin: [16, -h + 15, 16, 0], id: `bandeau-${num}`,
    },
    { text: '', margin: [0, 0, 0, Math.max(0, h - 15 - 62) + 14] },
  ];
}

function chiffresCles(chiffres, th) {
  if (!chiffres.length) return [];
  const n = chiffres.length; const gap = 10; const w = Math.min((W - gap * (n - 1)) / n, 250); const h = 62;
  return [
    { columns: chiffres.map((c) => ({
      width: w,
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w, h, r: 10, color: th.clair }] },
        { columns: [
          { ...pastille(c.picto, '#FFFFFF', c.picto === 'ban' ? C.rouge : th.c, 30, true), width: 30, margin: [0, 2, 0, 0] },
          { width: '*', stack: [
            { text: c.big, font: 'Jost', bold: true, fontSize: c.big.length > 13 ? 13 : c.big.length > 9 ? 15.5 : 18, color: c.picto === 'ban' ? C.rouge : th.fonce, lineHeight: 1 },
            { text: c.small, fontSize: 7.6, color: C.gris, lineHeight: 1.15, margin: [0, 2, 0, 0] },
          ] },
        ], columnGap: 9, margin: [11, -h + 12, 9, 0] },
        { text: '', margin: [0, 0, 0, 12] },
      ],
    })), columnGap: gap, margin: [0, 0, 0, 14] },
  ];
}

function titreSection(text, th, fs) {
  return {
    columns: [
      { canvas: [{ type: 'rect', x: 0, y: 1, w: 4, h: fs * 1.45, r: 2, color: th.c }], width: 4 },
      { text, font: 'Jost', fontSize: fs * 1.3, color: th.fonce, width: '*' },
    ],
    columnGap: 8, margin: [0, 8, 0, 6],
  };
}

function puce(it, th, fs, width) {
  const { picto: p, interdit } = pictoPour(plain(it.runs));
  const size = Math.round(fs * 2);
  return {
    columns: [
      { ...pastille(p, interdit ? C.rouge : th.c, interdit ? C.rougeBg : th.clair, size), width: size },
      { width: '*', ...txt(it.runs, { fontSize: fs, color: C.encre, margin: [0, Math.max(0, (size - fs * 1.38) / 2 - 1), 0, 0] }) },
    ],
    columnGap: 8, margin: [0, 0, 0, 5], width,
  };
}

function liste(b, th, fs) {
  const { deuxCol, items } = disposeListe(b);
  if (deuxCol) {
    const half = Math.ceil(items.length / 2);
    return [{ columns: [
      { width: '*', stack: items.slice(0, half).map((it) => puce(it, th, fs)) },
      { width: '*', stack: items.slice(half).map((it) => puce(it, th, fs)) },
    ], columnGap: 16, margin: [0, 2, 0, 6] }];
  }
  const out = [];
  for (const it of items) {
    if (!it.level) out.push(puce(it, th, fs));
    else out.push({ columns: [{ width: 8, canvas: [{ type: 'ellipse', x: 3, y: fs * 0.72, r1: 2, r2: 2, color: th.c }] }, { width: '*', ...txt(it.runs, { fontSize: fs * 0.94, color: C.encre }) }], columnGap: 6, margin: [Math.round(fs * 2) + 8, -2, 0, 4] });
  }
  out.push({ text: '', margin: [0, 0, 0, 6] });
  return out;
}

function etapes(b, th, fs) {
  const cols = colonnesEtapes(b.items);
  const rows = [];
  for (let k = 0; k < b.items.length; k += cols) {
    const row = b.items.slice(k, k + cols).map((it) => {
      const { picto: p, interdit } = pictoPour(plain(it.runs));
      return {
        stack: [
          { columns: [
            { text: String(it.n), font: 'Jost', bold: true, fontSize: fs * 2.1, color: th.c, width: 'auto', lineHeight: 1 },
            { width: '*', text: '' },
            { ...picto(p, interdit ? C.rouge : th.c, Math.round(fs * 2)), width: Math.round(fs * 2) },
          ], margin: [0, 0, 0, 4] },
          txt(it.runs, { fontSize: fs, color: C.encre }),
        ],
        fillColor: th.clair, margin: [10, 9, 10, 10],
      };
    });
    while (row.length < cols) row.push({ text: '' });
    rows.push(row);
  }
  return [{
    table: { widths: Array.from({ length: cols }, () => '*'), body: rows, dontBreakRows: true },
    layout: { hLineWidth: () => 6, vLineWidth: () => 6, hLineColor: () => '#FFFFFF', vLineColor: () => '#FFFFFF', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [-6, -4, -6, 6],
  }];
}

function encadre(b, th, fs) {
  const alerte = b.style === 'alert';
  const fg = alerte ? C.rouge : th.fonce; const bg = alerte ? C.rougeBg : th.clair;
  return [{
    table: { widths: [Math.round(fs * 2.4), '*'], body: [[
      { ...picto(alerte ? 'triangle-alert' : 'info', alerte ? C.rouge : th.c, Math.round(fs * 2.2)), margin: [10, 7, 0, 7] },
      txt(b.runs, { bold: true, fontSize: fs * 0.95, color: fg, margin: [8, 8, 12, 8] }),
    ]] },
    layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 4 : 0), vLineColor: () => (alerte ? C.rouge : th.c), fillColor: () => bg, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [0, 4, 0, 10], unbreakable: true,
  }];
}

function tableau(b, th, fs) {
  const fsT = taillePoliceTableau(b, fs);
  const ncol = b.ncol || 1;
  const body = b.rows.map((row, ri) => {
    const out = [];
    for (const c of row) {
      const tete = c.head || ri < b.header;
      const cell = txt(c.runs, {
        fontSize: fsT, bold: tete || c.bold || undefined, color: tete ? '#FFFFFF' : C.encre,
        fillColor: tete ? th.c : c.fill ? th.clair : ri % 2 ? '#FFFFFF' : '#F7F9FC',
        alignment: c.center || (tete && b.style !== 'form') ? 'center' : 'left',
        margin: [5, b.rowHeight ? Math.max(3, (b.rowHeight * 0.8 - fsT * 1.35) / 2) : 4, 5, b.rowHeight ? Math.max(3, (b.rowHeight * 0.8 - fsT * 1.35) / 2) : 4],
      });
      if (c.span > 1) cell.colSpan = c.span;
      out.push(cell);
      for (let k = 1; k < (c.span || 1); k++) out.push({});
    }
    while (out.length < ncol) out.push({ text: ' ', fontSize: fsT });
    return out;
  });
  const widths = largeursColonnes(b).map((w) => `${(w / W) * 100}%`);
  return [{
    table: { headerRows: b.header || 0, keepWithHeaderRows: b.header ? 1 : 0, dontBreakRows: true, widths, body },
    layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#D5DEEC', vLineColor: () => '#D5DEEC', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [0, 2, 0, 12],
  }];
}

function renvoi(b, th, fs) {
  return [{
    columns: [
      { ...picto('clipboard-list', th.c, Math.round(fs * 1.7)), width: Math.round(fs * 1.7) },
      { width: '*', text: [{ text: 'À consigner : ', color: C.gris }, { text: b.text.replace(/^Voir /, ''), bold: true, color: th.fonce }], fontSize: fs * 0.9, margin: [0, 1, 0, 0] },
    ],
    columnGap: 7, margin: [0, 2, 0, 8],
  }];
}

function corps(blocks, th, fs) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h1': case 'h2': case 'h3': case 'h4': out.push(titreSection(b.text, th, fs)); break;
      case 'p': case 'field': out.push(txt(b.runs, { fontSize: fs, color: C.encre, margin: [0, 0, 0, 7] })); break;
      case 'ul': out.push(...liste(b, th, fs)); break;
      case 'ol': out.push(...etapes(b, th, fs)); break;
      case 'callout': out.push(...encadre(b, th, fs)); break;
      case 'table': out.push(...tableau(b, th, fs)); break;
      case 'ref': out.push(...renvoi(b, th, fs)); break;
      case 'sign': out.push(signNode()); break;
      case 'space': out.push({ text: ' ', margin: [0, 0, 0, 8 * b.n] }); break;
      default: break;
    }
  }
  return out;
}

// Une affiche : bandeau, chiffres clés, contenu ; taille du texte ajustée pour tenir sur une page si possible
export const TAILLES = [14, 13, 12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5];
export function affiche(p, num, taille) {
  const meta = p.blocks.find((b) => b.t === 'affiche') || { picto: 'clipboard-list', theme: 'reception' };
  const th = THEMES[meta.theme] || THEMES.reception;
  const chiffres = p.blocks.filter((b) => b.t === 'chiffre');
  let blocks = p.blocks.filter((b) => b.t !== 'affiche' && b.t !== 'chiffre');
  let titre = p.title;
  if (blocks[0] && ['h1', 'h2'].includes(blocks[0].t)) { titre = blocks[0].text; blocks = blocks.slice(1); }
  const dispo = H_UTILE - 106 - (chiffres.length ? 76 : 0);
  const fs = taille || TAILLES.find((t) => estimer(blocks, t) <= dispo) || TAILLES[TAILLES.length - 1];
  // Repères de mise en page : le contenu forme un bloc (pages occupées), son dernier élément situe la fin
  const contenu = [...chiffresCles(chiffres, th), ...corps(blocks, th, fs)];
  while (contenu.length && contenu[contenu.length - 1].text === '' && !contenu[contenu.length - 1].canvas) contenu.pop();
  const dernier = contenu[contenu.length - 1];
  if (dernier) {
    if (!dernier.id) dernier.id = `fin-${num}`;
    // Pas de marge sous le dernier élément : une affiche qui finit au ras du bas ne crée pas de page blanche
    if (Array.isArray(dernier.margin)) dernier.margin = [dernier.margin[0], dernier.margin[1], dernier.margin[2], 0];
    else dernier.margin = [0, 0, 0, 0];
  }
  return { nodes: [...bandeau(titre, meta, num, th), { stack: contenu, id: `affiche-${num}` }], theme: meta.theme, picto: meta.picto, titre, fs };
}

function couverture(data, entrees) {
  const e = data.etab || {};
  const h = 150;
  const nodes = [
    { canvas: [{ type: 'rect', x: 0, y: 0, w: W, h, r: 16, color: C.marine }] },
    { columns: [
      { width: '*', stack: [
        { text: 'PROTOCOLES ILLUSTRÉS', font: 'Jost', fontSize: 26, color: '#FFFFFF', characterSpacing: 0.8 },
        { text: 'Affiches à imprimer et à afficher en cuisine', fontSize: 10, color: C.brume, margin: [0, 0, 0, 10] },
        { text: data.nom, font: 'Jost', fontSize: 17, color: '#FFFFFF', lineHeight: 1.1 },
        { text: [data.adresse_complete, `Version du ${data.date_version}`].filter(Boolean).join('  ·  '), fontSize: 8, color: C.brume, lineHeight: 1.2, margin: [0, 2, 0, 0] },
      ] },
      data.etab?.logo ? { width: 92, stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 92, h: 92, r: 12, color: '#FFFFFF' }] },
        { image: data.etab.logo, fit: [76, 76], alignment: 'center', margin: [0, -84, 0, 0] },
      ] } : { width: 0, text: '' },
    ], columnGap: 16, margin: [24, -h + 22, 24, 0] },
    { text: '', margin: [0, 0, 0, 30] },
  ];
  // Index visuel par thème
  for (const t of ORDRE_THEMES) {
    const list = entrees.filter((x) => x.theme === t);
    if (!list.length) continue;
    const th = THEMES[t];
    nodes.push({ columns: [
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 10, h: 10, r: 3, color: th.c }], width: 10, margin: [0, 2.5, 0, 0] },
      { text: th.nom.toUpperCase(), font: 'Jost', fontSize: 9.5, color: th.fonce, characterSpacing: 1.2, width: '*' },
    ], columnGap: 7, margin: [0, 5, 0, 4] });
    const rows = [];
    for (let k = 0; k < list.length; k += 3) {
      const row = list.slice(k, k + 3).map((x) => ({ columns: [
        { ...pastille(x.picto, th.c, th.clair, 14), width: 14 },
        { width: '*', text: [{ text: `${x.num}  `, bold: true, color: th.c }, { text: x.titre, color: C.encre }], fontSize: 7.2, lineHeight: 1.1, margin: [0, 1.5, 0, 0] },
      ], columnGap: 5, margin: [0, 0, 6, 1] }));
      while (row.length < 3) row.push({ text: '' });
      rows.push(row);
    }
    nodes.push({ table: { widths: ['*', '*', '*'], body: rows }, layout: { defaultBorder: false, paddingTop: () => 1, paddingBottom: () => 1, paddingLeft: () => 0, paddingRight: () => 0 }, margin: [0, 0, 0, 2] });
  }
  nodes.push({
    table: { widths: [W], body: [[{ stack: [
      { text: 'Document à adapter et à valider par l’exploitant', bold: true, fontSize: 8, color: C.marine, margin: [0, 0, 0, 2] },
      { text: DISCLAIMER, fontSize: 7, color: C.gris, lineHeight: 1.25 },
    ], margin: [10, 7, 10, 7] }]] },
    layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => C.roi, fillColor: () => C.ciel2 },
    margin: [0, 12, 0, 0], unbreakable: true,
  });
  return nodes;
}

// opts.tailles : taille de texte imposée par affiche (sinon estimée) ; opts.positions : Map rempli pendant la mise en page
export function buildAffichesDefinition(protos, data, opts = {}) {
  const affiches = protos.map((p, i) => affiche(p, i + 1, opts.tailles?.[i]));
  const entrees = affiches.map((a, i) => ({ num: i + 1, titre: protos[i].title, theme: a.theme, picto: a.picto }));
  const content = [...couverture(data, entrees), ...affiches.flatMap((a) => a.nodes)];
  return {
    pageSize: 'A4', pageMargins: [34, 30, 34, 46],
    info: { title: `Protocoles illustrés – ${data.nom}`, author: data.nom, creator: 'CHR Consulting – générateur de PMS', producer: 'CHR Consulting' },
    defaultStyle: { font: 'Manrope', fontSize: 10, color: C.encre, lineHeight: 1.3 },
    footer: (page, pages) => { if (opts.positions) opts.positions.set('pages', pages); return {
      columns: [
        { text: [{ text: data.nom, bold: true, color: C.marine }, { text: `  ·  Protocoles illustrés  ·  version du ${data.date_version}`, color: C.gris }], fontSize: 7 },
        { text: [{ text: 'CHR Consulting · chrconsulting.fr     ', color: C.azur }, { text: `${page} / ${pages}`, bold: true, color: C.marine }], fontSize: 7, alignment: 'right' },
      ], margin: [34, 18, 34, 0],
    }; },
    content,
    pageBreakBefore: (node) => {
      if (opts.positions && node.id && node.startPosition) opts.positions.set(node.id, { page: node.startPosition.pageNumber, top: node.startPosition.top, pages: node.pageNumbers || [node.startPosition.pageNumber] });
      return false;
    },
    _tailles: affiches.map((a) => a.fs),
  };
}

// Mise en page vérifiée : on fabrique le PDF, on relève où se termine chaque affiche, puis on ajuste la taille du texte
// de chaque affiche (la surface du texte varie comme le carré de la taille) : réduite si elle déborde sur la page suivante,
// agrandie si elle laisse beaucoup de place. La dernière fabrication n'utilise que des tailles qui ont tenu.
// generer(definition) → Promise du fichier (Blob ou Buffer).
const BAS = 842 - 46;          // bas de la zone utile (A4, marge basse 46)
const PLEINE = BAS - 30;       // hauteur utile d'une page
const cran = (cible) => TAILLES.find((t) => t <= cible) ?? TAILLES[TAILLES.length - 1];
export async function fabriquerAffiches(protos, data, generer, maxPasses = 5) {
  const tient = new Map();      // affiche → plus grande taille qui tient sur une page
  const deborde = new Map();    // affiche → plus petite taille qui déborde
  const deuxPages = new Set();  // affiches trop longues pour une page : texte confortable sur deux pages
  let tailles = null; let fichier = null;
  for (let passe = 0; passe < maxPasses; passe++) {
    const positions = new Map();
    const def = buildAffichesDefinition(protos, data, { tailles, positions });
    fichier = await generer(def);
    const actuelles = def._tailles;
    const suivantes = actuelles.slice();
    let change = false;
    const derniere = passe >= maxPasses - 2;
    protos.forEach((p, i) => {
      const a = positions.get(`affiche-${i + 1}`); const f = positions.get(`fin-${i + 1}`);
      const b = positions.get(`bandeau-${i + 1}`); const suivant = positions.get(`bandeau-${i + 2}`);
      if (!a || !f || !b || deuxPages.has(i)) return;
      const t = actuelles[i];
      // Pages en plus de la première : d'après le début de l'affiche suivante (ou le nombre total de pages)
      const pages = (suivant ? suivant.page - 1 : positions.get('pages')) - b.page;
      const utilise = (f.page - a.page) * PLEINE + f.top - a.top + 30;  // le dernier élément mesure environ 30 pt
      const dispo = BAS - a.top;
      const ideal = t * Math.sqrt(dispo / Math.max(1, Math.max(utilise, pages ? dispo * 1.05 : 0))) * 0.97;
      let n = t;
      if (pages > 0) {
        deborde.set(i, Math.min(deborde.get(i) ?? Infinity, t));
        if (t === TAILLES[TAILLES.length - 1] || utilise > dispo * 1.6) { deuxPages.add(i); n = 9.5; }
        else n = tient.has(i) ? tient.get(i) : Math.min(cran(ideal), TAILLES[Math.min(TAILLES.indexOf(t) + 1, TAILLES.length - 1)]);
      } else {
        tient.set(i, Math.max(tient.get(i) ?? 0, t));
        if (!derniere && utilise < dispo * 0.85) { const g = cran(ideal); if (g > t && g < (deborde.get(i) ?? Infinity)) n = g; }
      }
      if (n !== t) { suivantes[i] = n; change = true; }
    });
    if (!change) return fichier;
    tailles = suivantes;
    if (passe === maxPasses - 2) tailles = tailles.map((t, i) => (tient.has(i) && t > tient.get(i) ? tient.get(i) : t));
  }
  return fichier;
}
