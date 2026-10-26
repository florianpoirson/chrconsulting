// Page de téléchargement : vérifie la commande, puis fabrique dans le navigateur le PMS (PDF, Word), les protocoles (PDF, version texte et version illustrée) et les relevés de températures (Excel).
import { fabriquer, taille } from './fabrication.js';

const CFG = window.PMS_CONFIG || {};
const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const commande = qs.get('commande'); const cle = qs.get('cle');
const statusEl = $('#dl-status'); const filesEl = $('#dl-files');

function status(html, kind = '') { statusEl.className = `dl-status ${kind}`; statusEl.innerHTML = html; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCommande() {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${CFG.api}/pms-document`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commande, cle }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 200) return data;
    if (res.status === 202) { status('<strong>Paiement en cours de confirmation…</strong><br>Cela prend généralement quelques secondes.', 'wait'); await sleep(3000); continue; }
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
    const { fichiers, fiches } = await fabriquer({ reponses: d.reponses, modele: d.modele, date: d.payee_le ? new Date(d.payee_le) : new Date(), cfg: CFG,
      etape: (n, total, lib) => status(`Préparation de vos documents… <span class="dl-spin"></span><br><small>${lib} (${Math.min(n + 1, total)} / ${total})</small>`, 'wait') });
    filesEl.innerHTML = fichiers.map((f, i) => `<div class="dl-file"><div><span class="dl-fmt">${f.fmt}</span><h3>${f.label}</h3><p>${f.desc} ${taille(f.blob)}</p></div><a class="calc-wa" data-i="${i}" href="#" download="${f.name}">Télécharger</a></div>`).join('');
    fichiers.forEach((f, i) => { filesEl.querySelector(`[data-i="${i}"]`).href = URL.createObjectURL(f.blob); });
    status(`<strong>Vos documents sont prêts.</strong> ${fiches} fiches de suivi incluses. Le lien reçu par e-mail permet de les télécharger à nouveau pendant 12 mois.`, 'ok');
    $('#dl-next').hidden = false;
  } catch (e) {
    console.error(e);
    status(`${e.message}<br><small>En cas de difficulté, écrivez-nous à contact@chrconsulting.fr en indiquant votre numéro de commande : ${String(commande).slice(0, 8)}.</small>`, 'err');
  }
}
main();
