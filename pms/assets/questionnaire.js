// Générateur de PMS – questionnaire en 7 étapes, récapitulatif et commande.
// Les réponses sont gardées dans le navigateur (brouillon) jusqu'au paiement.
import { ZONES, STOCKAGE, EQUIPEMENTS } from './engine/derive.js';

const CFG = window.PMS_CONFIG || {};
const KEY = 'chr_pms_brouillon_v1';
const DOUZE_MOIS = 365 * 24 * 3600 * 1000;
const CGV_VERSION = CFG.cgvVersion || '2026-10-25';
const euros = (n) => `${Number(n).toFixed(2).replace('.', ',')}\u00a0€`;
export const PRIX = (() => { const ht = Number(CFG.prixHT ?? 50), tva = Number(CFG.tauxTVA ?? 20); const t = Math.round(ht * tva) / 100; return { ht, tva, montantTVA: t, ttc: ht + t }; })();
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- état ----------
let R = {};
try { R = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { R = {}; }
if (R._savedAt && Date.now() - R._savedAt > DOUZE_MOIS) { R = {}; try { localStorage.removeItem(KEY); } catch { /* */ } }
const get = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), R);
function set(path, v) {
  const ks = path.split('.'); let o = R;
  ks.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  o[ks[ks.length - 1]] = v;
  save();
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { R._savedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(R)); flash('Brouillon enregistré sur cet appareil'); } catch { /* stockage indisponible */ } }, 400);
}
function flash(t) { const el = $('#q-save'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1600); }

// Valeurs par défaut au premier passage
if (!R._init) {
  Object.assign(R, {
    _init: 1,
    activite: { type: 'traditionnelle', sur_place: true, service: 'coupure' },
    labo_freq: '2', linge: 'interne', eau: 'reseau', dechets: 'municipale', nuisibles: 'prestataire',
    methodes: { refroid: 'non', invendus: 'regles', hache: 'non', tranchage: true, decongelation: true, remise_temp: false },
    gammes: { g1: true, g2: true, g3: true, g6: true }, produits_fl_bruts: true,
    zones: { reception: true, reserve: true, stockage_froid: true, local_poubelles: true, vestiaires: true, chaude: true, froide: true, plonge_vaisselle: true },
    stock: { epicerie: { n: 1 }, armoire_pos: { n: 2 }, armoire_neg: { n: 1 } },
    personnel: [{}, {}], fournisseurs: [{ famille: 'Viandes', conservation: 'Réfrigéré' }, { famille: 'Fruits et légumes', conservation: 'Ambiant / réfrigéré' }, { famille: 'Épicerie', conservation: 'Ambiant' }],
    categories: [],
  });
}

const CATEGORIES = [
  ['Hors-d’œuvre', 'crudités, salades composées, charcuteries, entrées chaudes'],
  ['Viandes', 'viandes à cuisiner à partir de produits frais ou sous vide'],
  ['Poissons et produits de la mer', 'poissons frais, sous vide ou surgelés, crustacés, coquillages'],
  ['Volailles', 'volailles fraîches ou surgelées, cuisinées sur place'],
  ['Plats cuisinés', 'plats mijotés et préparations élaborées sur place'],
  ['Garnitures', 'légumes et féculents'],
  ['Produits laitiers', 'fromages, produits laitiers en portions'],
  ['Desserts', 'pâtisseries maison, desserts en portions, fruits frais'],
  ['Pizzas, crêpes et galettes', 'pâtes préparées sur place ou achetées, garnitures'],
  ['Burgers et sandwichs', 'assemblage à la commande, viandes cuites minute'],
];

// ---------- schéma du questionnaire ----------
const yes = (p) => !!get(p);
const STEPS = [
  { id: 'etab', title: 'Établissement', intro: 'Ces informations figurent sur la page de garde, les en-têtes et la fiche « Données de l’activité ».', fields: [
    { t: 'row', items: [{ p: 'etab.nom', l: 'Nom commercial', req: true, ph: 'Le Comptoir du Port' }, { p: 'etab.raison_sociale', l: 'Raison sociale', ph: 'SAS Les Saveurs du Port' }] },
    { p: 'etab.adresse', l: 'Adresse', req: true },
    { t: 'row', items: [{ p: 'etab.cp', l: 'Code postal', req: true, w: 'sm', pat: '\\d{5}', hint: 'Sert à identifier la DDPP de votre département' }, { p: 'etab.ville', l: 'Ville', req: true }] },
    { t: 'row', items: [{ p: 'etab.tel', l: 'Téléphone', type: 'tel' }, { p: 'etab.email', l: 'E-mail de l’établissement', type: 'email' }] },
    { t: 'row', items: [{ p: 'etab.site', l: 'Site internet' }, { p: 'etab.siret', l: 'SIRET', pat: '\\d{14}', hint: '14 chiffres' }] },
    { t: 'logo', p: 'etab.logo', l: 'Logo (facultatif)', hint: 'PNG ou JPEG. Il apparaît en page de garde.' },
    { t: 'seg', p: 'activite.type', l: 'Type de restauration', opts: [['traditionnelle', 'Traditionnelle'], ['rapide', 'Rapide']] },
    { t: 'checks', l: 'Modes de distribution', items: [['activite.sur_place', 'Sur place'], ['activite.emporter', 'À emporter'], ['activite.livraison', 'Livraison']] },
    { p: 'activite.horaires', l: 'Jours et horaires d’ouverture', ph: 'du mardi au samedi, 12 h-14 h 30 et 19 h-22 h 30' },
    { t: 'seg', p: 'activite.service', l: 'Service', opts: [['coupure', 'Avec coupure'], ['continu', 'Continu']] },
    { t: 'row', items: [{ p: 'activite.couverts_midi', l: 'Couverts par jour – midi', type: 'number', w: 'sm' }, { p: 'activite.couverts_soir', l: 'Couverts par jour – soir', type: 'number', w: 'sm' }] },
    { p: 'activite.pics', l: 'Pics d’activité (facultatif)', ph: 'week-ends d’été, groupes, événements' },
  ] },
  { id: 'orga', title: 'Organisation et personnel', intro: 'Les responsables désignés apparaissent dans la gestion documentaire, la procédure TIAC et les fiches de suivi.', fields: [
    { t: 'h', l: 'Direction de l’établissement' },
    { t: 'row', items: [{ p: 'direction.prenom', l: 'Prénom' }, { p: 'direction.nom', l: 'Nom', req: true }] },
    { t: 'row', items: [{ p: 'direction.tel', l: 'Téléphone', type: 'tel' }, { p: 'direction.email', l: 'E-mail', type: 'email', req: true, hint: 'Les documents seront envoyés à cette adresse' }] },
    { t: 'h', l: 'Responsable de cuisine ou de l’hygiène' },
    { t: 'row', items: [{ p: 'chef.prenom', l: 'Prénom' }, { p: 'chef.nom', l: 'Nom' }] },
    { t: 'row', items: [{ p: 'chef.tel', l: 'Téléphone', type: 'tel' }, { p: 'chef.email', l: 'E-mail', type: 'email' }] },
    { t: 'h', l: 'Effectifs et équipe' },
    { t: 'row', items: [{ p: 'effectif.cuisine', l: 'Cuisine (équivalent temps plein)', type: 'number', w: 'sm' }, { p: 'effectif.salle', l: 'Salle (équivalent temps plein)', type: 'number', w: 'sm' }] },
    { t: 'rows', p: 'personnel', l: 'Personnel de cuisine (facultatif)', hint: 'Laissé vide, la liste est livrée à remplir à la main.', cols: [['nom', 'Nom et prénom'], ['fonction', 'Fonction']], add: 'Ajouter une personne' },
    { t: 'h', l: 'Formation en hygiène alimentaire', sub: 'Obligatoire en restauration commerciale : au moins une personne formée (décret n° 2011-731).' },
    { t: 'row', items: [{ p: 'formation.nom', l: 'Personne formée' }, { p: 'formation.date', l: 'Date de la formation', ph: 'mars 2024' }, { p: 'formation.organisme', l: 'Organisme' }] },
    { t: 'h', l: 'Laboratoire d’analyses' },
    { t: 'row', items: [{ p: 'labo.nom', l: 'Nom du laboratoire', hint: 'Laissé vide : « laboratoire à désigner »' }, { p: 'labo.adresse', l: 'Ville ou adresse' }, { p: 'labo.tel', l: 'Téléphone', type: 'tel' }] },
    { t: 'seg', p: 'labo_freq', l: 'Fréquence des analyses', opts: [['1', '1 fois par an'], ['2', '2 fois par an'], ['4', '4 fois par an']] },
    { t: 'h', l: 'Service de contrôle (DDPP ou DDETSPP)', sub: 'Coordonnées dans l’annuaire de l’administration : lannuaire.service-public.fr' },
    { t: 'row', items: [{ p: 'ddpp.nom', l: 'Service', ph: 'DDPP de votre département' }, { p: 'ddpp.adresse', l: 'Adresse' }, { p: 'ddpp.tel', l: 'Téléphone', type: 'tel' }] },
    { t: 'h', l: 'Linge et tenues' },
    { t: 'seg', p: 'linge', l: 'Entretien du linge', opts: [['interne', 'En interne'], ['prestataire', 'Par un prestataire']] },
    { p: 'linge_presta', l: 'Nom du prestataire', show: () => get('linge') === 'prestataire' },
  ] },
  { id: 'locaux', title: 'Locaux et stockage', intro: 'Les zones déclarées construisent la marche en avant et le plan de nettoyage ; chaque enceinte froide reçoit sa fiche de relevé.', fields: [
    { t: 'checks', l: 'Zones présentes dans l’établissement', cols: 2, items: ZONES.map(([k, label]) => [`zones.${k}`, label]) },
    { t: 'stock', l: 'Équipements de stockage', hint: 'Nombre et capacité (litres pour le froid, m² pour la réserve). Laissez 0 si absent.' },
    { t: 'checks', l: '', items: [['stock.enceinte_fl', 'Une enceinte est réservée aux fruits et légumes (+4 à +8 °C)']] },
  ] },
  { id: 'produits', title: 'Produits et fournisseurs', intro: 'Les gammes et les produits utilisés décident des protocoles inclus.', fields: [
    { t: 'checks', l: 'Gammes de produits utilisées', cols: 2, items: [['gammes.g1', '1re gamme : produits bruts frais'], ['gammes.g2', '2e gamme : conserves'], ['gammes.g3', '3e gamme : surgelés'], ['gammes.g4', '4e gamme : crus prêts à l’emploi'], ['gammes.g5', '5e gamme : cuits sous vide'], ['gammes.g6', '6e gamme : déshydratés']] },
    { t: 'checks', l: 'Produits et pratiques', items: [['produits_fl_bruts', 'Fruits et légumes bruts lavés et épluchés sur place'], ['poisson_cru', 'Poisson servi cru, mariné ou peu cuit (tartare, sushi, ceviche…)'], ['oeufs_crus', 'Œufs coquille dans des préparations non cuites (mayonnaise, mousse…)']] },
    { t: 'checks', l: 'Viandes servies, achetées crues (affichage de l’origine obligatoire)', cols: 2, items: [['viandes.bovine', 'Bœuf, veau'], ['viandes.porc', 'Porc'], ['viandes.ovine', 'Agneau, mouton'], ['viandes.volaille', 'Volaille']] },
    { t: 'cats', l: 'Catégories de produits proposés', hint: 'Le descriptif peut être modifié : il figure dans la présentation de l’activité.' },
    { t: 'rows', p: 'fournisseurs', l: 'Fournisseurs (facultatif)', hint: 'Laissé vide, la liste est livrée à remplir.', cols: [['famille', 'Famille de produits'], ['conservation', 'Conservation'], ['nom', 'Fournisseur'], ['contact', 'Coordonnées']], add: 'Ajouter un fournisseur' },
  ] },
  { id: 'materiel', title: 'Matériel et maintenance', intro: 'Chaque installation déclarée ajoute ses contrôles réglementaires et sa ligne dans le suivi de maintenance.', fields: [
    { t: 'checks', l: 'Matériel de cuisson et de préparation', cols: 3, items: Object.entries(EQUIPEMENTS).map(([k, l]) => [`equip.${k}`, l]) },
    { t: 'checks', l: 'Installations', cols: 2, items: [['install.hotte', 'Hotte et extraction'], ['install.fluides', 'Équipements frigorifiques (fluides frigorigènes)'], ['install.bac_graisse', 'Bac à graisse'], ['install.monte_charge', 'Monte-charge'], ['install.cellule_surgel', 'Cellule de surgélation']] },
    { t: 'presta', l: 'Prestataires de maintenance (facultatif)' },
  ] },
  { id: 'methodes', title: 'Méthodes de travail', intro: 'C’est l’étape qui pilote le plus de contenu : procédures, points critiques et fiches d’enregistrement.', fields: [
    { t: 'seg', p: 'methodes.refroid', l: 'Préparations cuites refroidies pour être servies plus tard', opts: [['non', 'Non, tout est servi le jour même'], ['cellule', 'Oui, avec une cellule de refroidissement']], hint: 'Sans cellule, la réglementation ne permet pas de refroidir des préparations cuites (+63 °C à +10 °C en moins de 2 h).' },
    { t: 'checks', l: 'Pratiques', cols: 2, items: [['methodes.decongelation', 'Décongélation de produits surgelés'], ['methodes.congelation', 'Congélation de produits par l’établissement'], ['methodes.sous_vide', 'Conditionnement sous vide'], ['methodes.cuisson_sous_vide', 'Cuisson sous vide'], ['methodes.basse_temp', 'Cuisson à basse température'], ['methodes.remise_temp', 'Remise en température de plats préparés à l’avance'], ['methodes.tranchage', 'Tranchage et assemblage de préparations froides'], ['methodes.friture', 'Friture']] },
    { p: 'methodes.congel_duree', l: 'Durée maximale de conservation des produits congelés', ph: '3 mois', w: 'sm', show: () => yes('methodes.congelation') },
    { t: 'seg', p: 'methodes.friture_freq', l: 'Contrôle des huiles de friture', opts: [['service', 'À chaque service'], ['jour', 'Chaque jour'], ['semaine', 'Chaque semaine']], show: () => yes('methodes.friture') || yes('equip.friteuse') },
    { p: 'huiles_collecteur', l: 'Collecteur des huiles usagées', show: () => yes('methodes.friture') || yes('equip.friteuse') },
    { t: 'seg', p: 'methodes.hache', l: 'Viande hachée', opts: [['non', 'Aucune'], ['achat', 'Achetée hachée'], ['fabrication', 'Hachée sur place']] },
    { t: 'seg', p: 'methodes.invendus', l: 'Excédents non servis', opts: [['regles', 'Représentés le lendemain selon les règles'], ['jamais', 'Jamais réutilisés']] },
  ] },
  { id: 'milieu', title: 'Nuisibles, eau et déchets', intro: 'Dernière étape avant le récapitulatif.', fields: [
    { t: 'seg', p: 'nuisibles', l: 'Lutte contre les nuisibles', opts: [['prestataire', 'Contrat avec une entreprise'], ['interne', 'Gérée en interne']] },
    { t: 'row', show: () => get('nuisibles') === 'prestataire', items: [{ p: 'nuisibles_presta.nom', l: 'Entreprise' }, { p: 'nuisibles_presta.visites', l: 'Visites par an', type: 'number', w: 'sm' }] },
    { t: 'row', items: [{ p: 'nuisibles_resp', l: 'Responsable interne du plan', hint: 'Par défaut : le responsable de cuisine' }, { p: 'nuisibles_suppl', l: 'Suppléant' }] },
    { t: 'seg', p: 'eau', l: 'Approvisionnement en eau', opts: [['reseau', 'Réseau public'], ['privee', 'Puits ou forage privé']] },
    { t: 'seg', p: 'dechets', l: 'Collecte des ordures ménagères', opts: [['municipale', 'Collecte municipale'], ['prestataire', 'Prestataire privé']] },
    { p: 'dechets_presta', l: 'Nom du prestataire', show: () => get('dechets') === 'prestataire' },
    { t: 'seg', p: 'biodechets', l: 'Biodéchets (tri obligatoire depuis 2024)', opts: [['collecte', 'Collecte séparée de la commune'], ['prestataire', 'Prestataire'], ['compost', 'Compostage sur place']] },
    { p: 'biodechets_presta', l: 'Nom du prestataire', show: () => get('biodechets') === 'prestataire' },
  ] },
];

// ---------- rendu des champs ----------
function input(f) {
  const v = get(f.p) ?? '';
  const id = 'f_' + f.p.replace(/\./g, '_');
  return `<div class="qf ${f.w === 'sm' ? 'sm' : ''}"><label for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</label>
    <input id="${id}" data-p="${f.p}" type="${f.type || 'text'}" value="${esc(v)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.pat ? `pattern="${f.pat}" inputmode="numeric"` : ''} ${f.req ? 'required' : ''} ${f.type === 'number' ? 'min="0" step="1"' : ''} autocomplete="off">
    ${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
}
function field(f) {
  if (f.show && !f.show()) return '';
  switch (f.t) {
    case 'h': return `<h4 class="qh">${esc(f.l)}${f.sub ? `<small>${esc(f.sub)}</small>` : ''}</h4>`;
    case 'row': return `<div class="qrow">${f.items.map(input).join('')}</div>`;
    case 'seg': return `<div class="qf"><span class="ql">${esc(f.l)}</span><div class="seg-choices">${f.opts.map(([v, l]) => `<button type="button" class="seg ${String(get(f.p)) === v ? 'active' : ''}" data-seg="${f.p}" data-v="${v}">${esc(l)}</button>`).join('')}</div>${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
    case 'checks': return `<div class="qf">${f.l ? `<span class="ql">${esc(f.l)}</span>` : ''}<div class="qchecks c${f.cols || 1}">${f.items.map(([p, l]) => `<label class="qc"><input type="checkbox" data-c="${p}" ${get(p) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>`;
    case 'rows': {
      const list = get(f.p) || [];
      return `<div class="qf"><span class="ql">${esc(f.l)}</span>${f.hint ? `<small>${esc(f.hint)}</small>` : ''}
        <div class="qrows" style="--n:${f.cols.length}">${f.cols.map(([, l]) => `<span class="qrh">${esc(l)}</span>`).join('')}<span></span>
        ${list.map((it, i) => f.cols.map(([k]) => `<input data-r="${f.p}" data-i="${i}" data-k="${k}" value="${esc(it[k] ?? '')}" aria-label="${esc(k)}">`).join('') + `<button type="button" class="qdel" data-del="${f.p}" data-i="${i}" aria-label="Supprimer la ligne">×</button>`).join('')}
        </div><button type="button" class="qadd" data-add="${f.p}">+ ${esc(f.add)}</button></div>`;
    }
    case 'logo': {
      const v = get(f.p);
      return `<div class="qf"><span class="ql">${esc(f.l)}</span><div class="qlogo">${v ? `<img src="${v}" alt="Logo">` : '<span class="qlogo-empty">Aucun logo</span>'}
        <label class="qadd">Choisir un fichier<input type="file" accept="image/png,image/jpeg" data-logo="${f.p}" hidden></label>${v ? `<button type="button" class="qadd" data-logo-del="${f.p}">Retirer</button>` : ''}</div><small>${esc(f.hint)}</small></div>`;
    }
    case 'stock': return `<div class="qf"><span class="ql">${esc(f.l)}</span><small>${esc(f.hint)}</small><div class="qstock">
      <span class="qrh">Équipement</span><span class="qrh">Nombre</span><span class="qrh">Capacité</span><span class="qrh">Usage</span>
      ${STOCKAGE.map(([k, l]) => `<span class="qsl">${esc(l)}</span><input type="number" min="0" max="20" data-p="stock.${k}.n" value="${esc(get(`stock.${k}.n`) ?? 0)}" aria-label="Nombre"><input data-p="stock.${k}.vol" value="${esc(get(`stock.${k}.vol`) ?? '')}" placeholder="${k === 'epicerie' ? 'm²' : 'litres'}" aria-label="Capacité"><input data-p="stock.${k}.usage" value="${esc(get(`stock.${k}.usage`) ?? '')}" placeholder="facultatif" aria-label="Usage">`).join('')}
      </div></div>`;
    case 'cats': {
      const cur = R.categories || [];
      return `<div class="qf"><span class="ql">${esc(f.l)}</span><small>${esc(f.hint)}</small><div class="qcats">${CATEGORIES.map(([l, d]) => {
        const c = cur.find((x) => x.label === l);
        return `<label class="qc"><input type="checkbox" data-cat="${esc(l)}" data-def="${esc(d)}" ${c ? 'checked' : ''}><span>${esc(l)}</span></label><input class="qcat-d" data-catd="${esc(l)}" value="${esc(c ? c.detail : d)}" ${c ? '' : 'disabled'} aria-label="Descriptif ${esc(l)}">`;
      }).join('')}</div></div>`;
    }
    case 'presta': {
      const items = [['hotte', 'Hotte et conduits', 'install.hotte'], ['fluides', 'Froid (fluides frigorigènes)', 'install.fluides'], ['froid', 'Chambres et armoires froides', null], ['bac_graisse', 'Bac à graisse', 'install.bac_graisse'], ['monte_charge', 'Monte-charge', 'install.monte_charge'], ['lave_vaisselle', 'Lave-vaisselle', 'equip.lave_vaisselle'], ['extincteurs', 'Extincteurs', null]].filter(([, , c]) => !c || get(c));
      return `<div class="qf"><span class="ql">${esc(f.l)}</span><div class="qrow wrap3">${items.map(([k, l]) => input({ p: `install_presta.${k}`, l })).join('')}</div></div>`;
    }
    default: return input(f);
  }
}

// ---------- navigation entre étapes ----------
let step = 0;
const TOTAL = STEPS.length + 1; // + récapitulatif
const root = $('#q-root');
const steps = $('#q-steps');

function renderSteps() {
  steps.innerHTML = [...STEPS.map((s) => s.title), 'Récapitulatif'].map((t, i) => `<button type="button" class="qs ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-go="${i}"><span>${i + 1}</span>${esc(t)}</button>`).join('');
  $('#q-bar').style.width = `${((step + 1) / TOTAL) * 100}%`;
}

function render() {
  renderSteps();
  if (step < STEPS.length) {
    const s = STEPS[step];
    root.innerHTML = `<div class="qhead"><span class="calc-step-label">Étape ${step + 1} sur ${TOTAL}</span><h3>${esc(s.title)}</h3><p>${esc(s.intro)}</p></div>
      <form class="qform" novalidate>${s.fields.map(field).join('')}</form>
      <div class="qnav">${step ? '<button type="button" class="qback" data-nav="-1">← Étape précédente</button>' : '<span></span>'}<button type="button" class="calc-wa" data-nav="1">${step === STEPS.length - 1 ? 'Voir le récapitulatif' : 'Étape suivante'} →</button></div>`;
  } else renderRecap();
}

function validateStep() {
  const form = root.querySelector('form'); if (!form) return true;
  const bad = [...form.querySelectorAll('input')].filter((i) => !i.checkValidity() || (i.required && !i.value.trim()));
  form.querySelectorAll('.err').forEach((e) => e.classList.remove('err'));
  bad.forEach((i) => i.closest('.qf')?.classList.add('err'));
  if (bad.length) { bad[0].focus(); return false; }
  return true;
}

function go(n) {
  if (n > step && step < STEPS.length && !validateStep()) return;
  step = Math.max(0, Math.min(TOTAL - 1, n));
  render();
  document.getElementById('questionnaire').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- récapitulatif ----------
function contenus() {
  const has = (p) => !!get(p);
  const fr = has('methodes.friture') || has('equip.friteuse');
  const cellule = get('methodes.refroid') === 'cellule';
  const neg = ['cf_neg', 'armoire_neg', 'tour_neg'].some((k) => Number(get(`stock.${k}.n`)) > 0);
  const vo = ['bovine', 'porc', 'ovine', 'volaille'].some((k) => has(`viandes.${k}`));
  const list = [
    [true, 'Bonnes pratiques d’hygiène, plan HACCP avec tableau des points critiques, traçabilité et TIAC'],
    [cellule, 'Refroidissement rapide : procédure, étiquettes et relevés de cellule'],
    [has('methodes.congelation'), 'Congélation : procédure et fiche de suivi'],
    [has('methodes.decongelation') || has('gammes.g3'), 'Décongélation'],
    [has('methodes.sous_vide') || has('methodes.cuisson_sous_vide'), 'Sous vide : procédure et fiche de suivi'],
    [has('methodes.basse_temp'), 'Cuisson à basse température'],
    [has('methodes.remise_temp'), 'Remise en température et son relevé'],
    [fr, 'Huiles de friture : procédure et registre'],
    [vo, 'Origine des viandes : procédure et affiche'],
    [has('poisson_cru'), 'Poisson cru : traitement anti-parasitaire (Anisakis)'],
    [get('methodes.hache') === 'fabrication', 'Fabrication de viande hachée'],
    [has('activite.livraison'), 'Livraison : procédure et relevé de températures'],
    [neg, 'Relevés du froid négatif'],
    [has('stock.enceinte_fl'), 'Relevés de l’enceinte fruits et légumes'],
    [has('produits_fl_bruts'), 'Lavage et désinfection des fruits et légumes'],
    [has('gammes.g2'), 'Ouverture des boîtes de conserve'],
    [get('nuisibles') === 'prestataire', 'Suivi du contrat de lutte contre les nuisibles'],
    [get('nuisibles') === 'interne', 'Plan de lutte interne contre les nuisibles'],
  ];
  return list.filter(([c]) => c).map(([, t]) => t);
}

function renderRecap() {
  const e = R.etab || {};
  const email = R._email || (R.direction || {}).email || e.email || '';
  const zones = ZONES.filter(([k]) => get(`zones.${k}`)).length;
  const enc = STOCKAGE.reduce((a, [k]) => a + (Number(get(`stock.${k}.n`)) || 0), 0);
  root.innerHTML = `<div class="qhead" id="recapitulatif"><span class="calc-step-label">Étape ${TOTAL} sur ${TOTAL}</span><h3>Récapitulatif</h3><p>Vérifiez les points clés : vous pouvez revenir sur n’importe quelle étape sans perdre vos réponses.</p></div>
    <div class="recap">
      <div class="recap-card"><h4>${esc(e.nom || 'Établissement')}</h4><p>${esc([e.adresse, [e.cp, e.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</p>
        <p>${esc(get('activite.type') === 'rapide' ? 'Restauration rapide' : 'Restauration traditionnelle')} · ${zones} zones · ${enc} équipements de stockage</p></div>
      <div class="recap-card"><h4>Votre PMS comprendra</h4><ul>${contenus().map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="recap-note">Plus les fiches d’enregistrement communes (réception, températures, nettoyage, maintenance, formation, déchets, eau, anomalies…), numérotées automatiquement, et le recueil de protocoles à afficher en cuisine.</p></div>
    </div>
    ${new URLSearchParams(location.search).get('paiement') === 'annule' ? '<div class="verdict orange">Le paiement a été interrompu : vos réponses sont conservées, vous pouvez reprendre ci-dessous.</div>' : ''}
    <form class="qform" id="q-order" novalidate>
      <div class="qrow"><div class="qf"><label for="q-email">E-mail de réception des documents <span class="req">*</span></label><input id="q-email" type="email" required value="${esc(email)}" autocomplete="email"></div></div>
      <input type="text" name="site" id="q-site" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
      <label class="qc"><input type="checkbox" id="q-cgv" required><span>J’accepte les <a href="${CFG.cgvUrl || '/pms/cgv/'}" target="_blank" rel="noopener">conditions générales de vente</a>.</span></label>
      <label class="qc"><input type="checkbox" id="q-retract" required><span>Je demande la mise à disposition immédiate des documents et je renonce à mon droit de rétractation.</span></label>
      <label class="qc"><input type="checkbox" id="q-adapt" required><span>Je comprends que ce PMS est établi à partir de mes déclarations, sans visite des locaux, et qu’il m’appartient de l’adapter, de l’appliquer et de le tenir à jour.</span></label>
      <div class="qpay"><div><div class="qprice">${euros(PRIX.ht)} <span class="qprice-u">HT</span></div><div class="qprice-ttc">${euros(PRIX.ttc)} TTC <small>(dont TVA ${PRIX.tva}\u00a0% : ${euros(PRIX.montantTVA)})</small></div><small>Paiement sécurisé par Stripe · facture envoyée par e-mail</small></div>
      <button type="submit" class="calc-wa big" id="q-submit">${CFG.essai ? 'Générer mes documents (essai, sans paiement)' : 'Payer et recevoir mon PMS →'}</button></div>
      <p class="qerr" id="q-err" role="alert"></p>
      <p class="qnote">Vos réponses servent uniquement à établir votre PMS. Elles sont conservées 12 mois au plus après la commande, puis supprimées (voir la <a href="${CFG.confidentialiteUrl || '/confidentialite'}" target="_blank" rel="noopener">politique de confidentialité</a>). Le brouillon enregistré sur cet appareil s’efface après 12 mois ou à votre demande.</p>
    </form>
    <div id="q-result"></div>
    <div class="qnav"><button type="button" class="qback" data-nav="-1">← Étape précédente</button><button type="button" class="qback" id="q-reset">Effacer mes réponses</button></div>`;
}

async function commander(ev) {
  ev.preventDefault();
  const err = $('#q-err'); err.textContent = '';
  const email = $('#q-email').value.trim();
  R._email = email; save();
  if (!$('#q-email').checkValidity() || !email) { err.textContent = 'Indiquez une adresse e-mail valide.'; return; }
  if (!$('#q-cgv').checked || !$('#q-retract').checked || !$('#q-adapt').checked) { err.textContent = 'Cochez les trois cases pour continuer.'; return; }
  for (let i = 0; i < STEPS.length; i++) {
    const missing = STEPS[i].fields.flatMap((f) => (f.t === 'row' ? f.items : [f])).filter((f) => f.req && !String(get(f.p) ?? '').trim());
    if (missing.length) { err.innerHTML = `Information manquante à l’étape ${i + 1} : ${esc(missing.map((m) => m.l).join(', '))}. <button type="button" class="linkbtn" data-go="${i}">Compléter</button>`; return; }
  }
  if (CFG.essai) return essai();
  if (!CFG.api) { err.textContent = 'Le paiement en ligne sera ouvert très prochainement. Contactez-nous sur WhatsApp pour commander dès maintenant.'; return; }
  const btn = $('#q-submit'); btn.disabled = true; btn.textContent = 'Redirection vers le paiement…';
  try {
    const reponses = JSON.parse(JSON.stringify(R)); delete reponses._init; delete reponses._email; delete reponses._savedAt;
    const res = await fetch(`${CFG.api}/pms-commande`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reponses, email, cgv: true, cgvVersion: CGV_VERSION, renonciation: true, site: $('#q-site').value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Le service de paiement ne répond pas.');
    location.href = data.url;
  } catch (e) {
    err.textContent = `${e.message} Réessayez dans un instant ; si le problème persiste, contactez-nous.`;
    btn.disabled = false; btn.textContent = 'Payer et recevoir mon PMS →';
  }
}

// ---------- version d'essai : documents fabriqués sur place, sans paiement ----------
async function essai() {
  const out = $('#q-result'); const btn = $('#q-submit');
  btn.disabled = true; btn.textContent = 'Fabrication en cours…';
  out.innerHTML = '<div class="dl-status wait">Préparation des documents… <span class="dl-spin"></span><br><small>Comptez quelques secondes ; le PMS fait une centaine de pages.</small></div>';
  try {
    const [{ fabriquer, taille }, modele] = await Promise.all([import('./fabrication.js'), fetch(CFG.modeleUrl).then((r) => { if (!r.ok) throw new Error('Modèle introuvable.'); return r.json(); })]);
    const reponses = JSON.parse(JSON.stringify(R)); delete reponses._init; delete reponses._email; delete reponses._savedAt;
    const t0 = performance.now();
    const { fichiers, fiches } = await fabriquer({ reponses, modele, cfg: CFG });
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads').catch(() => null) : null;
    out.innerHTML = `<div class="dl-status ok"><strong>Documents prêts</strong> en ${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s : ${fiches} fiches de suivi incluses. Dans la version en ligne, cette étape a lieu après le paiement, sur la page de téléchargement, et le lien est envoyé par e-mail.</div>
      <div id="dl-files">${fichiers.map((f, i) => `<div class="dl-file"><div><span class="dl-fmt">${f.fmt}</span><h3>${f.label}</h3><p>${f.desc} ${taille(f.blob)}</p></div><button type="button" class="calc-wa" data-dl="${i}">Télécharger</button></div>`).join('')}</div><p class="qerr" id="q-dlerr" role="alert"></p>`;
    out.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', async () => {
      const f = fichiers[+b.dataset.dl]; $('#q-dlerr').textContent = '';
      if (dl) {
        try { await dl.save({ filename: f.name, data: f.blob }); } catch (e) { if (e && e.code !== 'declined') $('#q-dlerr').textContent = `Téléchargement impossible ici (${e.code || e.message}).`; }
      } else { const a = document.createElement('a'); a.href = URL.createObjectURL(f.blob); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
    }));
  } catch (e) {
    console.error(e);
    out.innerHTML = `<div class="dl-status err">${esc(e.message)}</div>`;
  }
  btn.disabled = false; btn.textContent = 'Générer à nouveau';
}

// Exemple rempli (version d'essai)
async function exemple() {
  try { const ex = await (await fetch(CFG.exempleUrl)).json(); R = { ...ex, _init: 1 }; save(); step = 0; render(); }
  catch { /* exemple indisponible */ }
}
if (CFG.essai && CFG.exempleUrl) document.addEventListener('click', (ev) => { if (ev.target.closest('#q-exemple')) { ev.preventDefault(); exemple(); } });

// ---------- logo : redimensionné dans le navigateur ----------
function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) return reject(new Error('Format accepté : PNG ou JPEG.'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      if (file.type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let out = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
      if (out.length > 400000) out = c.toDataURL('image/jpeg', 0.8);
      resolve(out);
    };
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = url;
  });
}

// ---------- événements ----------
root.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.p) { set(el.dataset.p, el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value); el.closest('.qf')?.classList.remove('err'); }
  else if (el.dataset.r) { const list = get(el.dataset.r) || []; list[+el.dataset.i] = { ...(list[+el.dataset.i] || {}), [el.dataset.k]: el.value }; set(el.dataset.r, list); }
  else if (el.dataset.catd) { const c = (R.categories || []).find((x) => x.label === el.dataset.catd); if (c) { c.detail = el.value; save(); } }
});
root.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.c) { set(el.dataset.c, el.checked); render(); }
  else if (el.dataset.cat) {
    R.categories = (R.categories || []).filter((x) => x.label !== el.dataset.cat);
    if (el.checked) R.categories.push({ label: el.dataset.cat, detail: el.dataset.def });
    R.categories.sort((a, b) => CATEGORIES.findIndex(([l]) => l === a.label) - CATEGORIES.findIndex(([l]) => l === b.label));
    save(); render();
  } else if (el.dataset.logo && el.files[0]) {
    try { set(el.dataset.logo, await readLogo(el.files[0])); render(); } catch (e) { alert(e.message); }
  }
});
root.addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.seg) { set(b.dataset.seg, b.dataset.v); render(); }
  else if (b.dataset.nav) go(step + Number(b.dataset.nav));
  else if (b.dataset.go) go(Number(b.dataset.go));
  else if (b.dataset.add) { const list = get(b.dataset.add) || []; list.push({}); set(b.dataset.add, list); render(); }
  else if (b.dataset.del) { const list = get(b.dataset.del) || []; list.splice(+b.dataset.i, 1); set(b.dataset.del, list); render(); }
  else if (b.dataset.logoDel) { set(b.dataset.logoDel, null); render(); }
  else if (b.id === 'q-reset') {
    if (b.dataset.armed) { clearTimeout(saveT); try { localStorage.removeItem(KEY); } catch { /* */ } location.reload(); }
    else { b.dataset.armed = '1'; b.textContent = 'Confirmer l’effacement de toutes les réponses'; b.classList.add('danger'); setTimeout(() => { delete b.dataset.armed; b.textContent = 'Effacer mes réponses'; b.classList.remove('danger'); }, 5000); }
  }
});
root.addEventListener('submit', (ev) => { if (ev.target.id === 'q-order') commander(ev); else ev.preventDefault(); });
steps.addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) { const n = +b.dataset.go; if (n <= step || validateStep()) go(n); } });

if (new URLSearchParams(location.search).get('paiement') === 'annule') step = TOTAL - 1;
render();
