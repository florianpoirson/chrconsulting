// Évaluateur d'expressions des conditions du modèle (@if) : sans eval, grammaire minimale.
// Opérateurs : ! && || == != < <= > >= ( ), littéraux 'texte' "texte" nombres true false, chemins a.b.c
const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(&&|\|\||==|!=|<=|>=|[!<>()])|([A-Za-z_][\w.]*))/y;

function tokenize(src) {
  const out = []; TOKEN.lastIndex = 0; let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos; const m = TOKEN.exec(src);
    if (!m) throw new Error(`Condition illisible : « ${src} » (position ${pos})`);
    pos = TOKEN.lastIndex;
    if (m[1]) out.push({ k: 'num', v: Number(m[1]) });
    else if (m[2]) out.push({ k: 'str', v: m[2].slice(1, -1).replace(/\\(.)/g, '$1') });
    else if (m[3]) out.push({ k: 'op', v: m[3] });
    else out.push({ k: 'id', v: m[4] });
  }
  return out;
}

export function getPath(data, path) {
  let cur = data;
  for (const p of path.split('.')) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}

export function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.values(v).some(truthy);
  return !!v && v !== '0' && v !== 'non';
}

export function compile(src) {
  const t = tokenize(src); let i = 0;
  const peek = () => t[i], next = () => t[i++];
  const expect = (v) => { const x = next(); if (!x || x.v !== v) throw new Error(`« ${v} » attendu dans « ${src} »`); };
  function primary() {
    const x = next();
    if (!x) throw new Error(`Condition incomplète : « ${src} »`);
    if (x.k === 'op' && x.v === '(') { const e = or(); expect(')'); return e; }
    if (x.k === 'op' && x.v === '!') { const e = primary(); return (d) => !truthy(e(d)); }
    if (x.k === 'num' || x.k === 'str') return () => x.v;
    if (x.k === 'id') {
      if (x.v === 'true') return () => true;
      if (x.v === 'false') return () => false;
      return (d) => getPath(d, x.v);
    }
    throw new Error(`Symbole inattendu « ${x.v} » dans « ${src} »`);
  }
  function cmp() {
    const a = primary(); const o = peek();
    if (o && o.k === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(o.v)) {
      next(); const b = primary();
      return (d) => {
        const x = a(d), y = b(d);
        switch (o.v) {
          case '==': return x == y; case '!=': return x != y;   // eslint-disable-line eqeqeq
          case '<': return Number(x) < Number(y); case '<=': return Number(x) <= Number(y);
          case '>': return Number(x) > Number(y); default: return Number(x) >= Number(y);
        }
      };
    }
    return a;
  }
  function and() { let a = cmp(); while (peek() && peek().v === '&&') { next(); const l = a, r = cmp(); a = (d) => truthy(l(d)) && truthy(r(d)); } return a; }
  function or() { let a = and(); while (peek() && peek().v === '||') { next(); const l = a, r = and(); a = (d) => truthy(l(d)) || truthy(r(d)); } return a; }
  const fn = or();
  if (i < t.length) throw new Error(`Fin de condition attendue dans « ${src} »`);
  return (d) => truthy(fn(d));
}
