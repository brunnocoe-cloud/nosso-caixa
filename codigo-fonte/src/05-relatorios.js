/* =====================================================================
   RELATÓRIOS
   ===================================================================== */
const RELATORIOS = [
  ['Patrimônio e Orçamento', [
    ['balanco', 'banco', 'Balanço Patrimonial', 'Detalhamento dos ativos, passivos e patrimônio líquido em um mês específico'],
    ['evobalanco', 'fluxo', 'Evolução do Balanço Patrimonial', 'Variação do patrimônio líquido ao longo do tempo'],
    ['evometas', 'flag', 'Evolução das Metas de Categorias', 'Comparação entre as despesas por categoria e as metas estabelecidas'],
  ]],
  ['Controle das Contas', [
    ['fluxo', 'transf', 'Fluxo de Caixa', 'Análise gráfica das entradas e saídas e a evolução do saldo de caixa'],
    ['lanccaixa', 'receipt', 'Lançamentos de Caixa', 'Detalhes em extrato de todas as entradas e saídas de suas contas'],
    ['apagar', 'clock', 'Contas a Pagar', 'Acompanhamento de contas e compromissos financeiros futuros com vencimento'],
    ['areceber', 'clock', 'Contas a Receber', 'Acompanhamento de valores a receber, como salários e reembolsos'],
    ['pagas', 'taskok', 'Contas Pagas', 'Histórico detalhado de todos os pagamentos já realizados'],
    ['recebidas', 'checkc', 'Contas Recebidas', 'Histórico detalhado de todos os valores já recebidos'],
  ]],
  ['Detalhamento de Receitas e Despesas', [
    ['totaiscat', 'pie', 'Totais por Categoria', 'Análise gráfica das receitas e despesas agrupadas por categoria'],
    ['evocat', 'fluxo', 'Evolução por Categoria', 'Tendência das receitas e despesas por categoria ao longo dos meses'],
    ['comparacao', 'transf', 'Comparação entre Períodos', 'Compare resultados financeiros para identificar tendências'],
    ['lanccat', 'lista', 'Lançamentos por Categoria', 'Lista detalhada de lançamentos organizados por categoria'],
  ]],
];
const REL = Object.fromEntries(RELATORIOS.flatMap(g => g[1]).map(r => [r[0], r]));
function vRelatorios(pos) {
  if (S.relatorio && REL[S.relatorio]) return vRelatorio(pos);
  const b = semAcento(S.relBusca || '');
  return `<div class="card" style="padding:4px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px">${ic('search')}<input class="busca" style="flex:1;border:0;background:transparent;padding:10px 4px;font-size:15px" placeholder="Buscar relatório" data-filtro="relBusca" value="${esc(S.relBusca || '')}"></div>
    ${RELATORIOS.map(([g, itens]) => { const vis = itens.filter(r => !b || semAcento(r[2] + ' ' + r[3]).includes(b)); return vis.length ? `<div class="rel-g"><h4>${g}</h4><div class="mini-cards">${vis.map(r => `<div class="rel-item" data-act="abrirRel" data-k="${r[0]}"><span class="ic">${ic(r[1])}</span><div><b>${r[2]}</b><span>${r[3]}</span></div></div>`).join('')}</div></div>` : ''; }).join('')}`;
}
function relParams() {
  const P = S.relParams;
  if (!P.ini) { P.ini = iniMes(addMeses(ymHoje(), -5)); P.fim = fimMes(ymHoje()); }
  if (!P.tipo) P.tipo = 'despesa';
  return P;
}
const mesesEntre = (ini, fim) => { const out = []; for (let m = ini.slice(0, 7); m <= fim.slice(0, 7) && out.length < 120; m = addMeses(m, 1)) out.push(m); return out; };
function tabelaLanc(lista, saldoIni = null, ids = null) {
  let s = saldoIni;
  return `<table class="t"><tr><th class="l">Data</th><th class="l">Descrição</th><th class="l hide-m">Categoria</th><th class="l hide-m">Conta/Cartão</th><th>Valor</th>${saldoIni !== null ? '<th class="hide-m">Saldo</th>' : ''}</tr>
    ${saldoIni !== null ? `<tr><td class="l"></td><td class="l muted">Saldo anterior</td><td class="hide-m"></td><td class="hide-m"></td><td></td><td class="hide-m">${vH(saldoIni)}</td></tr>` : ''}
    ${lista.map(l => { const e = ids ? ids.reduce((a, id) => a + efeitoConta(l, id), 0) : (l.tipo === 'receita' ? 1 : -1) * num(l.valor); if (s !== null) s += e;
      return `<tr class="click" data-act="editLanc" data-id="${l.id}"><td class="l num">${dataBR(l.data)}</td><td class="l">${esc(l.descricao)}${l.pago ? '' : ' <span class="chip">pendente</span>'}</td><td class="l hide-m">${l.tipo === 'transferencia' ? 'Transferência' : l.tipo === 'pagamento_fatura' ? 'Pagamento de cartão' : esc(nomeCat(l.categoria_id))}</td><td class="l hide-m">${esc(ondeTexto(l))}</td><td>${vH(r2(e))}</td>${s !== null ? `<td class="hide-m">${vH(r2(s))}</td>` : ''}</tr>`; }).join('')}
    <tr class="tot"><td class="l" colspan="2">Total (${lista.length})</td><td class="hide-m"></td><td class="hide-m"></td><td>${vH(soma(lista, l => ids ? ids.reduce((a, id) => a + efeitoConta(l, id), 0) : (l.tipo === 'receita' ? 1 : -1) * num(l.valor)))}</td>${s !== null ? `<td class="hide-m">${vH(r2(s))}</td>` : ''}</tr></table>`;
}
function balancoEm(data) {
  const ativos = [], passivos = [];
  for (const c of S.contas.filter(c => c.considerar_saldo !== false)) { const s = saldoConta(c.id, { ate: data }); if (!s) continue; (s >= 0 ? ativos : passivos).push({ n: c.nome, v: s }); }
  for (const k of S.cartoes) {
    const ls = S.lancamentos.filter(l => l.cartao_id === k.id && l.data <= data);
    const u = r2(soma(ls.filter(l => l.tipo === 'despesa')) - soma(ls.filter(l => l.tipo === 'receita')) - soma(ls.filter(l => l.tipo === 'pagamento_fatura' && l.pago)));
    if (u > 0) passivos.push({ n: 'Cartão ' + k.nome, v: -u });
  }
  return { ativos, passivos, tA: soma(ativos, x => x.v), tP: soma(passivos, x => x.v) };
}
function vRelatorio(pos) {
  const k = S.relatorio, r = REL[k], P = relParams();
  const { ini, fim, tipo } = P;
  const usaTipo = ['totaiscat', 'evocat', 'comparacao', 'lanccat'].includes(k), soMes = k === 'balanco';
  const todasIds = S.contas.map(c => c.id);
  let corpo = '', csv = [];
  const lbl = m => mesCurto(m);
  const listaCat = (i, f) => (tipo === 'despesa' ? despesasPer(i, f).concat(S.lancamentos.filter(l => l.tipo === 'receita' && l.cartao_id && noPeriodo(l, i, f))) : receitasPer(i, f));

  if (k === 'balanco') {
    const b = balancoEm(fim);
    const lin = x => `<tr><td class="l" style="padding-left:24px">${esc(x.n)}</td><td>${vH(x.v)}</td></tr>`;
    corpo = `<table class="t"><tr class="tot"><td class="l">Ativos</td><td>${vH(b.tA)}</td></tr>${b.ativos.map(lin).join('')}<tr class="tot"><td class="l">Passivos</td><td>${vH(b.tP)}</td></tr>${b.passivos.map(lin).join('')}<tr class="tot"><td class="l">Patrimônio líquido</td><td>${vH(b.tA + b.tP)}</td></tr></table>`;
    csv = [['Item', 'Valor'], ['Ativos', fmtN(b.tA)], ...b.ativos.map(x => [x.n, fmtN(x.v)]), ['Passivos', fmtN(b.tP)], ...b.passivos.map(x => [x.n, fmtN(x.v)]), ['Patrimônio líquido', fmtN(b.tA + b.tP)]];
  }
  if (k === 'evobalanco') {
    const ms = mesesEntre(ini, fim), dados = ms.map(m => ({ m, ...balancoEm(fimMes(m)) }));
    pos.push(() => grafico('gRel', { data: { labels: ms.map(lbl), datasets: [
      { type: 'bar', label: 'Ativos', data: dados.map(d => d.tA), backgroundColor: css('--link'), borderRadius: 4, maxBarThickness: 26 },
      { type: 'bar', label: 'Passivos', data: dados.map(d => d.tP), backgroundColor: css('--neg'), borderRadius: 4, maxBarThickness: 26 },
      { type: 'line', label: 'Patrimônio líquido', data: dados.map(d => r2(d.tA + d.tP)), borderColor: css('--accent'), backgroundColor: css('--accent'), tension: .25 }] },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    corpo = `<div class="chart-box" style="height:300px;margin:0 16px 12px"><canvas id="gRel"></canvas></div><table class="t"><tr><th class="l">Mês</th><th>Ativos</th><th>Passivos</th><th>Patrimônio líquido</th><th class="hide-m">Variação</th></tr>
      ${dados.map((d, i) => `<tr><td class="l">${nomeMes(d.m)}</td><td>${vH(d.tA)}</td><td>${vH(d.tP)}</td><td>${vH(d.tA + d.tP)}</td><td class="hide-m">${i ? vH(r2(d.tA + d.tP - dados[i - 1].tA - dados[i - 1].tP)) : ''}</td></tr>`).join('')}</table>`;
    csv = [['Mês', 'Ativos', 'Passivos', 'PL'], ...dados.map(d => [d.m, fmtN(d.tA), fmtN(d.tP), fmtN(d.tA + d.tP)])];
  }
  if (k === 'evometas') {
    const ms = mesesEntre(ini, fim), dados = ms.map(m => { const ls = linhasOrcamento(m).filter(x => x.meta); return { m, meta: soma(ls, x => x.meta), real: soma(ls, x => x.realizado), ls }; });
    const cats = new Map();
    for (const d of dados) for (const x of d.ls) { const c = cats.get(x.id) || { nome: x.nome, cor: x.cor, meta: 0, real: 0 }; c.meta += x.meta; c.real += x.realizado; cats.set(x.id, c); }
    pos.push(() => grafico('gRel', { type: 'bar', data: { labels: ms.map(lbl), datasets: [
      { label: 'Meta', data: dados.map(d => d.meta), backgroundColor: css('--line'), borderRadius: 4, maxBarThickness: 28 },
      { label: 'Realizado', data: dados.map(d => d.real), backgroundColor: css('--neg'), borderRadius: 4, maxBarThickness: 28 }] },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    corpo = `<div class="chart-box" style="height:280px;margin:0 16px 12px"><canvas id="gRel"></canvas></div>
      ${cats.size ? `<table class="t"><tr><th class="l">Categoria</th><th>Meta</th><th>Realizado</th><th>Diferença</th><th>%</th></tr>${[...cats.values()].map(c => `<tr><td class="l"><span class="dot" style="background:${esc(c.cor)};margin-right:6px"></span>${esc(c.nome)}</td><td>${vH(r2(c.meta), 'muted')}</td><td>${vH(-r2(c.real))}</td><td>${vH(r2(c.meta - c.real))}</td><td class="num ${c.real > c.meta ? 'neg' : ''}">${c.meta ? Math.round(c.real / c.meta * 100) : 0}%</td></tr>`).join('')}</table>` : vazio('Nenhuma meta de despesa no período.')}`;
    csv = [['Categoria', 'Meta', 'Realizado'], ...[...cats.values()].map(c => [c.nome, fmtN(c.meta), fmtN(c.real)])];
  }
  if (k === 'fluxo') {
    const ms = mesesEntre(ini, fim);
    let saldo = soma(todasIds, id => saldoConta(id, { antes: ini, pendentes: true }));
    const ant = saldo;
    const dados = ms.map(m => { const r = resultadosCaixa(S.lancamentos.filter(l => noMes(l, m) && ehCaixa(l)), todasIds); saldo += r.res; return { m, ...r, saldo: r2(saldo) }; });
    pos.push(() => grafico('gRel', { data: { labels: ms.map(lbl), datasets: [
      { type: 'bar', label: 'Entradas', data: dados.map(d => d.ent), backgroundColor: css('--link'), borderRadius: 4, maxBarThickness: 26 },
      { type: 'bar', label: 'Saídas', data: dados.map(d => d.sai), backgroundColor: css('--neg'), borderRadius: 4, maxBarThickness: 26 },
      { type: 'line', label: 'Saldo', data: dados.map(d => d.saldo), borderColor: css('--accent'), backgroundColor: css('--accent'), tension: .25 }] },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    corpo = `<div class="chart-box" style="height:300px;margin:0 16px 12px"><canvas id="gRel"></canvas></div><table class="t"><tr><th class="l">Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th><th>Saldo</th></tr>
      <tr><td class="l muted">Saldo anterior</td><td></td><td></td><td></td><td>${vH(ant)}</td></tr>
      ${dados.map(d => `<tr><td class="l">${nomeMes(d.m)}</td><td>${vH(d.ent)}</td><td>${vH(d.sai)}</td><td>${vH(d.res)}</td><td>${vH(d.saldo)}</td></tr>`).join('')}
      <tr class="tot"><td class="l">Total</td><td>${vH(soma(dados, d => d.ent))}</td><td>${vH(soma(dados, d => d.sai))}</td><td>${vH(soma(dados, d => d.res))}</td><td>${vH(saldo)}</td></tr></table>`;
    csv = [['Mês', 'Entradas', 'Saídas', 'Resultado', 'Saldo'], ...dados.map(d => [d.m, fmtN(d.ent), fmtN(d.sai), fmtN(d.res), fmtN(d.saldo)])];
  }
  if (k === 'lanccaixa') {
    const lista = S.lancamentos.filter(l => noPeriodo(l, ini, fim) && ehCaixa(l)).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
    corpo = tabelaLanc(lista, soma(todasIds, id => saldoConta(id, { antes: ini, pendentes: true })), todasIds);
    csv = csvLanc(lista);
  }
  if (['apagar', 'areceber', 'pagas', 'recebidas'].includes(k)) {
    const rec = k === 'areceber' || k === 'recebidas', pago = k === 'pagas' || k === 'recebidas';
    const lista = S.lancamentos.filter(l => ehCaixa(l) && l.tipo !== 'transferencia' && (rec ? l.tipo === 'receita' : l.tipo !== 'receita') && !!l.pago === pago && noPeriodo(l, ini, fim))
      .sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
    corpo = tabelaLanc(lista);
    csv = csvLanc(lista);
  }
  if (k === 'totaiscat') {
    const lista = listaCat(ini, fim), itens = porCategoria(lista).filter(x => x.v), tot = soma(itens, x => x.v);
    if (itens.length) pos.push(() => donut('gRel', itens));
    const subs = id => porCategoria(lista.filter(l => (catRaiz(l.categoria_id)?.id || '_') === id), false).filter(x => x.cat?.parent_id);
    corpo = itens.length ? `<div class="chart-box" style="height:260px;margin:0 16px 12px"><canvas id="gRel"></canvas></div><table class="t"><tr><th class="l">Categoria</th><th>Total</th><th class="hide-m">Média mensal</th><th>%</th></tr>
      ${itens.map(x => `<tr><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:6px"></span>${esc(x.nome)}</td><td>${vH(x.v, 'b')}</td><td class="hide-m">${vH(r2(x.v / mesesEntre(ini, fim).length), 'muted')}</td><td class="num muted">${(x.v / tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td></tr>${subs(x.id).map(s => `<tr class="sub"><td class="l">${esc(s.cat.nome)}</td><td>${vH(s.v, 'muted')}</td><td class="hide-m"></td><td class="num">${(s.v / tot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td></tr>`).join('')}`).join('')}
      <tr class="tot"><td class="l">Total</td><td>${vH(tot, 'b')}</td><td class="hide-m">${vH(r2(tot / mesesEntre(ini, fim).length), 'muted')}</td><td>100%</td></tr></table>` : vazio('Sem lançamentos no período.');
    csv = [['Categoria', 'Total', '%'], ...itens.map(x => [x.nome, fmtN(x.v), (x.v / tot * 100).toFixed(1) + '%'])];
  }
  if (k === 'evocat') {
    const ms = mesesEntre(ini, fim), lista = listaCat(ini, fim), itens = porCategoria(lista).filter(x => x.v);
    const val = (id, m) => soma(lista.filter(l => noMes(l, m) && (catRaiz(l.categoria_id)?.id || '_') === id), l => (l.cartao_id && l.tipo === 'receita' ? -1 : 1) * num(l.valor));
    pos.push(() => grafico('gRel', { type: 'line', data: { labels: ms.map(lbl), datasets: itens.slice(0, 8).map(x => ({ label: x.nome, data: ms.map(m => val(x.id, m)), borderColor: x.cor, backgroundColor: x.cor, tension: .25 })) },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    corpo = `<div class="chart-box" style="height:300px;margin:0 16px 12px"><canvas id="gRel"></canvas></div><div style="overflow-x:auto"><table class="t"><tr><th class="l">Categoria</th>${ms.map(m => `<th>${lbl(m)}</th>`).join('')}<th>Total</th></tr>
      ${itens.map(x => `<tr><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:6px"></span>${esc(x.nome)}</td>${ms.map(m => `<td>${vH(val(x.id, m), 'muted')}</td>`).join('')}<td>${vH(x.v, 'b')}</td></tr>`).join('')}
      <tr class="tot"><td class="l">Total</td>${ms.map(m => `<td>${vH(soma(itens, x => val(x.id, m)))}</td>`).join('')}<td>${vH(soma(itens, x => x.v))}</td></tr></table></div>`;
    csv = [['Categoria', ...ms, 'Total'], ...itens.map(x => [x.nome, ...ms.map(m => fmtN(val(x.id, m))), fmtN(x.v)])];
  }
  if (k === 'comparacao') {
    if (!P.ini2) { const n = difDias(ini, fim) + 1; P.fim2 = addDias(ini, -1); P.ini2 = addDias(P.fim2, -(n - 1)); }
    const A = porCategoria(listaCat(ini, fim)), B = porCategoria(listaCat(P.ini2, P.fim2));
    const ids = [...new Set([...A, ...B].map(x => x.id))];
    const rows = ids.map(id => { const a = A.find(x => x.id === id), b = B.find(x => x.id === id); return { nome: (a || b).nome, cor: (a || b).cor, a: a?.v || 0, b: b?.v || 0 }; }).sort((x, y) => y.a - x.a);
    const tA = soma(rows, x => x.a), tB = soma(rows, x => x.b);
    pos.push(() => grafico('gRel', { type: 'bar', data: { labels: rows.slice(0, 12).map(x => x.nome), datasets: [
      { label: `${dataBR(ini)} a ${dataBR(fim)}`, data: rows.slice(0, 12).map(x => x.a), backgroundColor: css('--link'), borderRadius: 4 },
      { label: `${dataBR(P.ini2)} a ${dataBR(P.fim2)}`, data: rows.slice(0, 12).map(x => x.b), backgroundColor: css('--line'), borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: legendaB, tooltip: tooltipBRL }, scales: { y: { ticks: { callback: tickBRL } }, x: { grid: { display: false } } } } }));
    const dif = (a, b) => b ? `${a >= b ? '+' : ''}${((a - b) / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
    corpo = `<div class="chart-box" style="height:280px;margin:0 16px 12px"><canvas id="gRel"></canvas></div><table class="t"><tr><th class="l">Categoria</th><th>Período 1</th><th>Período 2</th><th>Diferença</th><th>%</th></tr>
      ${rows.map(x => `<tr><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:6px"></span>${esc(x.nome)}</td><td>${vH(x.a, 'b')}</td><td>${vH(x.b, 'muted')}</td><td>${vH(r2(x.a - x.b))}</td><td class="num">${dif(x.a, x.b)}</td></tr>`).join('')}
      <tr class="tot"><td class="l">Total</td><td>${vH(tA)}</td><td>${vH(tB)}</td><td>${vH(r2(tA - tB))}</td><td class="num">${dif(tA, tB)}</td></tr></table>`;
    csv = [['Categoria', 'Período 1', 'Período 2', 'Diferença'], ...rows.map(x => [x.nome, fmtN(x.a), fmtN(x.b), fmtN(x.a - x.b)])];
  }
  if (k === 'lanccat') {
    const lista = listaCat(ini, fim).sort((a, b) => a.data < b.data ? -1 : 1), itens = porCategoria(lista, false);
    corpo = itens.map(x => { const ls = lista.filter(l => (catById(l.categoria_id)?.id || '_') === x.id); return `<div class="dsep"><span><span class="dot" style="background:${esc(x.cor)};margin-right:6px"></span>${esc(x.nome)}</span>${vH(tipo === 'despesa' ? -x.v : x.v)}</div>${ls.map(l => linhaL(l)).join('')}`; }).join('') || vazio('Sem lançamentos no período.');
    csv = csvLanc(lista);
  }
  _csvAtual = { linhas: csv, nome: 'relatorio-' + k };
  const presets = [['m0', 'Mês atual'], ['m1', 'Mês anterior'], ['3', 'Últimos 3 meses'], ['6', 'Últimos 6 meses'], ['12', 'Últimos 12 meses'], ['ano', 'Este ano'], ['anoant', 'Ano anterior']];
  return `<div class="card"><div class="card-h"><button class="icon-btn sm" data-act="fecharRel" title="Voltar">${ic('left')}</button><h3>${r[2]}</h3><div class="acts">${acoesLista()}</div></div>
    <div class="card-b"><div class="fr" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end">
      ${soMes ? `<div class="f"><label>Mês</label><input type="month" data-rel="mes" value="${fim.slice(0, 7)}"></div>` : `<div class="f"><label>Período</label><select data-rel="preset"><option value="">Personalizado</option>${presets.map(([kk, n]) => `<option value="${kk}">${n}</option>`).join('')}</select></div>
      <div class="f"><label>De</label><input type="date" data-rel="ini" value="${ini}"></div><div class="f"><label>Até</label><input type="date" data-rel="fim" value="${fim}"></div>`}
      ${k === 'comparacao' ? `<div class="f"><label>Comparar com: de</label><input type="date" data-rel="ini2" value="${P.ini2}"></div><div class="f"><label>até</label><input type="date" data-rel="fim2" value="${P.fim2}"></div>` : ''}
      ${usaTipo ? `<div class="f"><label>Tipo</label><select data-rel="tipo"><option value="despesa" ${tipo === 'despesa' ? 'selected' : ''}>Despesas</option><option value="receita" ${tipo === 'receita' ? 'selected' : ''}>Receitas</option></select></div>` : ''}
    </div></div>${corpo}</div>`;
}
function aplicarPreset(p) {
  const P = S.relParams, h = ymHoje();
  const set = (a, b) => { P.ini = iniMes(a); P.fim = fimMes(b); };
  if (p === 'm0') set(h, h); else if (p === 'm1') set(addMeses(h, -1), addMeses(h, -1));
  else if (p === 'ano') set(h.slice(0, 4) + '-01', h.slice(0, 4) + '-12');
  else if (p === 'anoant') { const y = +h.slice(0, 4) - 1; set(y + '-01', y + '-12'); }
  else if (+p) set(addMeses(h, -(+p - 1)), h);
  P.ini2 = P.fim2 = null;
}
