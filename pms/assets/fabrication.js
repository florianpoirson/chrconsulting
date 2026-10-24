// Fabrication des trois documents dans le navigateur, à partir des réponses et du modèle.
// Utilisé par la page de téléchargement (après paiement) et par la version d'essai.
import { assemble, protocols } from './engine/assemble.js';
import { derive } from './engine/derive.js';
import { buildPdfDefinition, PDF_FONTS } from './engine/render-pdf.js';
import { buildDocx } from './engine/render-docx.js';

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.dataset.src = src;
    s.onload = res; s.onerror = () => rej(new Error('Chargement impossible des outils de mise en page. Vérifiez votre connexion et réessayez.'));
    document.head.appendChild(s);
  });
}
const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
export const slug = (s) => String(s || 'etablissement').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

let ready = null;
async function outils(cfg) {
  if (ready) return ready;
  ready = (async () => {
    const V = cfg.vendor || '/pms/assets/vendor';
    await Promise.all([loadScript(cfg.pdfmakeUrl || `${V}/pdfmake-0.3.11.min.js`), loadScript(cfg.docxUrl || `${V}/docx-9.8.0.min.js`)]);
    const files = ['Manrope-400.ttf', 'Manrope-700.ttf', 'Jost-400.ttf', 'Jost-500.ttf', 'Jost-600.ttf'];
    const fonts = Object.fromEntries(await Promise.all(files.map(async (f) => {
      const r = await fetch(`${cfg.fonts || `${V}/fonts`}/${f}`); if (!r.ok) throw new Error('Polices introuvables.');
      return [f, await r.arrayBuffer()];
    })));
    window.pdfMake.addVirtualFileSystem(Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, b64(v)])));
    window.pdfMake.setFonts(PDF_FONTS);
    return fonts;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

// → { fichiers: [{ name, blob, label, fmt, desc }], fiches, nom }
export async function fabriquer({ reponses, modele, date, cfg = {} }) {
  const fonts = await outils(cfg);
  const data = derive(reponses, date || new Date());
  const asm = assemble(modele, data);
  const base = slug(data.nom);
  const fichiers = [];
  fichiers.push({ name: `PMS-${base}.pdf`, blob: await window.pdfMake.createPdf(buildPdfDefinition(asm, data)).getBlob(), label: 'Plan de Maîtrise Sanitaire', fmt: 'PDF', desc: 'Version à imprimer et à présenter en cas de contrôle.' });
  const docx = window.docx;
  const doc = buildDocx(docx, asm, data, { fonts: { manrope: new Uint8Array(fonts['Manrope-400.ttf']), manropeBold: new Uint8Array(fonts['Manrope-700.ttf']), jost: new Uint8Array(fonts['Jost-500.ttf']), jostBold: new Uint8Array(fonts['Jost-600.ttf']) } });
  fichiers.push({ name: `PMS-${base}.docx`, blob: await docx.Packer.toBlob(doc), label: 'Plan de Maîtrise Sanitaire', fmt: 'Word', desc: 'Version modifiable, pour faire évoluer votre PMS.' });
  fichiers.push({ name: `Protocoles-${base}.pdf`, blob: await window.pdfMake.createPdf(buildPdfDefinition(asm, data, { mode: 'protocoles', protocols: protocols(asm) })).getBlob(), label: 'Protocoles', fmt: 'PDF', desc: 'Les procédures à afficher dans la cuisine.' });
  return { fichiers, fiches: asm.fiches.length, nom: data.nom };
}

export const taille = (blob) => `${(blob.size / 1048576).toFixed(1).replace('.', ',')} Mo`;
