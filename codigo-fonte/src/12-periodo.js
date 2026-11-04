/* =====================================================================
   FILTRO DE PERÍODO (Extrato de contas e Cartões de crédito)
   modos: fatura (só cartões), mes, dia, periodo (de/até), ano
   ===================================================================== */
const PER = {
  extrato: { modo: 'mes', dia: null, de: null, ate: null, ano: null },
  cartoes: { modo: 'fatura', mes: null, dia: null, de: null, ate: null, ano: null },
};
try { const sv = JSON.parse(localStorage.getItem('nc_per') || '{}'); for (const k of Object.keys(PER)) if (sv[k]?.modo) PER[k].modo = sv[k].modo; } catch { /* sem armazenamento */ }
const perSalvar = () => { try { localStorage.setItem('nc_per', JSON.stringify({ extrato: { modo: PER.extrato.modo }, cartoes: { modo: PER.cartoes.modo } })); } catch { /* ignora */ } };
const MODOS_N = { fatura: 'Fatura', mes: 'Mês', dia: 'Dia', periodo: 'Período', ano: 'Ano' };

// mês "corrente" de cada tela: extrato usa o mês global (S.mes); cartões guardam o seu
const perMes = k => k === 'extrato' ? S.mes : (PER[k].mes || ymHoje());
function perIntervalo(k) {
  const p = PER[k], h = hoje();
  if (p.modo === 'dia') { const d = p.dia || h; return { ini: d, fim: d, rotulo: `${diaSemana(d)}, ${dataBR(d)}` }; }
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
  const modos = k === 'cartoes' ? ['fatura', 'mes', 'dia', 'periodo', 'ano'] : ['mes', 'dia', 'periodo', 'ano'];
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
  else ctl = nav(nomeMes(perMes(k)));
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 16px 0"><span class="muted" style="font-size:13px">Ver por</span>${sel}</div>${p.modo === 'periodo' ? `<div style="padding:0 16px 6px">${ctl}</div>` : ctl}`;
}

Object.assign(ACOES, {
  perNav: d => {
    const p = PER[d.k], n = +d.n;
    if (p.modo === 'dia') p.dia = addDias(p.dia || hoje(), n);
    else if (p.modo === 'ano') p.ano = String(+(p.ano || hoje().slice(0, 4)) + n);
    else if (d.k === 'extrato') S.mes = addMeses(S.mes, n);
    else p.mes = addMeses(perMes(d.k), n);
    render();
  },
  perHoje: d => {
    const p = PER[d.k];
    if (p.modo === 'dia') p.dia = hoje(); else if (p.modo === 'ano') p.ano = null;
    else if (d.k === 'extrato') S.mes = ymHoje(); else p.mes = ymHoje();
    render();
  },
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
function blocosDiarios(itens, linha, valorDe, acumInicial, rotuloIni) {
  const ord = [...itens].sort((x, y) => x.data !== y.data ? (x.data < y.data ? -1 : 1) : ((x.criado_em || '') < (y.criado_em || '') ? -1 : 1));
  let acum = acumInicial, out = rotuloIni !== undefined ? `<div class="dsep ini"><span>${rotuloIni}</span>${vH(r2(acumInicial))}</div>` : '';
  ord.forEach((l, i) => {
    acum += valorDe(l);
    out += linha(l);
    const prox = ord[i + 1];
    if (!prox || prox.data !== l.data) {
      const doDia = ord.filter(x => x.data === l.data).reduce((s, x) => s + valorDe(x), 0);
      out += `<div class="dsep"><span><span style="text-transform:capitalize">${diaSemana(l.data)}</span>, ${dataBR(l.data)} <span class="muted" style="font-weight:400">· no dia ${fmtN(r2(doDia))}</span></span>${vH(r2(acum))}</div>`;
    }
  });
  return out;
}
