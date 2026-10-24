// Typographie française : espaces insécables, apostrophes courbes, ligature œ.
const NBSP = ' ', NNBSP = ' ';

const OE_WORDS = [
  ['coeur', 'cœur'], ['oeuvre', 'œuvre'], ['manoeuvre', 'manœuvre'], ['oeufs', 'œufs'], ['oeuf', 'œuf'],
  ['boeuf', 'bœuf'], ['oeil', 'œil'], ['soeur', 'sœur'], ['voeu', 'vœu'], ['oesophage', 'œsophage'],
];
const OE_RE = OE_WORDS.map(([a, b]) => [new RegExp(`(^|[^\\p{L}])(${a})`, 'giu'), b]);

function keepCase(src, rep) { return src[0] === src[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep; }

export function typo(s) {
  if (s == null || s === '') return s;
  let t = String(s);
  // Apostrophes droites → courbes
  t = t.replace(/(\p{L})'(\p{L})/gu, '$1’$2').replace(/(\p{L})'/gu, '$1’');
  // Ligature œ
  for (const [re, rep] of OE_RE) t = t.replace(re, (m, pre, w) => pre + keepCase(w, rep));
  // Guillemets droits "…" → « … »
  t = t.replace(/"([^"]+)"/g, '«$1»');
  t = t.replace(/«[   ]*/g, `«${NNBSP}`).replace(/[   ]*»/g, `${NNBSP}»`);
  // ; ! ? → espace fine insécable avant
  t = t.replace(/([^\s;!?])[   ]*([;!?])(?=[\s)»]|$)/g, `$1${NNBSP}$2`);
  // : → espace insécable avant (hors heures 10:30 et adresses web)
  t = t.replace(/([^\s:])[   ]*:(?=[\s"«]|$)/g, `$1${NBSP}:`);
  // Unités et numéros
  t = t.replace(/(\d)[  ]*°[  ]?C\b/g, `$1${NBSP}°C`).replace(/(\d)[  ]*%/g, `$1${NNBSP}%`).replace(/(\d)[  ]*€/g, `$1${NBSP}€`);
  t = t.replace(/\b([nN])°[  ]*(\d)/g, `$1°${NBSP}$2`);
  t = t.replace(/\.\.\./g, '…');
  return t;
}
