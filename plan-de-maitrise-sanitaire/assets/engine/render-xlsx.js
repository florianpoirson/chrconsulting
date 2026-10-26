// Relevés de températures (Excel, ExcelJS) : pour chaque enceinte froide, une feuille « semaine » et une feuille « mois »,
// en graphique à remplir à la main (un point par relevé, dans la case de la température lue), au format A4 paysage.
// Modèle de départ : relevé hebdomadaire CHR Consulting (7 jours × 4 relevés, nom et signature par demi-journée,
// anomalies et mesures prises) et relevé mensuel (31 jours, pas de 0,2 °C).
import { LOGO_CHR } from './logo-chr.js';

// Types d'enceintes : plages de températures, consigne, ligne rouge (limite) et zone d'alerte (cases grisées rosées)
export const TYPES = {
  pos: { titre: 'Froid positif', consigne: '0 à +3 °C', alerte: (v) => v > 4, limite: 4, texteLimite: 'au-delà de +4 °C', semaine: [10, -2], mois: [8, 0] },
  fl: { titre: 'Froid positif – fruits et légumes', consigne: '+4 à +8 °C', alerte: (v) => v > 8, limite: 8, texteLimite: 'au-delà de +8 °C', semaine: [12, 0], mois: [10, 2] },
  neg: { titre: 'Froid négatif', consigne: '-18 °C ou moins', alerte: (v) => v > -15, limite: -18, texteLimite: 'au-dessus de -15 °C', semaine: [-10, -24], mois: [-10, -20] },
};
const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
const HEURES = ['8 h', '15 h', '19 h', '23 h'];

const COUL = { marine: 'FF0F2F63', roi: 'FF0042AE', ciel: 'FFEAF0FA', gris: 'FF5B6B84', ligne: 'FFB9C6DC', fin: 'FFD5DEEC', alerte: 'FFFBE3DE', rouge: 'FFC6472F', blanc: 'FFFFFFFF', noir: 'FF12203A' };
const POLICE = 'Arial';
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const bord = (style, argb) => ({ style, color: { argb } });
const fin = bord('thin', COUL.fin);
const fmt = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${String(Math.abs(Math.round(v * 10) / 10)).replace('.', ',')}°`;

// Enceintes à relever (données du questionnaire) ; à défaut, une feuille générique par type
export function enceintesARelever(data) {
  const list = (data.enceintes || []).filter((e) => e.kind === 'pos' || e.kind === 'neg').map((e) => ({
    nom: e.nom, type: e.kind === 'pos' && /fruit|légume/i.test(e.usage || '') ? 'fl' : e.kind, usage: e.usage || '', volume: e.volume || '',
  }));
  if (list.length) return list;
  return [{ nom: 'Enceinte réfrigérée positive', type: 'pos', usage: '', volume: '' }, { nom: 'Enceinte négative (congélateur)', type: 'neg', usage: '', volume: '' }];
}

// Dimensions d'une image PNG ou JPEG encodée en base64 (pour garder ses proportions)
function tailleImage(dataUrl) {
  try {
    const b64 = dataUrl.split(',')[1]; const bin = atob(b64.slice(0, 40000));
    const u = (i) => bin.charCodeAt(i);
    if (dataUrl.startsWith('data:image/png')) return { w: (u(16) << 24) | (u(17) << 16) | (u(18) << 8) | u(19), h: (u(20) << 24) | (u(21) << 16) | (u(22) << 8) | u(23) };
    let i = 2;
    while (i < bin.length) {
      if (u(i) !== 0xff) return null;
      const m = u(i + 1); const len = (u(i + 2) << 8) | u(i + 3);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (u(i + 5) << 8) | u(i + 6), w: (u(i + 7) << 8) | u(i + 8) };
      i += 2 + len;
    }
  } catch { /* image illisible */ }
  return null;
}

// Noms d'onglets courts (31 caractères au plus dans Excel)
const COURTS = [[/^Chambre froide positive/i, 'Chambre froide +'], [/^Chambre froide négative/i, 'Chambre froide -'], [/^Armoire réfrigérée positive/i, 'Armoire +'],
  [/^Armoire ou congélateur négatif/i, 'Congélateur'], [/^Tour ou saladette réfrigérée/i, 'Saladette'], [/^Tour négative/i, 'Tour -'],
  [/^Vitrine réfrigérée/i, 'Vitrine'], [/^Cave à boissons réfrigérée/i, 'Cave à boissons'], [/^Enceinte réfrigérée positive/i, 'Enceinte +'], [/^Enceinte négative.*/i, 'Enceinte -']];
const court = (nom) => COURTS.reduce((s, [re, r]) => s.replace(re, r), nom).replace(/ n° /, ' n°');
function nomFeuille(prefixe, nom, pris) {
  const base = `${prefixe} ${court(nom)}`.replace(/[\\/?*[\]:]/g, '-').replace(/\s+/g, ' ');
  let n = base.slice(0, 31); let k = 2;
  while (pris.has(n.toLowerCase())) { const suf = ` (${k++})`; n = base.slice(0, 31 - suf.length) + suf; }
  pris.add(n.toLowerCase());
  return n;
}

function miseEnPage(ws, data, titre, derniereColonne, derniereLigne) {
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, verticalCentered: true,
    margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.45, header: 0.15, footer: 0.2 },
    printArea: `A1:${derniereColonne}${derniereLigne}`,
  };
  const esc = (s) => String(s).replace(/&/g, '&&');
  ws.headerFooter = { oddFooter: `&L&"Arial"&8${esc(titre)} – Plan de Maîtrise Sanitaire – ${esc(data.nom)}&R&"Arial"&8chrconsulting.fr` };
  ws.views = [{ showGridLines: false }];
}

// Logo CHR Consulting en bas à droite de chaque feuille (une seule image par classeur)
function logoChr(wb, ws, col, ligne, hauteurPx = 34) {
  if (wb._logoChr == null) wb._logoChr = wb.addImage({ base64: LOGO_CHR.dataUrl, extension: 'png' });
  ws.addImage(wb._logoChr, { tl: { col, row: ligne - 1 + 0.12 }, ext: { width: Math.round((hauteurPx * LOGO_CHR.largeur) / LOGO_CHR.hauteur), height: hauteurPx }, editAs: 'oneCell' });
}

function logo(wb, ws, data, colDebut, largeurPx) {
  const src = data.etab?.logo;
  if (!src || !/^data:image\/(png|jpeg);base64,/.test(src)) return;
  const dim = tailleImage(src) || { w: 2, h: 1 };
  const h = 46; const w = Math.min(largeurPx, Math.round((h * dim.w) / Math.max(1, dim.h)));
  const id = wb.addImage({ base64: src, extension: src.startsWith('data:image/png') ? 'png' : 'jpeg' });
  ws.addImage(id, { tl: { col: colDebut, row: 0.15 }, ext: { width: w, height: h }, editAs: 'oneCell' });
}

const cell = (ws, ref, value, style = {}) => { const c = ws.getCell(ref); c.value = value; Object.assign(c, style); return c; };
const police = (size, extra = {}) => ({ name: POLICE, size, color: { argb: COUL.noir }, ...extra });

// ---------- feuille semaine ----------
function feuilleSemaine(wb, data, e, nom) {
  const T = TYPES[e.type];
  const ws = wb.addWorksheet(nom, { properties: { tabColor: { argb: e.type === 'neg' ? 'FF0B7285' : COUL.roi } } });
  const NC = 1 + 28; // colonne A + 7 jours × 4 relevés
  ws.columns = [{ width: 10 }, ...Array.from({ length: 28 }, () => ({ width: 4.3 }))];
  const col = (k) => ws.getColumn(k + 1).letter;   // k = 1..28
  const der = col(28);

  // En-tête
  ws.mergeCells(`A1:${col(21)}1`);
  cell(ws, 'A1', 'CONTRÔLE DES TEMPÉRATURES – RELEVÉ HEBDOMADAIRE', { font: police(15, { bold: true, color: { argb: COUL.marine } }), alignment: { vertical: 'middle' } });
  ws.getRow(1).height = 26;
  ws.mergeCells(`A2:${col(21)}2`);
  cell(ws, 'A2', `${data.nom}`, { font: police(10.5, { bold: true }), alignment: { vertical: 'middle' } });
  ws.mergeCells(`A3:${col(9)}3`); ws.mergeCells(`${col(10)}3:${col(20)}3`); ws.mergeCells(`${col(21)}3:${der}3`);
  cell(ws, 'A3', `Enceinte : ${e.nom}`, { font: police(10, { bold: true, color: { argb: COUL.roi } }), alignment: { vertical: 'middle' } });
  cell(ws, `${col(10)}3`, `Consigne : ${T.consigne}  ·  alerte ${T.texteLimite}`, { font: police(9.5), alignment: { vertical: 'middle' } });
  cell(ws, `${col(21)}3`, 'Semaine du ……… / ……… au ……… / ……… / 20……', { font: police(10, { bold: true }), alignment: { vertical: 'middle', horizontal: 'right' } });
  ws.getRow(2).height = 18; ws.getRow(3).height = 20;
  ws.getRow(4).height = 6;
  logo(wb, ws, data, 22, 200);

  // Jours, demi-journées, nom, signature, heures
  const r0 = 5;
  const entete = { font: police(8.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } };
  ws.mergeCells(`A${r0}:A${r0 + 3}`);
  cell(ws, `A${r0}`, 'Relevé effectué par', { font: police(8, { bold: true, color: { argb: COUL.marine } }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, fill: fill(COUL.ciel) });
  JOURS.forEach((j, d) => {
    const c1 = 1 + d * 4;
    ws.mergeCells(`${col(c1)}${r0}:${col(c1 + 3)}${r0}`);
    cell(ws, `${col(c1)}${r0}`, j, entete);
    [['Matin', c1], ['Après-midi', c1 + 2]].forEach(([lib, c]) => {
      ws.mergeCells(`${col(c)}${r0 + 1}:${col(c + 1)}${r0 + 1}`);
      cell(ws, `${col(c)}${r0 + 1}`, lib, { font: police(7.5, { bold: true, color: { argb: COUL.marine } }), fill: fill(COUL.ciel), alignment: { horizontal: 'center', vertical: 'middle' } });
      ws.mergeCells(`${col(c)}${r0 + 2}:${col(c + 1)}${r0 + 2}`);
      cell(ws, `${col(c)}${r0 + 2}`, 'Nom', { font: police(6.5, { color: { argb: COUL.gris } }), alignment: { horizontal: 'left', vertical: 'top' } });
      ws.mergeCells(`${col(c)}${r0 + 3}:${col(c + 1)}${r0 + 3}`);
      cell(ws, `${col(c)}${r0 + 3}`, 'Signature', { font: police(6.5, { color: { argb: COUL.gris } }), alignment: { horizontal: 'left', vertical: 'top' } });
    });
  });
  ws.getRow(r0).height = 16; ws.getRow(r0 + 1).height = 13; ws.getRow(r0 + 2).height = 24; ws.getRow(r0 + 3).height = 24;
  const rh = r0 + 4;
  cell(ws, `A${rh}`, 'T °C  /  heure', { font: police(7.5, { bold: true, color: { argb: COUL.marine } }), fill: fill(COUL.ciel), alignment: { horizontal: 'center', vertical: 'middle' } });
  for (let k = 1; k <= 28; k++) cell(ws, `${col(k)}${rh}`, HEURES[(k - 1) % 4], { font: police(7, { bold: true, color: { argb: COUL.marine } }), fill: fill(COUL.ciel), alignment: { horizontal: 'center', vertical: 'middle' } });
  ws.getRow(rh).height = 14;

  // Grille des températures (pas de 1 °C)
  const [haut, bas] = T.semaine;
  let r = rh + 1;
  for (let v = haut; v >= bas; v--) {
    const al = T.alerte(v);
    const ligneRouge = v === T.limite;   // trait rouge au-dessus de la valeur limite
    cell(ws, `A${r}`, fmt(v), { font: police(8, { bold: Number.isInteger(v) && v % 5 === 0, color: { argb: al ? COUL.rouge : COUL.noir } }), alignment: { horizontal: 'right', vertical: 'middle', indent: 1 } });
    for (let k = 1; k <= 28; k++) {
      const c = ws.getCell(`${col(k)}${r}`);
      if (al) c.fill = fill(COUL.alerte);
      c.border = { top: ligneRouge ? bord('medium', COUL.rouge) : fin, bottom: fin, left: k % 4 === 1 ? bord('medium', COUL.marine) : k % 2 === 1 ? bord('thin', COUL.ligne) : fin, right: k === 28 ? bord('medium', COUL.marine) : fin };
    }
    ws.getRow(r).height = 15.5;
    r++;
  }
  // Anomalies et mesures prises, par jour
  [['Anomalie', 30], ['Mesures prises', 30], ['Visa du responsable', 20]].forEach(([lib, h]) => {
    cell(ws, `A${r}`, lib, { font: police(7.5, { bold: true, color: { argb: COUL.marine } }), fill: fill(COUL.ciel), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
    JOURS.forEach((_, d) => {
      const c1 = 1 + d * 4;
      ws.mergeCells(`${col(c1)}${r}:${col(c1 + 3)}${r}`);
      ws.getCell(`${col(c1)}${r}`).alignment = { wrapText: true, vertical: 'top' };
    });
    ws.getRow(r).height = h;
    r++;
  });
  // Bordures de l'en-tête et du bas
  for (let rr = r0; rr < r; rr++) {
    for (let k = 0; k <= 28; k++) {
      const ref = k === 0 ? `A${rr}` : `${col(k)}${rr}`;
      if (rr > rh && rr < r - 3 && k > 0) continue;   // grille déjà tracée
      const c = ws.getCell(ref);
      c.border = { top: fin, bottom: fin, left: k === 0 || k % 4 === 1 ? bord('medium', COUL.marine) : bord('thin', COUL.ligne), right: k === 28 ? bord('medium', COUL.marine) : bord('thin', COUL.ligne) };
    }
  }
  for (let rr = rh + 1; rr < r - 3; rr++) ws.getCell(`A${rr}`).border = { left: bord('medium', COUL.marine), top: fin, bottom: fin, right: bord('medium', COUL.marine) };
  r++;
  ws.mergeCells(`A${r}:${col(24)}${r}`);
  cell(ws, `A${r}`, `Mode d’emploi : à chaque relevé, faire un point dans la case de la température lue, puis relier les points. Zone rosée et trait rouge : température anormale (consigne ${T.consigne}) → vérifier la température à cœur des produits, transférer si besoin dans une autre enceinte, noter l’anomalie et la mesure prise, prévenir le responsable. Heures de relevé modifiables (ligne « T °C / heure »).`,
    { font: police(7.5, { color: { argb: COUL.gris } }), alignment: { wrapText: true, vertical: 'top' } });
  ws.getRow(r).height = 30;
  logoChr(wb, ws, 26.6, r);
  miseEnPage(ws, data, `Relevé hebdomadaire des températures – ${e.nom}`, der, r);
  return ws;
}

// ---------- feuille mois ----------
function feuilleMois(wb, data, e, nom) {
  const T = TYPES[e.type];
  const ws = wb.addWorksheet(nom, { properties: { tabColor: { argb: e.type === 'neg' ? 'FF0B7285' : COUL.roi } } });
  ws.columns = [{ width: 8 }, ...Array.from({ length: 31 }, () => ({ width: 3.75 }))];
  const col = (d) => ws.getColumn(d + 1).letter;   // d = 1..31
  const der = col(31);

  ws.mergeCells(`A1:${col(18)}1`);
  cell(ws, 'A1', 'CONTRÔLE DES TEMPÉRATURES – RELEVÉ MENSUEL', { font: police(15, { bold: true, color: { argb: COUL.marine } }), alignment: { vertical: 'middle' } });
  ws.getRow(1).height = 26;
  ws.mergeCells(`A2:${col(18)}2`);
  cell(ws, 'A2', data.nom, { font: police(10.5, { bold: true }), alignment: { vertical: 'middle' } });
  ws.mergeCells(`A3:${col(11)}3`); ws.mergeCells(`${col(12)}3:${col(23)}3`); ws.mergeCells(`${col(24)}3:${der}3`);
  cell(ws, 'A3', `Enceinte : ${e.nom}`, { font: police(10, { bold: true, color: { argb: COUL.roi } }), alignment: { vertical: 'middle' } });
  cell(ws, `${col(12)}3`, `Consigne : ${T.consigne}  ·  alerte ${T.texteLimite}`, { font: police(9.5), alignment: { vertical: 'middle' } });
  cell(ws, `${col(24)}3`, 'Mois : …………………… 20……', { font: police(10, { bold: true }), alignment: { vertical: 'middle', horizontal: 'right' } });
  ws.getRow(2).height = 18; ws.getRow(3).height = 20; ws.getRow(4).height = 6;
  logo(wb, ws, data, 24, 200);

  const r0 = 5;
  cell(ws, `A${r0}`, 'T °C  /  jour', { font: police(7.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } });
  for (let d = 1; d <= 31; d++) cell(ws, `${col(d)}${r0}`, d, { font: police(8, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } });
  ws.getRow(r0).height = 16;

  const [haut, bas] = T.mois;
  const n = Math.round((haut - bas) / 0.2);
  let r = r0 + 1;
  for (let k = 0; k <= n; k++) {
    const v = Math.round((haut - k * 0.2) * 10) / 10;
    const entier = Math.abs(v - Math.round(v)) < 1e-9;
    const al = T.alerte(v);
    const ligneRouge = Math.abs(v - T.limite) < 1e-9;
    cell(ws, `A${r}`, fmt(v), { font: police(entier ? 7.5 : 6, { bold: entier, color: { argb: al ? COUL.rouge : entier ? COUL.noir : COUL.gris } }), alignment: { horizontal: 'right', vertical: 'middle', indent: 1 } });
    for (let d = 1; d <= 31; d++) {
      const c = ws.getCell(`${col(d)}${r}`);
      if (al) c.fill = fill(COUL.alerte);
      c.border = { top: ligneRouge ? bord('medium', COUL.rouge) : entier ? bord('thin', COUL.noir) : fin, bottom: fin, left: d === 1 ? bord('medium', COUL.marine) : fin, right: d === 31 ? bord('medium', COUL.marine) : fin };
    }
    ws.getCell(`A${r}`).border = { top: entier ? bord('thin', COUL.noir) : undefined, left: bord('medium', COUL.marine) };
    ws.getRow(r).height = n > 45 ? 9 : 10.5;
    r++;
  }
  // Visas matin et soir
  [['Visa matin', 'top'], ['Visa soir', 'bottom']].forEach(([lib]) => {
    cell(ws, `A${r}`, lib, { font: police(7, { bold: true, color: { argb: COUL.marine } }), fill: fill(COUL.ciel), alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: bord('thin', COUL.marine), left: bord('medium', COUL.marine), bottom: fin } });
    for (let d = 1; d <= 31; d++) ws.getCell(`${col(d)}${r}`).border = { top: bord('thin', COUL.marine), bottom: fin, left: d === 1 ? bord('medium', COUL.marine) : fin, right: d === 31 ? bord('medium', COUL.marine) : fin };
    ws.getRow(r).height = 16;
    r++;
  });
  // Anomalies
  r++;
  cell(ws, `A${r}`, 'Date', { font: police(7.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } });
  ws.mergeCells(`${col(1)}${r}:${col(25)}${r}`); ws.mergeCells(`${col(26)}${r}:${der}${r}`);
  cell(ws, `${col(1)}${r}`, 'Anomalie constatée et mesure prise', { font: police(7.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } });
  cell(ws, `${col(26)}${r}`, 'Visa', { font: police(7.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { horizontal: 'center', vertical: 'middle' } });
  ws.getRow(r).height = 14; r++;
  for (let k = 0; k < 3; k++) {
    ws.mergeCells(`${col(1)}${r}:${col(25)}${r}`); ws.mergeCells(`${col(26)}${r}:${der}${r}`);
    for (const ref of [`A${r}`, `${col(1)}${r}`, `${col(26)}${r}`]) ws.getCell(ref).border = { top: fin, bottom: fin, left: fin, right: fin };
    ws.getRow(r).height = 17; r++;
  }
  ws.mergeCells(`A${r}:${col(26)}${r}`);
  cell(ws, `A${r}`, `Mode d’emploi : relevé matin et soir, dans la colonne du jour – le matin d’un point, le soir d’une croix, dans la case de la température lue. Zone rosée et trait rouge : température anormale (consigne ${T.consigne}) → mesure corrective notée ci-dessus.`,
    { font: police(7.5, { color: { argb: COUL.gris } }), alignment: { wrapText: true, vertical: 'top' } });
  ws.getRow(r).height = 30;
  logoChr(wb, ws, 29.4, r);
  miseEnPage(ws, data, `Relevé mensuel des températures – ${e.nom}`, der, r);
  return ws;
}

function feuilleSommaire(wb, data, enceintes, feuilles) {
  const ws = wb.addWorksheet('Mode d’emploi', { properties: { tabColor: { argb: COUL.marine } } });
  ws.columns = [{ width: 4 }, { width: 44 }, { width: 22 }, { width: 30 }, { width: 30 }];
  ws.mergeCells('B1:E1');
  cell(ws, 'B1', 'RELEVÉS DE TEMPÉRATURES', { font: police(18, { bold: true, color: { argb: COUL.marine } }) });
  ws.getRow(1).height = 30;
  ws.mergeCells('B2:E2');
  cell(ws, 'B2', `${data.nom} · version du ${data.date_version}`, { font: police(10.5, { color: { argb: COUL.gris } }) });
  logo(wb, ws, data, 4, 160);
  const lignes = [
    'Chaque enceinte froide a deux feuilles : un relevé à la semaine (4 relevés par jour) et un relevé au mois (matin et soir). Choisissez le rythme fixé dans votre Plan de Maîtrise Sanitaire.',
    'Imprimez la feuille (format A4 paysage, déjà réglé), affichez-la près de l’enceinte, puis archivez-la avec votre PMS une fois remplie.',
    'À chaque relevé, faites un point dans la case de la température lue : la courbe montre d’un coup d’œil toute dérive.',
    'Zone rosée et trait rouge : température anormale. Vérifiez la température à cœur des produits, transférez-les si besoin dans une autre enceinte, notez l’anomalie et la mesure prise, prévenez le responsable.',
    'Les noms d’enceintes, les heures de relevé et les consignes restent modifiables dans Excel ou Numbers.',
  ];
  let r = 4;
  lignes.forEach((t, i) => {
    cell(ws, `A${r}`, i + 1, { font: police(11, { bold: true, color: { argb: COUL.roi } }), alignment: { horizontal: 'center', vertical: 'top' } });
    ws.mergeCells(`B${r}:E${r}`);
    cell(ws, `B${r}`, t, { font: police(10), alignment: { wrapText: true, vertical: 'top' } });
    ws.getRow(r).height = 30; r++;
  });
  r++;
  const head = { font: police(9.5, { bold: true, color: { argb: COUL.blanc } }), fill: fill(COUL.marine), alignment: { vertical: 'middle' } };
  ['Enceinte', 'Consigne', 'Feuille semaine', 'Feuille mois'].forEach((h, k) => cell(ws, `${['B', 'C', 'D', 'E'][k]}${r}`, h, head));
  ws.getRow(r).height = 18; r++;
  enceintes.forEach((e, i) => {
    const [s, m] = feuilles[i];
    cell(ws, `B${r}`, e.nom + (e.usage ? ` (${e.usage})` : ''), { font: police(9.5), alignment: { wrapText: true, vertical: 'middle' } });
    cell(ws, `C${r}`, TYPES[e.type].consigne, { font: police(9.5), alignment: { vertical: 'middle' } });
    cell(ws, `D${r}`, { text: s, hyperlink: `#'${s.replace(/'/g, "''")}'!A1` }, { font: police(9.5, { color: { argb: COUL.roi }, underline: true }) });
    cell(ws, `E${r}`, { text: m, hyperlink: `#'${m.replace(/'/g, "''")}'!A1` }, { font: police(9.5, { color: { argb: COUL.roi }, underline: true }) });
    ['B', 'C', 'D', 'E'].forEach((c) => { ws.getCell(`${c}${r}`).border = { bottom: fin }; });
    ws.getRow(r).height = 18; r++;
  });
  r++;
  ws.getRow(r).height = 34;
  logoChr(wb, ws, 4.5, r, 38);
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  ws.views = [{ showGridLines: false }];
}

// ExcelJS : module (Node) ou window.ExcelJS (navigateur)
export function buildReleves(ExcelJS, data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CHR Consulting – générateur de PMS'; wb.company = data.nom; wb.title = `Relevés de températures – ${data.nom}`;
  const enceintes = enceintesARelever(data);
  const pris = new Set(['mode d’emploi']);
  const noms = enceintes.map((e) => [nomFeuille('Sem.', e.nom, pris), nomFeuille('Mois', e.nom, pris)]);
  feuilleSommaire(wb, data, enceintes, noms);
  enceintes.forEach((e, i) => feuilleSemaine(wb, data, e, noms[i][0]));
  enceintes.forEach((e, i) => feuilleMois(wb, data, e, noms[i][1]));
  return wb;
}
