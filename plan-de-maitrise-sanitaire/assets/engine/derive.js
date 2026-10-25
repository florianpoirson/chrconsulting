// Réponses du questionnaire → données utilisées par le modèle (valeurs calculées, listes, drapeaux).
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const dateFr = (d) => `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

export const STOCKAGE = [
  ['epicerie', 'Réserve sèche (épicerie)', 'sec'],
  ['cf_pos', 'Chambre froide positive', 'pos'],
  ['cf_neg', 'Chambre froide négative', 'neg'],
  ['armoire_pos', 'Armoire réfrigérée positive', 'pos'],
  ['armoire_neg', 'Armoire ou congélateur négatif', 'neg'],
  ['tour_pos', 'Tour ou saladette réfrigérée', 'pos'],
  ['tour_neg', 'Tour négative', 'neg'],
  ['vitrine', 'Vitrine réfrigérée', 'pos'],
  ['cave', 'Cave à boissons réfrigérée', 'pos'],
];

export const ZONES = [
  ['reception', 'Zone de réception', 'sale'], ['reserve', 'Réserve sèche', 'sale'], ['stockage_froid', 'Stockage froid (chambres, armoires)', 'sale'],
  ['local_poubelles', 'Local poubelles', 'sale'], ['vestiaires', 'Vestiaires et sanitaires du personnel', 'sale'],
  ['legumerie', 'Légumerie', 'inter'], ['deconditionnement', 'Zone de déconditionnement', 'inter'], ['plonge_batterie', 'Plonge batterie', 'inter'], ['plonge_vaisselle', 'Plonge vaisselle', 'inter'],
  ['froide', 'Zone de préparations froides', 'propre'], ['chaude', 'Zone de cuisson (préparations chaudes)', 'propre'], ['preparation', 'Zone de préparation', 'propre'],
  ['patisserie', 'Pâtisserie', 'propre'], ['envoi', 'Zone d’envoi (passe)', 'propre'],
];

export const EQUIPEMENTS = {
  four_gaz: 'Four à gaz', four_elec: 'Four électrique', four_mixte: 'Four mixte (combi-vapeur)', four_pizza: 'Four à pizza',
  plaques_gaz: 'Feux vifs / plaques gaz', induction: 'Plaques à induction', salamandre: 'Salamandre', micro_ondes: 'Four à micro-ondes',
  bain_marie: 'Bain-marie', plancha: 'Plancha', grill: 'Grill / gril', crepiere: 'Crêpière', broche: 'Broche', rotissoire: 'Rôtissoire',
  friteuse: 'Friteuse', sauteuse: 'Sauteuse / braisière', marmite: 'Marmite',
  trancheuse: 'Trancheuse', hachoir: 'Hachoir', batteur: 'Batteur-mélangeur', cutter: 'Cutter / robot-coupe',
  machine_sous_vide: 'Machine sous vide', lave_vaisselle: 'Lave-vaisselle', armoire_chaude: 'Armoire de maintien en température',
};

const nonEmpty = (v) => v != null && String(v).trim() !== '';
const n = (v) => Number(v) || 0;

export function derive(r, now = new Date()) {
  const d = JSON.parse(JSON.stringify(r || {}));
  d.etab = d.etab || {}; d.activite = d.activite || {}; d.methodes = d.methodes || {};
  d.zones = d.zones || {}; d.stock = d.stock || {}; d.gammes = d.gammes || {}; d.viandes = d.viandes || {};
  d.equip = d.equip || {}; d.install = d.install || {};
  const e = d.etab;
  d.nom = e.nom || e.raison_sociale || 'l’établissement';
  d.adresse_complete = [e.adresse, [e.cp, e.ville].filter(nonEmpty).join(' ')].filter(nonEmpty).join(', ');
  d.date_version = dateFr(now);
  d.annee = now.getFullYear();
  d.annees = [0, 1, 2, 3].map((k) => d.annee + k);
  d.departement = (e.cp || '').slice(0, 2) === '97' ? (e.cp || '').slice(0, 3) : (e.cp || '').slice(0, 2);

  const pers = (p) => (p && (p.prenom || p.nom) ? [p.prenom, p.nom].filter(nonEmpty).join(' ') : null);
  d.direction = d.direction || {}; d.chef = d.chef || {};
  d.direction.nom_complet = pers(d.direction);
  d.chef.nom_complet = pers(d.chef);
  d.resp_hygiene = d.chef.nom_complet || d.direction.nom_complet;

  // Personnel, fournisseurs, maintenance : lignes vides retirées
  d.personnel = (d.personnel || []).filter((p) => nonEmpty(p.nom) || nonEmpty(p.fonction));
  d.fournisseurs = (d.fournisseurs || []).filter((f) => nonEmpty(f.nom) || nonEmpty(f.famille));
  d.maintenance = (d.maintenance || []).filter((m) => nonEmpty(m.equipement) || nonEmpty(m.prestataire));

  // Stockage
  d.enceintes = [];
  for (const [key, label, kind] of STOCKAGE) {
    const s = d.stock[key] || {}; const count = n(s.n);
    for (let k = 1; k <= count; k++) d.enceintes.push({ key, kind, nom: count > 1 ? `${label} n° ${k}` : label, volume: s.vol ? `${s.vol} ${key === 'epicerie' ? 'm²' : 'L'}` : '', usage: (s.usage || '') });
  }
  d.stockage_lignes = STOCKAGE.filter(([k]) => n((d.stock[k] || {}).n) > 0).map(([k, label]) => ({ type: label, nombre: n(d.stock[k].n), volume: d.stock[k].vol || '', usage: d.stock[k].usage || '' }));
  d.enceintes_pos = d.enceintes.filter((x) => x.kind === 'pos');
  d.enceintes_neg = d.enceintes.filter((x) => x.kind === 'neg');
  d.has = {
    froid_pos: d.enceintes_pos.length > 0,
    froid_neg: d.enceintes_neg.length > 0,
    fl_enceinte: !!d.stock.enceinte_fl,
  };
  d.enceintes_pos_noms = d.enceintes_pos.map((x) => x.nom);
  d.enceintes_neg_noms = d.enceintes_neg.map((x) => x.nom);

  // Zones et marche en avant
  d.zones_presentes = ZONES.filter(([k]) => d.zones[k]).map(([k, label, niv]) => ({ key: k, label, niveau: niv, surface: (d.zones_m2 || {})[k] || '' }));
  const parNiveau = (niv) => d.zones_presentes.filter((z) => z.niveau === niv).map((z) => z.label);
  d.zones_sales = parNiveau('sale'); d.zones_inter = parNiveau('inter'); d.zones_propres = parNiveau('propre');

  // Équipements
  d.equipements_liste = Object.entries(EQUIPEMENTS).filter(([k]) => d.equip[k]).map(([, l]) => l);
  d.has.gaz = !!(d.equip.four_gaz || d.equip.plaques_gaz || d.equip.four_pizza && d.equip.four_pizza_gaz);
  d.has.cuisson = d.equipements_liste.length > 0;
  d.has.friture = !!(d.methodes.friture || d.equip.friteuse);
  d.methodes.friture = d.has.friture;
  d.has.cellule = d.methodes.refroid === 'cellule' || !!d.install.cellule_refroid;
  d.has.refroidissement = d.has.cellule;
  d.install.cellule_refroid = d.has.cellule;
  d.has.congelation = !!d.methodes.congelation;
  d.has.decongelation = !!d.methodes.decongelation || !!d.gammes.g3;
  d.has.sous_vide = !!(d.methodes.sous_vide || d.methodes.cuisson_sous_vide);
  d.has.hache = d.methodes.hache === 'fabrication';
  d.has.hache_achat = d.methodes.hache === 'achat' || d.methodes.hache === 'fabrication';
  d.has.livraison = !!d.activite.livraison;
  d.has.emporter = !!d.activite.emporter;
  d.has.viande_origine = !!(d.viandes.bovine || d.viandes.porc || d.viandes.ovine || d.viandes.volaille);
  d.especes_origine = [d.viandes.bovine && 'bovines (y compris veau)', d.viandes.porc && 'porcines', d.viandes.ovine && 'ovines', d.viandes.volaille && 'de volailles'].filter(Boolean);
  d.has.maintenance_install = !!(d.install.monte_charge || d.install.hotte || d.install.fluides || d.install.bac_graisse || d.has.gaz || d.install.cellule_refroid || d.install.cellule_surgel);
  d.has.legumerie = !!d.zones.legumerie;
  d.has.conserves = !!d.gammes.g2;
  d.has.fl_bruts = !!d.produits_fl_bruts;
  d.has.prestataire_nuisibles = d.nuisibles === 'prestataire';
  d.has.eau_privee = d.eau === 'privee';
  d.has.labo = nonEmpty((d.labo || {}).nom);
  d.has.linge_presta = d.linge === 'prestataire';
  d.type_label = d.activite.type === 'rapide' ? 'restauration rapide' : 'restauration traditionnelle';
  d.modes_distribution = [d.activite.sur_place && 'sur place', d.activite.emporter && 'à emporter', d.activite.livraison && 'en livraison'].filter(Boolean);
  d.gammes_liste = [1, 2, 3, 4, 5, 6].filter((k) => d.gammes['g' + k]).map((k) => `${k}${k === 1 ? 're' : 'e'} gamme`);
  d.couverts_total = n(d.activite.couverts_midi) + n(d.activite.couverts_soir) || '';
  d.nuisibles_resp_aff = d.nuisibles_resp || d.resp_hygiene || null;
  d.labo = d.labo || {};
  d.labo.tel_aff = d.labo.tel ? `, tél. ${d.labo.tel}` : '';
  d.activite.service_label = { continu: 'Service continu', coupure: 'Service avec coupure' }[d.activite.service] || null;
  d.methodes.friture_freq_label = { service: 'à chaque service', jour: 'chaque jour', semaine: 'chaque semaine' }[d.methodes.friture_freq] || null;
  d.biodechets_label = { collecte: 'collecte séparée des biodéchets par la collectivité', prestataire: `collecte par un prestataire${d.biodechets_presta ? ` (${d.biodechets_presta})` : ''}`, compost: 'compostage sur place' }[d.biodechets] || null;
  d.dechets_label = { municipale: 'collecte municipale', prestataire: `collecte par un prestataire${d.dechets_presta ? ` (${d.dechets_presta})` : ''}` }[d.dechets] || null;
  d.zones_presentes_labels = d.zones_presentes.map((z) => z.label.toLowerCase());
  for (const x of d.enceintes) x.cible = x.kind === 'neg' ? '-18 °C ou moins' : x.kind === 'sec' ? 'ambiante, au sec' : /fruit|légume/i.test(x.usage) ? '+4 à +8 °C' : '0 à +3 °C';
  d.enceintes_fl_noms = d.enceintes.filter((x) => x.kind === 'pos' && /fruit|légume/i.test(x.usage)).map((x) => x.nom);
  if (!d.enceintes_fl_noms.length && d.has.fl_enceinte) d.enceintes_fl_noms = ['enceinte fruits et légumes'];
  d.eau_label = d.has.eau_privee ? 'ressource privée (puits, forage), sous autorisation préfectorale' : 'réseau public de distribution d’eau potable';
  d.eau_analyse_aff = d.has.eau_privee ? ' ainsi que l’eau' : '';
  d.liaison_label = d.has.cellule ? 'liaison chaude directe et liaison froide (refroidissement en cellule)' : 'liaison chaude directe';
  d.biodechets_comment = d.biodechets === 'compost' ? 'Bac à compost' : 'Bac ou sac réservé aux biodéchets';
  d.activite.jours_aff = d.activite.horaires ? ` (${d.activite.horaires})` : '';
  d.has_neg_aff = d.has.froid_neg ? ', froid négatif' : '';
  d.livraison_circuit = d.has.livraison || d.has.emporter ? ', ou vers le conditionnement pour la vente à emporter et la livraison' : '';
  d.categories_detail = (d.categories || []).filter((c) => c && c.label).map((c) => ({ label: c.label, detail: c.detail || '' }));

  // Maintenance des installations : lignes déduites des équipements déclarés, prestataires saisis
  const presta = d.install_presta || {};
  const lignes = [];
  const addL = (key, cond, equipement, nature, frequence) => { if (cond) lignes.push({ equipement, nature, frequence, prestataire: presta[key] || '' }); };
  addL('hotte', d.install.hotte, 'Hotte et conduits d’extraction', 'Nettoyage des filtres (interne) ; nettoyage et ramonage des conduits', 'Filtres : chaque semaine ; conduits : 1 fois par an');
  addL('gaz', d.has.gaz, 'Installations et appareils au gaz', 'Vérification réglementaire', 'Selon le règlement de sécurité ERP');
  addL('fluides', d.install.fluides, 'Équipements frigorifiques (fluides frigorigènes)', 'Contrôle d’étanchéité et entretien', 'Selon la charge (6 à 24 mois)');
  addL('froid', d.has.froid_pos || d.has.froid_neg, 'Chambres et armoires froides', 'Entretien préventif, vérification des thermomètres', '1 fois par an');
  addL('cellule', d.has.cellule || d.install.cellule_surgel, 'Cellules de refroidissement / surgélation', 'Entretien préventif, vérification des sondes', '1 fois par an');
  addL('bac_graisse', d.install.bac_graisse, 'Bac à graisse', 'Vidange et curage', `Selon le volume et l’activité`);
  addL('monte_charge', d.install.monte_charge, 'Monte-charge', 'Entretien et vérifications réglementaires', 'Selon contrat');
  addL('lave_vaisselle', d.equip.lave_vaisselle, 'Lave-vaisselle', 'Entretien, détartrage, contrôle des températures', 'Selon contrat');
  addL('extincteurs', true, 'Extincteurs et moyens de secours', 'Vérification réglementaire', '1 fois par an');
  for (const m of d.maintenance) lignes.push({ equipement: m.equipement, nature: m.nature || '', frequence: m.frequence || '', prestataire: m.prestataire || '' });
  d.maintenance_lignes = lignes;

  // Plan de nettoyage : une table par zone présente, avec les surfaces usuelles
  const SURF = {
    commun: [['Sols', 'Balayage humide, lavage, rinçage', 'Après chaque service'], ['Murs, portes, poignées', 'Lavage, rinçage', 'Chaque semaine (poignées : chaque jour)'], ['Lave-mains et distributeurs', 'Nettoyage et désinfection', 'Chaque jour']],
    froide: [['Plans de travail', 'Détergent-désinfectant, rinçage si nécessaire', 'Après chaque utilisation'], ['Planches et ustensiles', 'Lave-vaisselle ou trempage désinfectant', 'Après chaque utilisation'], ['Trancheuse', 'Démontage, nettoyage, désinfection', 'Après chaque utilisation'], ['Saladette, tour réfrigéré', 'Nettoyage et désinfection', 'Chaque jour']],
    chaude: [['Plans de travail', 'Détergent-désinfectant', 'Après chaque utilisation'], ['Piano, plancha, grill', 'Dégraissage', 'Après chaque service'], ['Fours', 'Nettoyage, dégraissage', 'Chaque jour'], ['Hotte (filtres)', 'Dégraissage au lave-vaisselle ou par trempage', 'Chaque semaine'], ['Friteuse', 'Vidange, nettoyage', 'À chaque changement d’huile']],
    stockage_froid: [['Étagères et parois', 'Nettoyage et désinfection', 'Chaque semaine'], ['Joints de porte', 'Nettoyage et désinfection', 'Chaque semaine'], ['Sol', 'Lavage', 'Chaque jour']],
    reserve: [['Étagères', 'Nettoyage', 'Chaque mois'], ['Sol', 'Balayage humide, lavage', 'Chaque semaine']],
    plonge: [['Bacs de plonge', 'Nettoyage et désinfection', 'Après chaque service'], ['Lave-vaisselle', 'Vidange, nettoyage des filtres', 'Chaque jour'], ['Égouttoirs, étagères', 'Nettoyage et désinfection', 'Chaque jour']],
    local_poubelles: [['Conteneurs', 'Lavage et désinfection', 'Chaque semaine'], ['Sol et murs', 'Lavage et désinfection', 'Chaque semaine']],
    legumerie: [['Bacs de lavage', 'Nettoyage et désinfection', 'Après chaque utilisation'], ['Essoreuse, éplucheuse', 'Nettoyage et désinfection', 'Après chaque utilisation']],
    reception: [['Zone de réception', 'Balayage humide, lavage', 'Chaque jour']],
    vestiaires: [['Sanitaires', 'Nettoyage et désinfection', 'Chaque jour'], ['Vestiaires', 'Nettoyage', 'Chaque semaine']],
  };
  const zoneSurf = (k) => ({ froide: SURF.froide, preparation: SURF.froide, patisserie: SURF.froide, envoi: SURF.froide, chaude: SURF.chaude, stockage_froid: SURF.stockage_froid, reserve: SURF.reserve, plonge_batterie: SURF.plonge, plonge_vaisselle: SURF.plonge, local_poubelles: SURF.local_poubelles, legumerie: SURF.legumerie, deconditionnement: SURF.reserve, reception: SURF.reception, vestiaires: SURF.vestiaires })[k] || [];
  const zonesPlan = d.zones_presentes.length ? d.zones_presentes : ZONES.filter(([k]) => ['reception', 'stockage_froid', 'chaude', 'froide', 'plonge_vaisselle', 'local_poubelles'].includes(k)).map(([key, label]) => ({ key, label }));
  d.plan_nettoyage = zonesPlan.map((z) => ({
    zone: z.label,
    lignes: [...zoneSurf(z.key), ...(['local_poubelles', 'reception'].includes(z.key) ? SURF.commun.slice(0, 1) : SURF.commun)].map(([surface, methode, frequence]) => ({ surface, methode, frequence })),
  }));
  d.plan_nettoyage.push({ zone: 'Salle de restaurant', lignes: [['Tables, chaises', 'Nettoyage (lavette à usage unique ou lavée chaque jour)', 'Après chaque service'], ['Sols', 'Balayage humide, lavage', 'Chaque jour'], ['Cartes, menus, poignées', 'Nettoyage et désinfection', 'Chaque jour']].map(([surface, methode, frequence]) => ({ surface, methode, frequence })) });
  d.analyses_freq_label = { 1: 'une fois par an', 2: 'deux fois par an', 4: 'quatre fois par an' }[d.labo_freq || 2] || 'deux fois par an';
  return d;
}
