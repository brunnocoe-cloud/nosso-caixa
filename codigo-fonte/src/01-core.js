/* =====================================================================
   NÚCLEO: utilitários, estado, dados e regras de negócio
   ===================================================================== */
const VERSAO = '3.0';
const LOGO = 'NC';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = v => BRL.format(Number(v) || 0);
const fmtN = v => NUM.format(Number(v) || 0);          // estilo Meu Dinheiro: 1.234,56 / -1.234,56
const num = v => Number(v) || 0;
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const p2 = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dStr = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hoje = () => dStr(new Date());
const ymHoje = () => hoje().slice(0, 7);
const addMeses = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${p2(m)}`; };
const diasNoMes = (y, m) => new Date(y, m, 0).getDate();
const dataNoMes = (ym, dia) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${p2(Math.min(dia, diasNoMes(y, m)))}`; };
const addMesesData = (ds, n) => dataNoMes(addMeses(ds.slice(0, 7), n), +ds.slice(8, 10));
const addDias = (ds, n) => { const d = new Date(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10) + n); return dStr(d); };
const fimMes = ym => dataNoMes(ym, 31);
const iniMes = ym => ym + '-01';
const difDias = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = MESES.map(m => m.slice(0, 3));
const nomeMes = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} ${y}`; };
const mesCurto = ym => { const [y, m] = ym.split('-'); return `${MES3[+m - 1]}/${y.slice(2)}`; };
const dataBR = ds => ds ? `${ds.slice(8, 10)}/${ds.slice(5, 7)}/${ds.slice(0, 4)}` : '';
const dataCurta = ds => ds ? (ds === hoje() ? 'hoje' : `${ds.slice(8, 10)}/${ds.slice(5, 7)}/${ds.slice(2, 4)}`) : '';
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const diaSemana = ds => DIAS[new Date(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10)).getDay()];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const soma = (arr, f = x => x.valor) => r2(arr.reduce((a, x) => a + num(f(x)), 0));
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const lsJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const corV = v => v < 0 ? 'neg' : v > 0 ? 'pos' : '';
const vH = (v, cls = '') => `<span class="num v ${cls || corV(v)}">${fmtN(v)}</span>`;

// número em pt-BR, aceitando contas simples: "10,50+3*2"
function parseValor(s) {
  s = String(s ?? '').replace(/[R$\s]/g, '');
  if (!s) return NaN;
  const norm = t => {
    if (t.includes(',')) return t.replace(/\./g, '').replace(',', '.');
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, '');
    return t;
  };
  if (/^-?[\d.,]+$/.test(s)) return r2(parseFloat(norm(s)));
  if (!/^[\d.,+\-*/()]+$/.test(s)) return NaN;
  const expr = s.replace(/[\d.,]+/g, norm);
  try { const v = Function('"use strict";return (' + expr + ')')(); return isFinite(v) ? r2(v) : NaN; } catch { return NaN; }
}
const valorInput = v => (v === null || v === undefined || v === '') ? '' : NUM.format(num(v));

const PALETA = ['#1e88e5', '#ef6c00', '#2e7d32', '#c62828', '#6a1b9a', '#00838f', '#ad1457', '#558b2f', '#d84315', '#455a64', '#8d6e63', '#3949ab', '#f9a825', '#00897b', '#7b1fa2', '#5d4037'];

const ICON = {
  visao: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  mov: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  fluxo: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  taskok: '<path d="M4 12.5l4.5 4.5L20 6"/>',
  extrato: '<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
  cartao: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M14.5 2.6A9 9 0 0 1 21.4 9.5h-6.9z"/>',
  savings: '<path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1-1 3h-3v-2h-4v2H7l-1-3c-1-1-1-2-1-3z"/><path d="M15 9h.01"/>',
  relat: '<path d="M4 20V11M10 20V4M16 20v-8M22 20H2"/>',
  cad: '<path d="M4 5h16v5H4zM4 14h16v5H4z"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  categ: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="M6.5 14l3.5 6h-7z"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  banco: '<path d="M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M2 21h20M12 3l9 5H3z"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  magic: '<path d="M4 20L16 8M14 4l1.5-1.5M19 9l1.5-1.5M14 2v2M20 8h2M18 2l1 1"/><path d="M15 9l-1-1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down2: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  transf: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  hub: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkc: '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  dcheck: '<path d="M2 12.5l4.5 4.5L15 8"/><path d="M10 15.5l1.5 1.5L22 7"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  car: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  rep: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.7M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  dl: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  sort: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chart: '<path d="M21 12A9 9 0 1 1 12 3v9z"/>',
  ajsal: '<path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2 2.6 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  sub: '<path d="M6 4v9a3 3 0 0 0 3 3h9M15 13l3 3-3 3"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24">${ICON[n] || ''}</svg>`;

const TIPOS_CONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', carteira: 'Carteira / dinheiro', investimento: 'Investimento', ativos: 'Carteira de ativos', outra: 'Outra' };

/* ---------------- estado ---------------- */
const TABELAS = ['contas', 'cartoes', 'categorias', 'tags', 'lancamentos', 'orcamentos', 'metas', 'regras'];
const S = {
  contas: [], cartoes: [], categorias: [], tags: [], lancamentos: [], orcamentos: [], metas: [], regras: [], prefs: {},
  mes: ymHoje(), view: 'visao', carregadoEm: 0, uid: null,
  contasSel: null,            // filtro de contas nos painéis (Set de ids) — null = todas
  status: new Set(),          // filtro de status nas listas
  busca: '', aba: {}, extratoConta: null, cartaoSel: null, faturaSel: {}, fluxoModo: lsGet('nc_fluxo') || 'semana', fluxoIni: null,
  cartaoFiltro: { conc: new Set(), titular: '', ordem: 'data', grafico: false }, catTipo: 'despesa', catAtivas: true,
  relatorio: null, relParams: {},
};
let sb = null;
let charts = [];

const byId = (lista, id) => id ? S[lista].find(x => x.id === id) : undefined;
const contasAtivas = () => S.contas.filter(c => !c.arquivada);
const cartoesAtivos = () => S.cartoes.filter(c => !c.arquivado);
const recurso = k => (S.prefs.recursos || {})[k] !== false;
const contasFiltradas = () => contasAtivas().filter(c => !S.contasSel || S.contasSel.has(c.id));

/* ---------------- categorias (com subcategorias) ---------------- */
const catById = id => byId('categorias', id);
const catRaiz = id => { const c = catById(id); return c?.parent_id ? catById(c.parent_id) || c : c; };
function nomeCat(id) {
  const c = catById(id);
  if (!c) return 'Sem categoria';
  const p = c.parent_id ? catById(c.parent_id) : null;
  return p ? `${p.nome}/${c.nome}` : c.nome;
}
const corCat = id => catById(id)?.cor || catRaiz(id)?.cor || '#9aa0a6';
const ordenaNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
// lista em árvore: pais seguidos das subcategorias
function arvoreCategorias(tipo, soAtivas = false, extraId = null) {
  const todas = S.categorias.filter(c => c.tipo === tipo && (!soAtivas || c.ativa !== false || c.id === extraId));
  const pais = todas.filter(c => !c.parent_id || !todas.some(p => p.id === c.parent_id)).sort(ordenaNome);
  const out = [];
  for (const p of pais) { out.push({ c: p, nivel: 0 }); todas.filter(s => s.parent_id === p.id).sort(ordenaNome).forEach(s => out.push({ c: s, nivel: 1 })); }
  return out;
}
const optsCategoria = (tipo, sel, vazio = 'Sem categoria') => `<option value="">${vazio}</option>` +
  arvoreCategorias(tipo, true, sel).map(({ c, nivel }) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${nivel ? '    ↳ ' : ''}${esc(c.nome)}</option>`).join('');

/* ---------------- saldos ---------------- */
// efeito de um lançamento no saldo de uma conta (compras no cartão não mexem na conta)
function efeitoConta(l, contaId) {
  const v = num(l.valor);
  if (l.cartao_id && l.tipo !== 'pagamento_fatura') return 0;
  if (l.tipo === 'receita' && l.conta_id === contaId) return v;
  if (l.tipo === 'despesa' && l.conta_id === contaId) return -v;
  if (l.tipo === 'pagamento_fatura' && l.conta_id === contaId) return -v;
  if (l.tipo === 'transferencia') {
    if (l.conta_id === contaId) return -v;
    if (l.conta_destino_id === contaId) return v;
  }
  return 0;
}
// opts.ate: até a data (inclusive) · opts.pendentes: inclui não confirmados · opts.antes: antes da data
function saldoConta(contaId, opts = {}) {
  const c = byId('contas', contaId);
  let s = num(c?.saldo_inicial);
  for (const l of S.lancamentos) {
    if (!l.pago && !opts.pendentes) continue;
    if (opts.ate && l.data > opts.ate) continue;
    if (opts.antes && l.data >= opts.antes) continue;
    s += efeitoConta(l, contaId);
  }
  return r2(s);
}
const ehCaixa = l => !l.cartao_id || l.tipo === 'pagamento_fatura';
const tocaContas = (l, ids) => ids.some(id => efeitoConta(l, id) !== 0) || (ids.includes(l.conta_id) && ehCaixa(l)) || ids.includes(l.conta_destino_id);
// status no estilo Meu Dinheiro
function statusL(l) {
  if (l.pago) return l.conciliado ? 'conciliado' : 'confirmado';
  return l.data > hoje() ? 'agendado' : 'pendente';
}
const STATUS_N = { pendente: 'Pendentes', agendado: 'Agendados', confirmado: 'Confirmados', conciliado: 'Conciliados' };
const passaStatus = (l, set) => !set.size || set.has(statusL(l));
const ehEntrada = (l, ids) => ids.reduce((a, id) => a + efeitoConta(l, id), 0) > 0;

/* ---------------- cartões e faturas ---------------- */
function faturaYMcalc(cartao, ds) {
  const ym = ds.slice(0, 7), d = +ds.slice(8, 10);
  const [y, m] = ym.split('-').map(Number);
  const fech = Math.min(cartao.dia_fechamento, diasNoMes(y, m));
  const fechYM = d >= fech ? addMeses(ym, 1) : ym;
  return cartao.dia_vencimento > cartao.dia_fechamento ? fechYM : addMeses(fechYM, 1);
}
// fatura em que cai uma compra (pula faturas fechadas manualmente)
function faturaYM(cartao, ds) {
  let fy = faturaYMcalc(cartao, ds);
  const fech = cartao.faturas_fechadas || [];
  for (let i = 0; i < 24 && fech.includes(fy); i++) fy = addMeses(fy, 1);
  return fy;
}
const fatMes = l => (l.fatura_mes || '').slice(0, 7);
const datasFatura = (c, fym) => {
  const fechYM = c.dia_vencimento > c.dia_fechamento ? fym : addMeses(fym, -1);
  return { fechamento: dataNoMes(fechYM, c.dia_fechamento), vencimento: dataNoMes(fym, c.dia_vencimento) };
};
let _fatCache = new Map();
function faturaInfo(c, fym) {
  const key = c.id + fym + S.carregadoEm + (S.prefs.faturas_base || '');
  if (_fatCache.has(key)) return _fatCache.get(key);
  const doCartao = S.lancamentos.filter(l => l.cartao_id === c.id);
  const itens = doCartao.filter(l => (l.tipo === 'despesa' || l.tipo === 'receita') && fatMes(l) === fym)
    .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  const pagamentos = doCartao.filter(l => l.tipo === 'pagamento_fatura' && fatMes(l) === fym);
  const despesas = soma(itens.filter(l => l.tipo === 'despesa')), creditos = soma(itens.filter(l => l.tipo === 'receita'));
  const total = r2(despesas - creditos);
  const pago = soma(pagamentos.filter(p => p.pago));
  // saldo anterior = o que ficou sem pagar na fatura anterior
  const meses = [...new Set(doCartao.map(fatMes).filter(Boolean))].sort();
  let saldoAnterior = 0;
  // faturas até a "base" (histórico importado) são consideradas quitadas, como no Meu Dinheiro
  const base = S.prefs.faturas_base || '';
  if (meses.length && meses[0] < fym) {
    const prev = addMeses(fym, -1);
    saldoAnterior = prev >= meses[0] && prev > base ? faturaInfo(c, prev).aPagar : 0;
  }
  const aPagar = r2(Math.max(0, saldoAnterior + total - pago));
  const { fechamento, vencimento } = datasFatura(c, fym);
  const h = hoje();
  const fechadaManual = (c.faturas_fechadas || []).includes(fym);
  let status;
  if (total <= 0 && saldoAnterior <= 0) status = pago > 0 ? 'paga' : 'vazia';
  else if (aPagar <= 0.004) status = 'paga';
  else if (h > vencimento) status = 'vencida';
  else if (h >= fechamento || fechadaManual) status = 'fechada';
  else status = 'aberta';
  const conciliado = soma(itens.filter(l => l.conciliado), l => l.tipo === 'despesa' ? l.valor : -l.valor);
  const fixas = soma(itens.filter(l => (l.serie || '').startsWith('fixa')), l => l.tipo === 'despesa' ? l.valor : -l.valor);
  const res = { itens, pagamentos, despesas, creditos, total, pago, saldoAnterior, aPagar, fechamento, vencimento, status, fechadaManual, conciliado, naoConciliado: r2(total - conciliado), fixas };
  _fatCache.set(key, res);
  return res;
}
// limite usado = valor a pagar da fatura atual (com o que ficou das anteriores) + parcelas futuras
function usoCartao(c) {
  const cur = faturaYM(c, hoje());
  const futuras = S.lancamentos.filter(l => l.cartao_id === c.id && l.serie === 'parcelada' && fatMes(l) > cur);
  const usado = r2(Math.max(0, faturaInfo(c, cur).aPagar + soma(futuras.filter(l => l.tipo === 'despesa')) - soma(futuras.filter(l => l.tipo === 'receita'))));
  return { usado, disponivel: r2(num(c.limite) - usado) };
}
const STATUS_FAT = { aberta: 'Aberta', fechada: 'Fechada', vencida: 'Vencida', paga: 'Paga', vazia: 'Sem lançamentos' };
const corFat = { aberta: 'var(--link)', fechada: 'var(--warn)', vencida: 'var(--late)', paga: 'var(--pos)', vazia: 'var(--muted)' };
const chipFat = st => `<span class="chip" style="color:${corFat[st]}">${STATUS_FAT[st]}</span>`;

/* ---------------- agregações ---------------- */
const noMes = (l, ym) => l.data.slice(0, 7) === ym;
const noPeriodo = (l, ini, fim) => l.data >= ini && l.data <= fim;
// competência: receitas/despesas (inclui compras no cartão pela data da compra)
const receitasPer = (ini, fim) => S.lancamentos.filter(l => l.tipo === 'receita' && !l.cartao_id && noPeriodo(l, ini, fim));
const despesasPer = (ini, fim) => S.lancamentos.filter(l => l.tipo === 'despesa' && noPeriodo(l, ini, fim));
function porCategoria(lista, raiz = true) {
  const m = new Map();
  for (const l of lista) {
    const c = raiz ? catRaiz(l.categoria_id) : catById(l.categoria_id);
    const k = c?.id || '_';
    const v = l.cartao_id && l.tipo === 'receita' ? -num(l.valor) : num(l.valor);
    m.set(k, (m.get(k) || 0) + v);
  }
  return [...m.entries()].map(([id, v]) => ({ id, v: r2(v), cat: catById(id), nome: id === '_' ? 'Sem categoria' : (raiz ? catById(id)?.nome : nomeCat(id)), cor: id === '_' ? '#9aa0a6' : corCat(id) }))
    .sort((a, b) => b.v - a.v);
}
function ondeTexto(l) {
  if (l.tipo === 'transferencia') return `${byId('contas', l.conta_id)?.nome || '?'} → ${byId('contas', l.conta_destino_id)?.nome || '?'}`;
  if (l.tipo === 'pagamento_fatura') return `${byId('contas', l.conta_id)?.nome || ''} ⇄ ${byId('cartoes', l.cartao_id)?.nome || ''}`;
  if (l.cartao_id) return byId('cartoes', l.cartao_id)?.nome || 'Cartão';
  return byId('contas', l.conta_id)?.nome || '';
}

/* ---------------- fechamento de posição ---------------- */
function fechadoAte(l) {
  const datas = [S.prefs.fechamento_global];
  for (const id of [l.conta_id, l.conta_destino_id]) if (id) datas.push(byId('contas', id)?.fechado_ate);
  if (l.cartao_id) datas.push(byId('cartoes', l.cartao_id)?.fechado_ate);
  return datas.filter(Boolean).sort().pop() || null;
}
const bloqueado = l => { const f = fechadoAte(l); return f && l.data <= f ? f : null; };

/* ---------------- regras de preenchimento ---------------- */
function regraPara(desc, tipo) {
  const d = semAcento(desc);
  if (!d) return null;
  const rs = S.regras.filter(r => r.tipo === tipo);
  return rs.find(r => semAcento(r.descricao) === d)
    || rs.find(r => (r.palavras || '').split(/[,;\n]/).map(semAcento).filter(Boolean).some(p => d.includes(p)))
    || rs.find(r => semAcento(r.descricao).length >= 4 && d.includes(semAcento(r.descricao)))
    || null;
}

/* ---------------- dados (Supabase) ---------------- */
async function fetchAll(t) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await sb.from(t).select('*').order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}
async function carregar(tabelas = TABELAS) {
  const res = await Promise.all(tabelas.map(fetchAll));
  tabelas.forEach((t, i) => S[t] = res[i]);
  S.carregadoEm = Date.now(); _fatCache = new Map();
}
async function carregarPrefs() {
  const { data, error } = await sb.from('preferencias').select('*').limit(1);
  if (error) throw error;
  if (data?.length) S.prefs = data[0].dados || {};
  else { S.prefs = { recursos: { tags: true, orcamento: true, economia: true, cartoes: true } }; await sb.from('preferencias').insert({ dados: S.prefs }); }
}
async function salvarPrefs(msg) {
  await op(sb.from('preferencias').update({ dados: S.prefs }).eq('user_id', S.uid), msg);
}
async function op(promessa, msgOk) {
  const { error, data } = await promessa;
  if (error) { toast('Erro: ' + traduzErro(error), true); throw error; }
  if (msgOk) toast(msgOk);
  return data;
}
async function salvar(tabela, dados, id, msg) {
  if (id) await op(sb.from(tabela).update(dados).eq('id', id), msg);
  else await op(sb.from(tabela).insert(dados), msg);
}
async function excluir(tabela, ids, msg) {
  ids = Array.isArray(ids) ? ids : [ids];
  for (let i = 0; i < ids.length; i += 200) await op(sb.from(tabela).delete().in('id', ids.slice(i, i + 200)), i + 200 >= ids.length ? msg : null);
}
async function inserirMuitos(tabela, linhas, msg) {
  for (let i = 0; i < linhas.length; i += 400) await op(sb.from(tabela).insert(linhas.slice(i, i + 400)), i + 400 >= linhas.length ? msg : null);
}
async function recarregarERender(tabelas) {
  try { await carregar(tabelas); } catch (e) { toast('Erro ao atualizar: ' + traduzErro(e), true); }
  render();
}

// categorias iniciais (mesma estrutura usada pela família no Meu Dinheiro)
const CATEGORIAS_INICIAIS = {
  despesa: ['Aniversário Alice', 'Automóvel', 'Bem Estar', 'Educação', 'Empregados', 'Empréstimos', 'Energia Elétrica', 'Familiares Diversas', 'Festas',
    'Financiamento imobiliário', 'Fundo de Reserva', 'Impostos e Tarifas', ['Investimentos', ['Custódia', 'Custos operacionais', 'IOF', 'IR', 'Perdas']],
    'Lazer', 'Moradia', 'Outras Despesas', 'Pagamento Financiamento de Dívidas', ['Pessoais', ['Alice', 'Bruno', 'Iraci', 'Pedro', 'Rúbia']],
    'Presentes', 'Previdência', 'Restaurantes/Lanches', 'Saúde', 'Seguros', 'Supérfluo', 'Supermercado', 'Telefonia', 'Transporte', 'Utilidades Domésticas', 'Vestuário'],
  receita: ['Aluguel', ['Investimentos', ['Bonificação', 'Dividendos', 'JSCP', 'Juros', 'Proventos de ações', 'Proventos de fundos', 'Rendimentos']],
    'Lucros', 'Outras Receitas', 'Pró-labore', 'Salário'],
};
async function semearCategorias() {
  let i = 0;
  const pais = [], filhos = [];
  for (const tipo of ['despesa', 'receita']) for (const item of CATEGORIAS_INICIAIS[tipo]) {
    const [nome, subs] = Array.isArray(item) ? item : [item, []];
    const id = uuid();
    pais.push({ id, nome, tipo, cor: PALETA[i++ % PALETA.length] });
    subs.forEach(s => filhos.push({ nome: s, tipo, parent_id: id, cor: PALETA[(i + 3) % PALETA.length] }));
  }
  await op(sb.from('categorias').insert(pais));
  if (filhos.length) await op(sb.from('categorias').insert(filhos));
  S.categorias = await fetchAll('categorias');
}
// séries "Fixa": mantém lançamentos gerados até 24 meses à frente, respeitando o intervalo
// da série (mensal, trimestral, anual…) e só continuando as que ainda estão ativas
const difMeses = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
async function estenderFixas() {
  const grupos = new Map();
  for (const l of S.lancamentos) if (l.grupo_id && (l.serie === 'fixa' || l.serie === 'fixa_fim')) {
    if (!grupos.has(l.grupo_id)) grupos.set(l.grupo_id, []);
    grupos.get(l.grupo_id).push(l);
  }
  const limite = addMesesData(hoje(), 24), novos = [];
  for (const ls of grupos.values()) {
    if (ls.some(l => l.serie === 'fixa_fim')) continue;
    ls.sort((a, b) => a.data < b.data ? -1 : 1);
    // intervalo mais comum entre ocorrências (padrão: 1 mês)
    const gaps = {}; for (let i = 1; i < ls.length; i++) { const g = difMeses(ls[i - 1].data, ls[i].data); if (g > 0) gaps[g] = (gaps[g] || 0) + 1; }
    const gap = +(Object.entries(gaps).sort((a, b) => b[1] - a[1])[0]?.[0] || 1);
    const ult = ls[ls.length - 1];
    // série encerrada: a última ocorrência ficou bem antes do horizonte de 24 meses
    if (difMeses(ult.data, limite) > gap + 1) continue;
    const base = { ...ult }; ['id', 'criado_em', 'user_id'].forEach(x => delete base[x]);
    for (let k = 1; k < 200; k++) {
      const nd = addMesesData(ult.data, k * gap);
      if (nd > limite) break;
      const n = { ...base, data: nd, pago: false, conciliado: false, anexos: [], ext_id: null };
      if (base.cartao_id) { const c = byId('cartoes', base.cartao_id); if (c) n.fatura_mes = faturaYM(c, nd) + '-01'; }
      novos.push(n);
    }
  }
  if (novos.length) { await inserirMuitos('lancamentos', novos); S.lancamentos = await fetchAll('lancamentos'); S.carregadoEm = Date.now(); _fatCache = new Map(); }
}
