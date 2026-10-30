/* =====================================================================
   VISÃO GERAL
   ===================================================================== */
const WIDGETS = [
  ['saldos', 'Saldos de caixa', 'e'], ['resmes', 'Resultado do mês', 'e'], ['rescaixa', 'Resultados de caixa', 'e'],
  ['despcat', 'Despesas por categoria', 'e'], ['reccat', 'Receitas por categoria', 'e'], ['balanco', 'Balanço patrimonial', 'e'], ['metasdesp', 'Metas de despesas', 'e', 'orcamento'],
  ['receber', 'Contas a receber', 'd'], ['pagar', 'Contas a pagar', 'd'], ['ultimos', 'Últimos lançamentos', 'd'], ['cartoes', 'Cartões de crédito', 'd', 'cartoes'],
  ['fluxo', 'Fluxo de caixa', 'd'], ['economia', 'Metas de economia', 'd', 'economia'],
];
const widgetsOcultos = () => lsJSON('nc_widgets_ocultos', []);
function wCard(id, titulo, corpo, acts = '', rodape = '') {
  return `<div class="card ${recolhido('w_' + id) ? 'recolhido' : ''}" id="w_${id}">${cardH(titulo, acts, 'w_' + id)}<div class="card-b ${corpo.startsWith('<table') || corpo.startsWith('<div class="lrow') || corpo.startsWith('<div class="empty') ? 'flush' : ''}">${corpo}</div>${rodape ? `<div class="card-f">${rodape}</div>` : ''}</div>`;
}
function vVisao(pos) {
  const ym = S.mes, ini = iniMes(ym), fim = fimMes(ym), h = hoje();
  if (!S.contas.length && !S.lancamentos.length) {
    return `<div class="card" style="padding:22px;max-width:760px;margin:10px auto"><h2 style="margin:0 0 6px;font-weight:400">Bem-vindos ao Nosso Caixa!</h2>
      <p class="muted">Comece cadastrando as contas (banco, poupança, carteira) e os cartões de crédito. As categorias já foram criadas.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="novaConta">${ic('plus')}Cadastrar conta</button><button class="btn out" data-act="novoCartao">${ic('plus')}Cadastrar cartão</button><a class="btn out" href="#importar">${ic('upload')}Importar lançamentos</a></div></div>`;
  }
  const ocultos = widgetsOcultos();
  const ids = contasFiltradas().filter(c => c.considerar_saldo !== false).map(c => c.id);
  const W = {};
  const mostra = w => !ocultos.includes(w[0]) && (!w[3] || recurso(w[3]));

  W.saldos = () => painelSaldos(fim, 'Saldos de caixa', 'w_saldos');

  W.resmes = () => {
    const rec = receitasPer(ini, fim), desp = despesasPer(ini, fim);
    const conf = l => l.pago || l.cartao_id;
    const rR = soma(rec.filter(conf)), rP = soma(rec), dR = soma(despesasPer(ini, fim).filter(conf)) - soma(S.lancamentos.filter(l => l.tipo === 'receita' && l.cartao_id && noPeriodo(l, ini, fim)));
    const dP = soma(desp) - soma(S.lancamentos.filter(l => l.tipo === 'receita' && l.cartao_id && noPeriodo(l, ini, fim)));
    return wCard('resmes', 'Resultado do mês', `<table class="t"><tr><th class="l"></th><th>Realizado</th><th>Previsto</th></tr>
      <tr><td class="l">Receitas</td><td>${vH(rR)}</td><td>${vH(rP)}</td></tr>
      <tr><td class="l">Despesas</td><td>${vH(-dR)}</td><td>${vH(-dP)}</td></tr>
      <tr class="tot"><td class="l">Resultado</td><td>${vH(rR - dR)}</td><td>${vH(rP - dP)}</td></tr></table>`);
  };

  W.rescaixa = () => {
    const lista = S.lancamentos.filter(l => noMes(l, ym) && ehCaixa(l));
    const linhas = contasFiltradas().map(c => ({ c, r: resultadosCaixa(lista, [c.id]) }));
    const tot = resultadosCaixa(lista, ids);
    pos.push(() => grafico('gResCx', { type: 'bar', data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [tot.ent, Math.abs(tot.sai)], backgroundColor: [css('--link'), css('--neg')], borderRadius: 4, maxBarThickness: 90 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) } } }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    return wCard('rescaixa', 'Resultados de caixa', `<div class="chart-box" style="height:180px;margin:0 16px 8px"><canvas id="gResCx"></canvas></div>
      <table class="t"><tr><th class="l">Conta</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr>
      ${linhas.map(x => `<tr><td class="l"><span class="dot" style="background:${esc(x.c.cor)};margin-right:6px"></span>${esc(x.c.nome)}</td><td>${vH(x.r.ent, 'pos')}</td><td>${vH(x.r.sai, 'neg')}</td><td>${vH(x.r.res)}</td></tr>`).join('')}
      <tr class="tot"><td class="l">Total</td><td>${vH(tot.ent, 'pos')}</td><td>${vH(tot.sai, 'neg')}</td><td>${vH(tot.res)}</td></tr></table>`);
  };

  const catWidget = (id, titulo, tipo) => {
    const proj = lsGet('nc_proj_' + id) !== '0';
    let lista = tipo === 'despesa' ? despesasPer(ini, fim).concat(S.lancamentos.filter(l => l.tipo === 'receita' && l.cartao_id && noPeriodo(l, ini, fim))) : receitasPer(ini, fim);
    if (!proj) lista = lista.filter(l => l.pago || l.cartao_id);
    const itens = porCategoria(lista).filter(x => x.v);
    const tot = soma(itens, x => x.v);
    if (itens.length) pos.push(() => donut('g_' + id, itens));
    const sinal = tipo === 'despesa' ? -1 : 1;
    return wCard(id, titulo, itens.length ? `<div class="chart-box" style="height:190px;margin-bottom:6px"><canvas id="g_${id}"></canvas></div>
      <div class="legend-l">${itens.map(x => `<div class="row"><span class="dot" style="background:${esc(x.cor)}"></span><span class="n">${esc(x.nome)}</span><span class="muted num">${tot ? (x.v / tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' : ''}</span>${vH(sinal * x.v)}</div>`).join('')}
      <div class="row b"><span class="n">Total</span>${vH(sinal * tot)}</div></div>` : vazio('Sem lançamentos no período.'),
      `<button class="icon-btn sm ${proj ? 'on' : ''}" data-act="projCat" data-id="${id}" title="${proj ? 'Situação projetada (inclui pendentes)' : 'Somente confirmados'}">${ic('check')}</button>`);
  };
  W.despcat = () => catWidget('despcat', 'Despesas por categoria', 'despesa');
  W.reccat = () => catWidget('reccat', 'Receitas por categoria', 'receita');

  W.balanco = () => {
    const ativos = [], passivos = [];
    for (const c of contasAtivas().filter(c => c.considerar_saldo !== false)) { const s = saldoConta(c.id, { ate: fim }); (s >= 0 ? ativos : passivos).push({ n: c.nome, v: s, cor: c.cor }); }
    for (const k of cartoesAtivos()) { const u = usoCartao(k).usado; if (u) passivos.push({ n: k.nome, v: -u, cor: k.cor }); }
    const tA = soma(ativos, x => x.v), tP = soma(passivos, x => x.v);
    const lin = x => `<tr><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:6px"></span>${esc(x.n)}</td><td>${vH(x.v)}</td></tr>`;
    return wCard('balanco', 'Balanço patrimonial', `<table class="t"><tr class="tot"><td class="l">Ativos</td><td>${vH(tA)}</td></tr>${ativos.map(lin).join('')}
      <tr class="tot"><td class="l">Passivos</td><td>${vH(tP)}</td></tr>${passivos.map(lin).join('')}
      <tr class="tot"><td class="l">Patrimônio líquido</td><td>${vH(tA + tP)}</td></tr></table>`);
  };

  W.metasdesp = () => {
    const linhas = linhasOrcamento(ym).filter(x => x.meta);
    return wCard('metasdesp', 'Metas de despesas', linhas.length ? linhas.slice(0, 8).map(x => barraMeta(x.nome, x.realizado, x.meta, x.cor)).join('') : vazio('Sem metas de despesa definidas no período.', `<a class="btn" href="#orcamento">Definir metas</a>`));
  };

  const pendentes = tipo => S.lancamentos.filter(l => !l.pago && ehCaixa(l) && l.data <= fim && (tipo === 'r' ? l.tipo === 'receita' : (l.tipo === 'despesa' || l.tipo === 'pagamento_fatura'))
    && (!S.contasSel || S.contasSel.has(l.conta_id))).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  const pendW = (id, titulo, tipo) => {
    const ls = pendentes(tipo), tot = soma(ls) * (tipo === 'r' ? 1 : -1);
    return wCard(id, titulo, ls.length ? ls.map(l => linhaL(l)).join('') : vazio(tipo === 'r' ? 'Nada a receber até o fim do mês.' : 'Nada a pagar até o fim do mês.'), '', `<span>Total</span>${vH(tot)}`);
  };
  W.receber = () => pendW('receber', 'Contas a receber', 'r');
  W.pagar = () => pendW('pagar', 'Contas a pagar', 'p');

  W.ultimos = () => {
    const ls = S.lancamentos.filter(l => l.data <= h).sort((a, b) => a.data !== b.data ? (a.data < b.data ? 1 : -1) : (a.criado_em < b.criado_em ? 1 : -1)).slice(0, 16);
    return wCard('ultimos', 'Últimos lançamentos', ls.length ? ls.map(l => linhaL(l)).join('') : vazio('Nenhum lançamento ainda.'));
  };

  W.cartoes = () => {
    const ks = cartoesAtivos();
    return wCard('cartoes', 'Cartões de crédito', ks.length ? ks.map(k => {
      const fyA = faturaYM(k, h), fa = faturaInfo(k, fyA), fyF = addMeses(fyA, -1), ff = faturaInfo(k, fyF), u = usoCartao(k);
      return `<div style="padding:10px 0;border-top:1px solid var(--line)">
        <div class="kv b"><span><span class="dot" style="background:${esc(k.cor)};margin-right:6px"></span>${esc(k.nome)}</span></div>
        <div class="kv" style="cursor:pointer" data-act="verFatura" data-id="${k.id}" data-ym="${fyA}"><span>Fatura ${dataBR(fa.vencimento)} <span class="muted">(Fechamento ${dataBR(fa.fechamento)})</span></span>${vH(-fa.total)}</div>
        <div class="kv" style="cursor:pointer" data-act="verFatura" data-id="${k.id}" data-ym="${fyF}"><span>Fatura ${dataBR(ff.vencimento)} ${chipFat(ff.status)}</span>${vH(-ff.total)}</div>
        <div class="kv"><span>Disponível</span>${vH(u.disponivel)}</div></div>`;
    }).join('') : vazio('Nenhum cartão cadastrado.', `<button class="btn" data-act="novoCartao">Cadastrar cartão</button>`));
  };

  W.fluxo = () => {
    const dias = [], vals = [];
    let s = soma(ids, id => saldoConta(id, { antes: ini, pendentes: true }));
    const mov = new Map();
    for (const l of S.lancamentos) if (noMes(l, ym)) { const e = ids.reduce((a, id) => a + efeitoConta(l, id), 0); if (e) mov.set(l.data, (mov.get(l.data) || 0) + e); }
    for (let d = ini; d <= fim; d = addDias(d, 1)) { s += mov.get(d) || 0; dias.push(+d.slice(8)); vals.push(r2(s)); }
    pos.push(() => grafico('gFluxoW', { type: 'line', data: { labels: dias, datasets: [{ label: 'Saldo projetado', data: vals, borderColor: css('--link'), backgroundColor: css('--link-soft'), fill: true, tension: .25, pointRadius: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    return wCard('fluxo', 'Fluxo de caixa', `<div class="chart-box" style="height:220px"><canvas id="gFluxoW"></canvas></div>`, `<a class="icon-btn sm" href="#fluxo" title="Abrir fluxo">${ic('right')}</a>`);
  };

  W.economia = () => wCard('economia', 'Metas de economia', S.metas.length ? S.metas.map(m => { const st = statusMeta(m); return barraMeta(m.nome, st.atual, num(m.valor_alvo), m.cor, true); }).join('') : vazio('Nenhuma meta de economia.', `<a class="btn" href="#economia">Criar meta</a>`));

  const col = lado => WIDGETS.filter(w => w[2] === lado && mostra(w)).map(w => W[w[0]]()).join('');
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <div class="card" style="display:inline-flex"><div class="mesnav" style="padding:2px 6px">
        <button class="icon-btn sm" data-act="mes" data-n="-1">${ic('left')}</button><span class="lbl" style="min-width:140px">${nomeMes(ym)}</span><button class="icon-btn sm" data-act="mes" data-n="1">${ic('right')}</button>
        <button class="icon-btn sm" data-act="mesHoje" title="Mês atual">${ic('clock')}</button></div></div>
      <button class="btn out sm" data-act="personalizar">${ic('gear')}Personalizar</button></div>
    <div class="dash"><div class="col">${col('e')}</div><div class="col">${col('d')}</div></div>`;
}
function barraMeta(nome, real, meta, cor, economia = false) {
  const pct = meta ? real / meta * 100 : 0;
  const c = economia ? cor : pct > 100 ? css('--neg') : pct > 85 ? css('--warn') : (cor || css('--accent'));
  return `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="kv" style="padding:0 0 5px"><span>${esc(nome)}</span><span class="num v ${!economia && pct > 100 ? 'neg' : 'muted'}">${fmtN(real)} / ${fmtN(meta)} · ${Math.round(pct)}%</span></div>
    <div class="bar"><i style="width:${Math.min(100, pct)}%;background:${esc(c)}"></i></div></div>`;
}

/* =====================================================================
   LANÇAMENTOS DE CAIXA
   ===================================================================== */
function filtroBusca(lista) {
  const b = semAcento(S.busca);
  if (!b) return lista;
  return lista.filter(l => semAcento(`${l.descricao} ${l.observacao || ''} ${nomeCat(l.categoria_id)} ${l.criado_por || ''} ${fmtN(l.valor)} ${(l.tags || []).map(t => byId('tags', t)?.nome).join(' ')}`).includes(b));
}
const buscaInput = () => `<input class="busca" type="search" placeholder="Buscar" data-filtro="busca" value="${esc(S.busca)}">`;
function vLancamentos() {
  const ym = S.mes, ini = iniMes(ym), fim = fimMes(ym);
  const ids = contasFiltradas().map(c => c.id);
  const doMes = S.lancamentos.filter(l => noMes(l, ym) && ehCaixa(l) && tocaContas(l, ids));
  const res = resultadosCaixa(doMes, ids);
  let lista = filtroBusca(doMes.filter(l => passaStatus(l, S.status))).sort((a, b) => a.data !== b.data ? (a.data < b.data ? -1 : 1) : (a.criado_em < b.criado_em ? -1 : 1));
  const comSaldo = !S.status.size && !S.busca;
  let saldo = soma(ids, id => saldoConta(id, { antes: ini, pendentes: true }));
  const anterior = saldo;
  _csvAtual = { linhas: csvLanc(lista), nome: 'lancamentos-' + ym };
  const rows = lista.map(l => { saldo += ids.reduce((a, id) => a + efeitoConta(l, id), 0); return linhaL(l, { ids, saldo: comSaldo ? r2(saldo) : undefined }); }).join('');
  return `<div class="pg"><div class="lado">${painelMes()}${painelSaldos(fim)}${painelResultados(res)}</div>
    <div class="card"><div class="tb">${chipsStatus(['pendente', 'agendado', 'confirmado', 'conciliado'])}${buscaInput()}${acoesLista()}</div>
      ${comSaldo ? `<div class="dsep ini"><span>${dataBR(addDias(ini, -1)).slice(0, 5)} · Saldo anterior</span>${vH(anterior)}</div>` : ''}
      ${rows || vazio(`Nenhum lançamento em ${nomeMes(ym)}.`, `<button class="btn" data-act="novo" data-t="despesa">Novo lançamento</button>`)}</div></div>`;
}

/* =====================================================================
   FLUXO DE CAIXA
   ===================================================================== */
function periodoFluxo() {
  if (!S.fluxoIni) {
    const h = hoje();
    if (S.fluxoModo === 'mes') S.fluxoIni = iniMes(h.slice(0, 7));
    else { const dw = (new Date(h + 'T12:00').getDay() + 6) % 7; S.fluxoIni = addDias(h, -dw); }
  }
  const ini = S.fluxoIni;
  const fim = S.fluxoModo === 'mes' ? fimMes(ini.slice(0, 7)) : S.fluxoModo === '30' ? addDias(ini, 29) : addDias(ini, 6);
  return { ini, fim };
}
function vFluxo(pos) {
  const { ini, fim } = periodoFluxo();
  const ids = contasFiltradas().map(c => c.id);
  const anterior = soma(ids, id => saldoConta(id, { antes: ini, pendentes: true }));
  const mov = new Map();
  for (const l of S.lancamentos) if (noPeriodo(l, ini, fim) && ehCaixa(l)) {
    const e = ids.reduce((a, id) => a + efeitoConta(l, id), 0);
    if (!e) continue;
    const m = mov.get(l.data) || { ent: 0, sai: 0 };
    e > 0 ? m.ent += e : m.sai += e; mov.set(l.data, m);
  }
  const dias = []; let s = anterior;
  const serie = [];
  for (let d = ini; d <= fim; d = addDias(d, 1)) {
    const m = mov.get(d); if (m) { s += m.ent + m.sai; dias.push({ d, ...m, res: r2(m.ent + m.sai), saldo: r2(s) }); }
    serie.push({ d, saldo: r2(s) });
  }
  const tEnt = soma(dias, x => x.ent), tSai = soma(dias, x => x.sai);
  const lbl = d => `${d.slice(8)} ${MES3[+d.slice(5, 7) - 1]}`;
  pos.push(() => {
    grafico('gFx1', { type: 'line', data: { labels: serie.map(x => lbl(x.d)), datasets: [{ label: 'Saldo', data: serie.map(x => x.saldo), borderColor: css('--link'), backgroundColor: css('--link-soft'), fill: true, tension: .25, pointRadius: serie.length > 40 ? 0 : 3, stepped: false }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } });
    grafico('gFx2', { type: 'bar', data: { labels: dias.map(x => lbl(x.d)), datasets: [
      { label: 'Entradas', data: dias.map(x => x.ent), backgroundColor: css('--link'), borderRadius: 3, maxBarThickness: 30 },
      { label: 'Saídas', data: dias.map(x => x.sai), backgroundColor: css('--neg'), borderRadius: 3, maxBarThickness: 30 },
      { label: 'Resultado', type: 'line', data: dias.map(x => x.res), borderColor: css('--warn'), backgroundColor: css('--warn'), pointRadius: 3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } });
  });
  _csvAtual = { linhas: [['Data', 'Entradas', 'Saídas', 'Resultado', 'Saldo'], ['Saldo anterior', '', '', '', fmtN(anterior)], ...dias.map(x => [dataBR(x.d), fmtN(x.ent), fmtN(x.sai), fmtN(x.res), fmtN(x.saldo)])], nome: 'fluxo' };
  const saldosFim = contasFiltradas().map(c => ({ c, v: saldoConta(c.id, { ate: fim, pendentes: true }) }));
  const rotulo = S.fluxoModo === 'mes' ? nomeMes(ini.slice(0, 7)) : `${lbl(ini)} - ${lbl(fim)}`;
  return `<div class="pg"><div class="lado">
      <div class="card"><div class="mesnav"><button class="icon-btn" data-act="fluxoNav" data-n="-1">${ic('left')}</button><span class="lbl">${rotulo}</span><button class="icon-btn" data-act="fluxoNav" data-n="1">${ic('right')}</button><button class="icon-btn sm" data-act="fluxoHoje" title="Hoje">${ic('clock')}</button></div>
        <div class="card-b"><div class="f" style="margin:0"><label>Período</label><select data-act="fluxoModo">${[['semana', 'Semana'], ['30', 'Próximos 30 dias'], ['mes', 'Mês']].map(([k, n]) => `<option value="${k}" ${S.fluxoModo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div></div>
      <div class="card">${cardH(`Saldo em ${lbl(fim)}`)}<div class="card-b flush"><table class="t">${saldosFim.map(x => `<tr><td class="l"><span class="dot" style="background:${esc(x.c.cor)};margin-right:6px"></span>${esc(x.c.nome)}</td><td>${vH(x.v)}</td></tr>`).join('')}
        <tr class="tot"><td class="l">Total</td><td>${vH(soma(saldosFim, x => x.v))}</td></tr></table></div></div>
      ${painelSaldos(fim, 'Contas consideradas')}</div>
    <div><div class="card">${cardH('Fluxo de caixa', acoesLista())}<div class="card-b"><div class="chart-box"><canvas id="gFx1"></canvas></div></div>
      <div style="overflow-x:auto"><table class="t"><tr><th class="l">Data</th><th>Entradas (R$)</th><th>Saídas (R$)</th><th>Resultado (R$)</th><th>Saldo (R$)</th></tr>
      <tr><td class="l muted">Saldo anterior</td><td></td><td></td><td></td><td>${vH(anterior)}</td></tr>
      ${dias.map(x => `<tr class="click" data-act="fluxoDia" data-d="${x.d}"><td class="l">${dataBR(x.d)}</td><td>${vH(x.ent)}</td><td>${vH(x.sai)}</td><td>${vH(x.res)}</td><td>${vH(x.saldo)}</td></tr>`).join('')}
      <tr class="tot"><td class="l">Total</td><td>${vH(tEnt)}</td><td>${vH(tSai)}</td><td>${vH(tEnt + tSai)}</td><td>${vH(s)}</td></tr></table></div></div>
      <div class="card">${cardH('Resultado de caixa')}<div class="card-b"><div class="chart-box"><canvas id="gFx2"></canvas></div></div></div></div></div>`;
}

/* =====================================================================
   CONTAS A PAGAR E RECEBER / PAGAS E RECEBIDAS
   ===================================================================== */
function vPagar() {
  const aba = S.aba.pagar || 'pagar', ym = S.mes, fim = fimMes(ym), ini = iniMes(ym);
  const ids = contasFiltradas().map(c => c.id);
  const pend = S.lancamentos.filter(l => !l.pago && ehCaixa(l) && l.data <= fim && (l.data >= ini || l.data < ini) && ids.includes(l.conta_id) && l.tipo !== 'transferencia');
  const pagar = pend.filter(l => l.tipo !== 'receita'), receber = pend.filter(l => l.tipo === 'receita');
  const tP = -soma(pagar), tR = soma(receber);
  const base = aba === 'pagar' ? pagar : receber;
  const lista = filtroBusca(base.filter(l => passaStatus(l, S.status))).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  _csvAtual = { linhas: csvLanc(lista), nome: aba === 'pagar' ? 'contas-a-pagar' : 'contas-a-receber' };
  const porConta = contasFiltradas().map(c => ({ c, v: soma(base.filter(l => l.conta_id === c.id)) * (aba === 'pagar' ? -1 : 1) }));
  return `<div class="tabs"><button class="tab ${aba === 'pagar' ? 'on' : ''}" data-act="aba" data-k="pagar" data-v="pagar">A pagar</button><button class="tab ${aba === 'receber' ? 'on' : ''}" data-act="aba" data-k="pagar" data-v="receber">A receber</button></div>
    <div class="pg"><div class="lado">${painelMes()}
      <div class="card">${cardH('Resultado do período')}<div class="card-b"><div class="kv"><span>A pagar</span>${vH(tP)}</div><div class="kv"><span>A receber</span>${vH(tR)}</div><div class="kv tot"><span>Resultado</span>${vH(tP + tR)}</div></div></div>
      <div class="card"><div class="card-b flush"><table class="t"><tr><th class="l">Contas</th><th>Total ${aba === 'pagar' ? 'a pagar' : 'a receber'}</th></tr>
        ${porConta.map(x => `<tr><td class="l">${esc(x.c.nome)}</td><td>${vH(x.v)}</td></tr>`).join('')}<tr class="tot"><td class="l">Total</td><td>${vH(soma(porConta, x => x.v))}</td></tr></table></div></div>
      ${painelSaldos(fim, 'Contas')}</div>
    <div class="card"><div class="tb">${chipsStatus(['pendente', 'agendado'])}${buscaInput()}${acoesLista()}</div>
      ${lista.map(l => linhaL(l)).join('') || vazio(aba === 'pagar' ? 'Nenhuma conta a pagar até o fim do mês.' : 'Nenhuma conta a receber até o fim do mês.')}</div></div>`;
}
function vPagas() {
  const aba = S.aba.pagas || 'pagas', ym = S.mes;
  const ids = contasFiltradas().map(c => c.id);
  const doMes = S.lancamentos.filter(l => l.pago && noMes(l, ym) && ehCaixa(l) && ids.includes(l.conta_id) && l.tipo !== 'transferencia');
  const pagas = doMes.filter(l => l.tipo !== 'receita'), recebidas = doMes.filter(l => l.tipo === 'receita');
  const tP = -soma(pagas), tR = soma(recebidas);
  const base = aba === 'pagas' ? pagas : recebidas;
  const lista = filtroBusca(base.filter(l => passaStatus(l, S.status))).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  _csvAtual = { linhas: csvLanc(lista), nome: aba === 'pagas' ? 'contas-pagas' : 'contas-recebidas' };
  const porConta = contasFiltradas().map(c => ({ c, v: soma(base.filter(l => l.conta_id === c.id)) * (aba === 'pagas' ? -1 : 1) }));
  return `<div class="tabs"><button class="tab ${aba === 'pagas' ? 'on' : ''}" data-act="aba" data-k="pagas" data-v="pagas">Pagas</button><button class="tab ${aba === 'recebidas' ? 'on' : ''}" data-act="aba" data-k="pagas" data-v="recebidas">Recebidas</button></div>
    <div class="pg"><div class="lado">${painelMes()}
      <div class="card">${cardH('Resultado do período')}<div class="card-b"><div class="kv"><span>Pago</span>${vH(tP)}</div><div class="kv"><span>Recebido</span>${vH(tR)}</div><div class="kv tot"><span>Resultado</span>${vH(tP + tR)}</div></div></div>
      <div class="card"><div class="card-b flush"><table class="t"><tr><th class="l">Contas</th><th>Total ${aba === 'pagas' ? 'pago' : 'recebido'}</th></tr>
        ${porConta.map(x => `<tr><td class="l">${esc(x.c.nome)}</td><td>${vH(x.v)}</td></tr>`).join('')}<tr class="tot"><td class="l">Total</td><td>${vH(soma(porConta, x => x.v))}</td></tr></table></div></div>
      ${painelSaldos(fimMes(ym), 'Contas')}</div>
    <div class="card"><div class="tb">${chipsStatus(['confirmado', 'conciliado'])}${buscaInput()}${acoesLista()}</div>
      ${lista.map(l => linhaL(l)).join('') || vazio('Nenhum lançamento no período.')}</div></div>`;
}

/* =====================================================================
   EXTRATO DE CONTAS
   ===================================================================== */
function vExtrato() {
  if (!S.contas.length) return vazio('Nenhuma conta cadastrada.', `<button class="btn pri" data-act="novaConta">Cadastrar conta</button>`);
  if (!S.extratoConta || !byId('contas', S.extratoConta)) S.extratoConta = (contasAtivas()[0] || S.contas[0]).id;
  const c = byId('contas', S.extratoConta), ym = S.mes, ini = iniMes(ym), fim = fimMes(ym);
  const doMes = S.lancamentos.filter(l => noMes(l, ym) && efeitoConta(l, c.id) !== 0);
  const sit = pend => {
    const ls = doMes.filter(l => pend || l.pago);
    const r = resultadosCaixa(ls, [c.id]);
    const ant = saldoConta(c.id, { antes: ini, pendentes: pend });
    return { ant, ...r, fin: r2(ant + r.res) };
  };
  const a = sit(false), b = sit(true);
  const lista = filtroBusca(doMes.filter(l => passaStatus(l, S.status))).sort((x, y) => x.data !== y.data ? (x.data < y.data ? -1 : 1) : (x.criado_em < y.criado_em ? -1 : 1));
  _csvAtual = { linhas: csvLanc(lista), nome: 'extrato-' + c.nome };
  const comSaldo = !S.status.size && !S.busca;
  let s = b.ant, out = '', diaAtual = null;
  lista.forEach((l, i) => {
    s += efeitoConta(l, c.id);
    out += linhaL(l, { ids: [c.id], semConta: true });
    const prox = lista[i + 1];
    if (comSaldo && (!prox || prox.data !== l.data)) out += `<div class="dsep"><span style="text-transform:capitalize">${diaSemana(l.data)}, ${dataBR(l.data)}</span>${vH(r2(s))}</div>`;
  });
  const row = (n, k) => `<tr><td class="l">${n}</td><td>${vH(a[k])}</td><td>${vH(b[k])}</td></tr>`;
  return `<div class="pg"><div class="lado">
      <div class="card"><div class="sel"><select data-act="selExtrato" aria-label="Conta">${S.contas.filter(x => !x.arquivada || x.id === c.id).map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
        <button class="icon-btn sm" data-act="editConta" data-id="${c.id}" title="Editar conta">${ic('edit')}</button></div>
        <div class="mesnav"><button class="icon-btn" data-act="mes" data-n="-1">${ic('left')}</button><span class="lbl">${nomeMes(ym)}</span><button class="icon-btn" data-act="mes" data-n="1">${ic('right')}</button><button class="icon-btn sm" data-act="mesHoje" title="Mês atual">${ic('clock')}</button></div></div>
      <div class="card">${cardH('Situação confirmada/projetada (R$)')}<div class="card-b flush"><table class="t"><tr><th class="l"></th><th>Confirmada</th><th>Projetada</th></tr>
        ${row('Saldo anterior', 'ant')}${row('Receitas', 'rec')}${row('Transferências de entrada', 'te')}${row('Despesas', 'desp')}${row('Transferências de saída', 'ts')}${row('Resultado', 'res')}
        <tr class="tot"><td class="l">Saldo final</td><td>${vH(a.fin)}</td><td>${vH(b.fin)}</td></tr></table></div></div></div>
    <div class="card"><div class="tb">${chipsStatus(['pendente', 'agendado', 'confirmado', 'conciliado'])}${buscaInput()}<button class="icon-btn sm" data-act="ajustarSaldo" data-id="${c.id}" title="Ajustar saldo">${ic('ajsal')}</button>${acoesLista()}</div>
      ${comSaldo ? `<div class="dsep ini"><span>${dataBR(addDias(ini, -1)).slice(0, 5)} · Saldo anterior</span>${vH(b.ant)}</div>` : ''}
      ${out || vazio(`Nenhuma movimentação em ${esc(c.nome)} neste mês.`)}</div></div>`;
}
