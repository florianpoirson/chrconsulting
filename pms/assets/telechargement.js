// Page de téléchargement : vérifie la commande, puis fabrique dans le navigateur le PMS (PDF, Word) et les protocoles (PDF).
import { assemble, protocols } from './engine/assemble.js';
import { derive } from './engine/derive.js';
import { buildPdfDefinition, PDF_FONTS } from './engine/render-pdf.js';
import { buildDocx } from './engine/render-docx.js';

const CFG = window.PMS_CONFIG || {};
const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const commande = qs.get('commande'); const cle = qs.get('cle');
const statusEl = $('#dl-status'); const filesEl = $('#dl-files');

function status(html, kind = '') { statusEl.className = `dl-status ${kind}`; statusEl.innerHTML = html; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(`Chargement impossible : ${src}`)); document.head.appendChild(s); }); }
const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const slug = (s) => String(s || 'etablissement').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

async function fetchCommande() {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${CFG.api}/pms-document`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commande, cle }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 200) return data;
    if (res.status === 202) { status(`<strong>Paiement en cours de confirmation…</strong><br>Cela prend généralement quelques secondes.`, 'wait'); await sleep(3000); continue; }
    throw new Error(data.error || 'Commande introuvable.');
  }
  throw new Error('Le paiement n’est pas encore confirmé. Vous recevrez un e-mail dès qu’il le sera ; vous pouvez aussi recharger cette page dans quelques minutes.');
}

async function main() {
  if (!commande || !cle) { status('Lien incomplet. Utilisez le lien reçu par e-mail.', 'err'); return; }
  if (!CFG.api) { status('Service en cours de mise en place.', 'err'); return; }
  try {
    status('Vérification de votre commande…', 'wait');
    const d = await fetchCommande();
    $('#dl-nom').textContent = d.etablissement;
    status('Préparation de vos documents… <span class="dl-spin"></span>', 'wait');
    const V = CFG.vendor || '/pms/assets/vendor';
    await Promise.all([loadScript(`${V}/pdfmake-0.3.11.min.js`), loadScript(`${V}/docx-9.8.0.min.js`)]);
    const fontFiles = ['Manrope-400.ttf', 'Manrope-700.ttf', 'Jost-400.ttf', 'Jost-500.ttf', 'Jost-600.ttf'];
    const fonts = Object.fromEntries(await Promise.all(fontFiles.map(async (f) => [f, await (await fetch(`${V}/fonts/${f}`)).arrayBuffer()])));
    window.pdfMake.addVirtualFileSystem(Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, b64(v)])));
    window.pdfMake.setFonts(PDF_FONTS);

    const data = derive(d.reponses, d.payee_le ? new Date(d.payee_le) : new Date());
    const asm = assemble(d.modele, data);
    const base = slug(data.nom);
    const out = [];
    const pms = await window.pdfMake.createPdf(buildPdfDefinition(asm, data)).getBlob();
    out.push({ name: `PMS-${base}.pdf`, blob: pms, label: 'Plan de Maîtrise Sanitaire', fmt: 'PDF', desc: 'Version à imprimer et à présenter en cas de contrôle.' });
    const docx = window.docx;
    const doc = buildDocx(docx, asm, data, { fonts: { manrope: new Uint8Array(fonts['Manrope-400.ttf']), manropeBold: new Uint8Array(fonts['Manrope-700.ttf']), jost: new Uint8Array(fonts['Jost-500.ttf']), jostBold: new Uint8Array(fonts['Jost-600.ttf']) } });
    out.push({ name: `PMS-${base}.docx`, blob: await docx.Packer.toBlob(doc), label: 'Plan de Maîtrise Sanitaire', fmt: 'Word', desc: 'Version modifiable, pour faire évoluer votre PMS.' });
    const pr = await window.pdfMake.createPdf(buildPdfDefinition(asm, data, { mode: 'protocoles', protocols: protocols(asm) })).getBlob();
    out.push({ name: `Protocoles-${base}.pdf`, blob: pr, label: 'Protocoles', fmt: 'PDF', desc: 'Les procédures à afficher dans la cuisine.' });

    filesEl.innerHTML = out.map((f, i) => `<div class="dl-file"><div><span class="dl-fmt">${f.fmt}</span><h3>${f.label}</h3><p>${f.desc} ${(f.blob.size / 1048576).toFixed(1).replace('.', ',')} Mo</p></div><a class="calc-wa" data-i="${i}" href="#" download="${f.name}">Télécharger</a></div>`).join('');
    out.forEach((f, i) => { const a = filesEl.querySelector(`[data-i="${i}"]`); a.href = URL.createObjectURL(f.blob); });
    status(`<strong>Vos documents sont prêts.</strong> ${asm.fiches.length} fiches de suivi incluses. Ce lien reste valable : conservez l’e-mail de confirmation pour les télécharger à nouveau.`, 'ok');
    $('#dl-next').hidden = false;
  } catch (e) {
    console.error(e);
    status(`${e.message}<br><small>En cas de difficulté, écrivez-nous à contact@chrconsulting.fr en indiquant votre numéro de commande : ${String(commande).slice(0, 8)}.</small>`, 'err');
  }
}
main();
