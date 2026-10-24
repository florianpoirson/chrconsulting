// Assemblage : arbre du modèle + données de l'établissement → liste de blocs prêts à mettre en page.
// Conditions évaluées, variables remplacées, fiches numérotées dans l'ordre d'apparition, renvois résolus.
import { compile, getPath } from './expr.js';
import { typo } from './typo.js';

const BLANK = '……………………';
const condCache = new Map();
const evalCond = (src, scope) => {
  let fn = condCache.get(src);
  if (!fn) { fn = compile(src); condCache.set(src, fn); }
  return fn(scope.data);
};

function fmt(v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== '').join(', ');
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

function lookup(scope, path) {
  if (scope.item) {
    const p = path.startsWith('it.') ? path.slice(3) : path;
    const v = getPath(scope.item, p);
    if (v !== undefined || path.startsWith('it.')) return v;
  }
  return getPath(scope.data, path);
}

// Texte → segments { text, bold }
export function runs(text, scope, refs) {
  const out = [];
  const parts = String(text).split('**');
  parts.forEach((seg, k) => {
    if (!seg) return;
    let s = seg.replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_, p, def) => {
      const v = fmt(lookup(scope, p));
      return v ?? (def !== undefined ? def : BLANK);
    });
    s = s.replace(/\[\[(fiches?):([\w,-]+)\]\]/g, (_, kind, ids) => refs.label(ids.split(',')));
    out.push({ text: typo(s), bold: k % 2 === 1 });
  });
  return out.length ? out : [{ text: '' }];
}

function walk(nodes, scope, visit) {
  for (const n of nodes) {
    if (n.t === 'if') {
      const b = n.branches.find((br) => br.cond == null || evalCond(br.cond, scope));
      if (b) walk(b.children, scope, visit);
    } else if (n.t === 'each') {
      const list = lookup(scope, n.list) || [];
      list.forEach((item, idx) => walk(n.children, { ...scope, item: { ...item, index: idx + 1 } }, visit));
    } else visit(n, scope);
  }
}

export function assemble(tree, data) {
  // 1er passage : fiches retenues, dans l'ordre
  const fiches = [];
  const collect = (nodes, scope) => walk(nodes, scope, (n, sc) => {
    if (n.t === 'fiche') { fiches.push({ id: n.id, title: n.title }); collect(n.children, sc); }
    else if (n.children) collect(n.children, sc);
  });
  collect(tree.children, { data });
  const num = new Map(fiches.map((f, i) => [f.id, i + 1]));
  fiches.forEach((f, i) => { f.num = i + 1; });

  const refs = {
    label(ids) {
      const ns = ids.map((id) => num.get(id)).filter(Boolean);
      if (!ns.length) return 'fiche correspondante';
      if (ns.length === 1) return `Fiche n° ${ns[0]}`;
      return `Fiches n° ${ns.slice(0, -1).join(', ')} et ${ns[ns.length - 1]}`;
    },
    missing: new Set(),
  };

  const blocks = [];
  let list = null;   // liste en cours de constitution
  const flush = () => { list = null; };

  function tableBlock(n, scope) {
    const rows = [];
    let ncol = 0;
    const cellOut = (c, sc) => ({ runs: runs(c.text, sc, refs), head: !!c.head, bold: !!c.bold, fill: !!c.fill, span: c.span || 1, center: !!c.center });
    let counter = 0;
    const rowsOf = (items, sc) => walk(items, sc, (r, s2) => {
      if (r.t === 'row') {
        const numbered = r.cells.some((c) => c.text.includes('{{#}}'));
        if (numbered) counter++;
        const cells = r.cells.map((c) => cellOut(numbered ? { ...c, text: c.text.replace('{{#}}', String(counter)) } : c, s2)); ncol = Math.max(ncol, cells.reduce((a, c) => a + c.span, 0)); rows.push(cells); }
      else if (r.t === 'blank') { for (let k = 0; k < r.n; k++) rows.push(null); }
      else if (r.t === 'rows') {
        const items = lookup(s2, r.list) || [];
        items.forEach((item, idx) => { const cells = r.row.map((c) => cellOut(c, { ...s2, item: { ...item, index: idx + 1 } })); rows.push(cells); });
        for (let k = items.length; k < r.min; k++) rows.push(null);
      }
    });
    rowsOf(n.rows, scope);
    const filled = rows.map((r) => r || Array.from({ length: ncol }, () => ({ runs: [{ text: ' ' }], span: 1 })));
    return { t: 'table', widths: n.widths, header: Math.min(n.header, filled.length), style: n.style, font: n.font, rowHeight: n.rowHeight, rows: filled, ncol };
  }

  function emit(nodes, scope) {
    walk(nodes, scope, (n, sc) => {
      switch (n.t) {
        case 'li': case 'oli': {
          const kind = n.t === 'li' ? 'ul' : 'ol';
          if (!list || list.t !== kind) { list = { t: kind, items: [] }; blocks.push(list); }
          list.items.push({ level: n.level, n: n.n, runs: runs(n.text, sc, refs) });
          return;
        }
        default: flush();
      }
      switch (n.t) {
        case 'part': case 'h1': case 'h2': case 'h3': case 'h4':
          blocks.push({ t: n.t, text: typo(runs(n.text, sc, refs).map((r) => r.text).join('')) }); break;
        case 'p': blocks.push({ t: 'p', runs: runs(n.text, sc, refs) }); break;
        case 'callout': blocks.push({ t: 'callout', style: n.style, runs: runs(n.text, sc, refs) }); break;
        case 'ref': {
          const items = n.ids.map((id) => fiches.find((f) => f.id === id)).filter(Boolean);
          if (!items.length) break;
          const text = items.length === 1 ? `Voir Fiche n° ${items[0].num} : ${items[0].title}` : `Voir ${refs.label(n.ids)}`;
          blocks.push({ t: 'ref', text: typo(text + (n.extra ? ' ' + n.extra : '')) }); break;
        }
        case 'table': blocks.push(tableBlock(n, sc)); break;
        case 'fiche': {
          const f = fiches.find((x) => x.id === n.id);
          blocks.push({ t: 'fiche', num: f.num, id: f.id, title: typo(f.title) });
          emit(n.children, sc); flush();
          blocks.push({ t: 'fiche-end' }); break;
        }
        case 'proto': blocks.push({ t: 'proto', title: typo(n.title) }); emit(n.children, sc); flush(); blocks.push({ t: 'proto-end' }); break;
        case 'pagebreak': blocks.push({ t: 'pagebreak' }); break;
        case 'toc': blocks.push({ t: 'toc' }); break;
        case 'cover': blocks.push({ t: 'cover' }); break;
        case 'space': blocks.push({ t: 'space', n: n.n }); break;
        case 'sign': blocks.push({ t: 'sign', text: typo(n.text) }); break;
        case 'field': blocks.push({ t: 'field', runs: runs(n.text, sc, refs) }); break;
        default: throw new Error(`bloc inconnu ${n.t}`);
      }
    });
  }
  emit(tree.children, { data });
  flush();
  return { blocks, fiches };
}

// Document « Protocoles » : chaque zone @proto devient une page d'affichage
export function protocols(assembled) {
  const out = []; let cur = null; let depth = 0;
  for (const b of assembled.blocks) {
    if (b.t === 'proto') { cur = { title: b.title, blocks: [] }; depth = 0; continue; }
    if (b.t === 'proto-end') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (b.t === 'fiche') { depth++; continue; }
    if (b.t === 'fiche-end') { depth--; continue; }
    if (b.t === 'pagebreak' || b.t === 'toc' || b.t === 'cover') continue;
    cur.blocks.push(b);
  }
  return out;
}
