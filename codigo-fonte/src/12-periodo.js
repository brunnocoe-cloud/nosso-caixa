/* =====================================================================
   FILTRO DE PERÍODO (Extrato de contas e Cartões de crédito)
   modos: fatura (só cartões), mes, dia, periodo (de/até), ano
   ===================================================================== */
const PER = {
  extrato: { modo: 'mes', dia: null, sem: null, de: null, ate: null, ano: null, desc: false },
  cartoes: { modo: 'fatura', mes: null, dia: null, sem: null, de: null, ate: null, ano: null, desc: false },
};
try { const sv = JSON.parse(localStorage.getItem('nc_per') || '{}'); for (const k of Object.keys(PER)) { if (sv[k]?.modo) PER[k].modo = sv[k].modo; PER[k].desc = !!sv[k]?.desc; } } catch { /* sem armazenamento */ }
const perSalvar = () => { try { localStorage.setItem('nc_per', JSON.stringify({ extrato: { modo: PER.extrato.modo, desc: PER.extrato.desc }, cartoes: { modo: PER.cartoes.modo, desc: PER.cartoes.desc } })); } catch { /* ignora */ } };
const MODOS_N = { fatura: 'Fatura', mes: 'Mês', semana: 'Semana', dia: 'Dia', periodo: 'Período', ano: 'Ano' };
// semana de segunda a domingo
const iniSemana = ds => { const d = new Date(ds + 'T12:00:00'); const w = (d.getDay() + 6) % 7; return addDias(ds, -w); };

// mês "corrente" de cada tela: extrato usa o mês global (S.mes); cartões guardam o seu
const perMes = k => k === 'extrato' ? S.mes : (PER[k].mes || ymHoje());
function perIntervalo(k) {
  const p = PER[k], h = hoje();
  if (p.modo === 'dia') { const d = p.dia || h; return { ini: d, fim: d, rotulo: `${diaSemana(d)}, ${dataBR(d)}` }; }
  if (p.modo === 'semana') { const a = p.sem || iniSemana(h), b = addDias(a, 6); return { ini: a, fim: b, rotulo: `${dataBR(a).slice(0, 5)} – ${dataBR(b)}` }; }
  if (p.modo === 'periodo') {
    const de = p.de || iniMes(ymHoje()), ate = p.ate || h;
    const [a, b] = de <= ate ? [de, ate] : [ate, de];
    return { ini: a, fim: b, rotulo: `${dataBR(a)} a ${dataBR(b)}` };
  }
  if (p.modo === 'ano') { const y = p.ano || h.slice(0, 4); return { ini: `${y}-01-01`, fim: `${y}-12-31`, rotulo: y }; }
  const ym = perMes(k); return { ini: iniMes(ym), fim: fimMes(ym), rotulo: nomeMes(ym) };
}
function perUI(k, extraFatura = '') {
  const p = PER[k];
  const modos = k === 'cartoes' ? ['fatura', 'mes', 'semana', 'dia', 'periodo', 'ano'] : ['mes', 'semana', 'dia', 'periodo', 'ano'];
  const sel = `<select data-per-modo="${k}" aria-label="Ver por" style="max-width:110px">${modos.map(m => `<option value="${m}" ${p.modo === m ? 'selected' : ''}>${MODOS_N[m]}</option>`).join('')}</select>`;
  const nav = (lbl, extra = '') => `<div class="mesnav"><button class="icon-btn" data-act="perNav" data-k="${k}" data-n="-1" aria-label="Anterior">${ic('left')}</button><span class="lbl">${lbl}</span><button class="icon-btn" data-act="perNav" data-k="${k}" data-n="1" aria-label="Próximo">${ic('right')}</button><button class="icon-btn sm" data-act="perHoje" data-k="${k}" title="Hoje">${ic('clock')}</button>${extra}</div>`;
  let ctl;
  if (p.modo === 'fatura') ctl = extraFatura;
  else if (p.modo === 'dia') ctl = nav(`<input type="date" data-per-campo="dia" data-k="${k}" value="${p.dia || hoje()}" style="border:0;background:transparent;font:inherit;text-align:center;max-width:150px">`);
  else if (p.modo === 'periodo') {
    const r = perIntervalo(k);
    ctl = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0 2px">
      <input type="date" data-per-campo="de" data-k="${k}" value="${r.ini}" aria-label="De" style="flex:1;min-width:130px">
      <span class="muted">a</span>
      <input type="date" data-per-campo="ate" data-k="${k}" value="${r.fim}" aria-label="Até" style="flex:1;min-width:130px"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:4px">
        ${[['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'], ['ano', 'Este ano']].map(([v, n]) => `<button class="fchip" data-act="perRapido" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
  }
  else if (p.modo === 'ano') ctl = nav(p.ano || hoje().slice(0, 4));
  else if (p.modo === 'semana') ctl = nav(perIntervalo(k).rotulo);
  else ctl = nav(nomeMes(perMes(k)));
  const ordem = `<button class="btn out sm" data-act="perOrdem" data-k="${k}" style="margin-left:auto;padding:2px 10px" title="Inverter a ordem das datas">${p.desc ? '↓ Mais recentes' : '↑ Mais antigas'}</button>`;
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 16px 0;flex-wrap:wrap"><span class="muted" style="font-size:13px">Ver por</span>${sel}${ordem}</div>${p.modo === 'periodo' ? `<div style="padding:0 16px 6px">${ctl}</div>` : ctl}`;
}

Object.assign(ACOES, {
  perNav: d => {
    const p = PER[d.k], n = +d.n;
    if (p.modo === 'dia') p.dia = addDias(p.dia || hoje(), n);
    else if (p.modo === 'semana') p.sem = addDias(p.sem || iniSemana(hoje()), 7 * n);
    else if (p.modo === 'ano') p.ano = String(+(p.ano || hoje().slice(0, 4)) + n);
    else if (d.k === 'extrato') S.mes = addMeses(S.mes, n);
    else p.mes = addMeses(perMes(d.k), n);
    render();
  },
  perHoje: d => {
    const p = PER[d.k];
    if (p.modo === 'dia') p.dia = hoje(); else if (p.modo === 'semana') p.sem = null; else if (p.modo === 'ano') p.ano = null;
    else if (d.k === 'extrato') S.mes = ymHoje(); else p.mes = ymHoje();
    render();
  },
  perOrdem: d => { PER[d.k].desc = !PER[d.k].desc; perSalvar(); render(); },
  perRapido: d => {
    const p = PER[d.k], h = hoje();
    if (d.v === 'ano') { p.de = h.slice(0, 4) + '-01-01'; p.ate = h; }
    else { p.de = addDias(h, -(parseInt(d.v, 10) - 1)); p.ate = h; }
    render();
  },
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset?.perModo) {
    const k = t.dataset.perModo, p = PER[k];
    p.modo = t.value; perSalvar();
    // ao trocar de modo, começa no período que faz sentido para o que já estava na tela
    if (p.modo === 'periodo' && !p.de) { p.de = iniMes(perMes(k)); p.ate = fimMes(perMes(k)) < hoje() ? fimMes(perMes(k)) : hoje(); }
    if (p.modo === 'dia' && !p.dia) p.dia = hoje();
    render(); return;
  }
  const campo = t.dataset?.perCampo;
  if (campo && t.value) { PER[t.dataset.k][campo] = t.value; render(); }
});

/* ---------- lista em blocos diários (igual ao extrato) ---------- */
// itens: lançamentos já filtrados; valorDe(l): efeito com sinal; acumInicial: total antes do 1º dia
function blocosDiarios(itens, linha, valorDe, acumInicial, rotuloIni, desc = false) {
  const ord = [...itens].sort((x, y) => x.data !== y.data ? (x.data < y.data ? -1 : 1) : ((x.criado_em || '') < (y.criado_em || '') ? -1 : 1));
  // agrupa por dia e calcula o acumulado em ordem cronológica
  const dias = [];
  let acum = acumInicial;
  for (const l of ord) {
    let g = dias[dias.length - 1];
    if (!g || g.data !== l.data) { g = { data: l.data, itens: [], doDia: 0 }; dias.push(g); }
    g.itens.push(l); g.doDia += valorDe(l); acum += valorDe(l); g.acum = acum;
  }
  const bloco = g => (desc ? [...g.itens].reverse() : g.itens).map(linha).join('')
    + `<div class="dsep"><span><span style="text-transform:capitalize">${diaSemana(g.data)}</span>, ${dataBR(g.data)} <span class="muted" style="font-weight:400">· no dia ${fmtN(r2(g.doDia))}</span></span>${vH(r2(g.acum))}</div>`;
  const ini = rotuloIni !== undefined ? `<div class="dsep ini"><span>${rotuloIni}</span>${vH(r2(acumInicial))}</div>` : '';
  return desc ? [...dias].reverse().map(bloco).join('') + ini : ini + dias.map(bloco).join('');
}
