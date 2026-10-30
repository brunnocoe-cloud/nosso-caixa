/* =====================================================================
   INTERFACE: estrutura, menu, componentes comuns
   ===================================================================== */
function toast(msg, erro = false) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (erro ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), erro ? 5000 : 2400);
}

// menu igual ao do Meu Dinheiro (itens podem ser desligados em Configurações de utilização)
const MENU = [
  ['visao', 'Visão geral', 'visao'],
  { grupo: 'mov', nome: 'Movimentações e caixa', icone: 'mov', itens: [
    ['lancamentos', 'Lançamentos', 'lista'], ['fluxo', 'Fluxos', 'fluxo'], ['pagar', 'A pagar e receber', 'receipt'], ['pagas', 'Pagas e recebidas', 'taskok'],
  ] },
  ['extrato', 'Extrato de contas', 'extrato'],
  ['cartoes', 'Cartões de crédito', 'cartao', 'cartoes'],
  { grupo: 'metas', nome: 'Metas', icone: 'flag', itens: [['orcamento', 'Orçamento', 'pie', 'orcamento'], ['economia', 'Economia', 'savings', 'economia']] },
  ['relatorios', 'Relatórios', 'relat'],
  { grupo: 'cad', nome: 'Cadastros', icone: 'cad', itens: [
    ['categorias', 'Categorias', 'categ'], ['contas', 'Contas', 'banco'], ['tags', 'Tags', 'tag', 'tags'], ['documentos', 'Documentos', 'clip'],
    ['regras', 'Regras de preenchimento', 'magic'], ['importar', 'Importar lançamentos', 'upload'], ['openfinance', 'Open Finance (banco)', 'sync'], ['fechamento', 'Fechamento posição', 'lock'],
  ] },
  ['config', 'Configurações de utilização', 'ajustes'],
];
const TITULOS = {
  visao: 'Visão geral', lancamentos: 'Lançamentos de caixa', fluxo: 'Fluxo de caixa', pagar: 'Contas a pagar e receber', pagas: 'Contas pagas e recebidas',
  extrato: 'Extrato de contas', cartoes: 'Cartões de crédito', orcamento: 'Metas de despesa', economia: 'Metas de economia', relatorios: 'Relatórios',
  categorias: 'Categorias', contas: 'Contas', tags: 'Tags', documentos: 'Documentos', regras: 'Regras de preenchimento', importar: 'Importar lançamentos',
  fechamento: 'Fechamento de posição', openfinance: 'Open Finance · lançamentos automáticos', config: 'Configurações de utilização',
};
const itemVisivel = it => !it[3] || recurso(it[3]);
function navHTML() {
  return MENU.map(m => {
    if (!m.grupo) return itemVisivel(m) ? `<a href="#${m[0]}" data-nav="${m[0]}">${ic(m[2])}<span>${m[1]}</span></a>` : '';
    const itens = m.itens.filter(itemVisivel);
    if (!itens.length) return '';
    const fechado = lsGet('nc_grp_' + m.grupo) === '0';
    return `<button type="button" class="grp ${fechado ? 'fechado' : ''}" data-act="grupo" data-g="${m.grupo}">${ic(m.icone)}<span>${m.nome}</span>${ic('down', 'car')}</button>
      <div class="subnav">${itens.map(([k, n, i]) => `<a href="#${k}" data-nav="${k}">${ic(i)}<span>${n}</span></a>`).join('')}</div>`;
  }).join('');
}
function casca() {
  const fixo = lsGet('nc_menu_fixo') !== '0';
  $('#root').innerHTML = `<div class="app ${fixo ? 'fixo' : ''}" id="app">
    <aside class="drawer" id="drawer">
      <div class="brand"><span class="logo">${LOGO}</span>Nosso Caixa</div>
      <nav class="nav" id="nav">${navHTML()}</nav>
      <div class="temas">
        <button class="icon-btn sm" data-act="tema" data-v="light" title="Tema claro">${ic('sun')}</button>
        <button class="icon-btn sm" data-act="tema" data-v="dark" title="Tema escuro">${ic('moon')}</button>
        <button class="icon-btn sm" data-act="tema" data-v="" title="Tema do sistema">${ic('auto')}</button>
      </div>
      <div class="ver">Versão ${VERSAO}</div>
    </aside>
    <div class="scrim hidden" id="scrim" data-act="fecharMenu"></div>
    <header class="topbar">
      <button class="icon-btn" data-act="menu" aria-label="Menu">${ic('menu')}</button>
      <h1 id="titulo"></h1>
      <button class="icon-btn" data-act="buscaGlobal" title="Buscar lançamentos">${ic('search')}</button>
      <button class="icon-btn hide-m" data-act="calc" title="Calculadora">${ic('calc')}</button>
      <button class="icon-btn" data-act="sync" title="Atualizar dados">${ic('sync')}</button>
      <button class="userbtn" data-act="userMenu">${ic('user')}<span class="hide-m" id="quemTop">${esc(lsGet('nc_quem') || 'Família')}</span>${ic('down')}</button>
    </header>
    <main class="content" id="view"></main>
  </div>
  <div class="fab-w" id="fab">
    <button class="fab main" data-act="fabMain" aria-label="Nova despesa">${ic('plus')}</button>
    <button class="fab mini rec" data-act="novo" data-t="receita" aria-label="Receita">${ic('up')}<span class="tip">Receita</span></button>
    <button class="fab mini" data-act="novo" data-t="transferencia" aria-label="Transferência">${ic('transf')}<span class="tip">Transferência</span></button>
    <button class="fab mini" data-act="novo" data-t="detalhado" aria-label="Lançamento detalhado">${ic('hub')}<span class="tip">Lançamento detalhado</span></button>
    <button class="fab mini desp" data-act="novo" data-t="despesa" aria-label="Despesa">${ic('down2')}<span class="tip">Despesa</span></button>
  </div>`;
}
function irPara(v) {
  if (!VIEWS[v]) v = 'visao';
  S.view = v;
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  if (!$('#app')?.classList.contains('fixo') || innerWidth < 1100) fecharMenu();
  render();
  window.scrollTo(0, 0);
}
function fecharMenu() { $('#drawer')?.classList.remove('open'); $('#scrim')?.classList.add('hidden'); }
function render() {
  if (!$('#view')) return;
  charts.forEach(c => c.destroy()); charts = [];
  fecharCMenu();
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === S.view));
  const g = MENU.find(m => m.grupo && m.itens.some(i => i[0] === S.view));
  if (g) $(`[data-g="${g.grupo}"]`)?.classList.remove('fechado');
  $('#titulo').textContent = TITULOS[S.view] || '';
  document.title = (TITULOS[S.view] || 'Nosso Caixa') + ' · Nosso Caixa';
  const pos = [];
  $('#view').innerHTML = VIEWS[S.view](pos);
  pos.forEach(f => f());
}

/* ---------- gráficos ---------- */
function grafico(id, cfg) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  Chart.defaults.font.family = 'Roboto, system-ui, sans-serif';
  Chart.defaults.color = css('--muted');
  Chart.defaults.borderColor = css('--line');
  charts.push(new Chart(el, cfg));
}
const tickBRL = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const tooltipBRL = { callbacks: { label: c => ` ${c.dataset.label ? c.dataset.label + ': ' : ''}${fmt(c.parsed.y ?? c.parsed)}` } };
const legendaB = { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } };
function donut(id, itens) {
  grafico(id, {
    type: 'doughnut',
    data: { labels: itens.map(x => x.nome), datasets: [{ data: itens.map(x => Math.abs(x.v)), backgroundColor: itens.map(x => x.cor), borderWidth: 2, borderColor: css('--surface') }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` } } } },
  });
}

/* ---------- componentes ---------- */
function cardH(titulo, acts = '', id = '', recolhivel = true) {
  return `<div class="card-h"><h3>${titulo}</h3><div class="acts">${acts}${recolhivel && id ? `<button class="icon-btn sm" data-act="recolher" data-id="${id}" title="Recolher">${ic('car', 'car')}</button>` : ''}</div></div>`;
}
const recolhido = id => lsJSON('nc_recolhidos', []).includes(id);
function painelMes(extra = '') {
  return `<div class="card"><div class="mesnav">
    <button class="icon-btn" data-act="mes" data-n="-1" aria-label="Mês anterior">${ic('left')}</button>
    <span class="lbl">${nomeMes(S.mes)}</span>
    <button class="icon-btn" data-act="mes" data-n="1" aria-label="Próximo mês">${ic('right')}</button>
    <button class="icon-btn sm" data-act="mesHoje" title="Ir para o mês atual">${ic('clock')}</button>${extra}
  </div></div>`;
}
// painel "Saldos de caixa": confirmado × projetado, com seleção de contas
function painelSaldos(fim, titulo = 'Saldos de caixa', wid = '') {
  const contas = contasAtivas();
  const sel = id => !S.contasSel || S.contasSel.has(id);
  const linhas = contas.map(c => ({ c, conf: saldoConta(c.id, { ate: fim }), proj: saldoConta(c.id, { ate: fim, pendentes: true }) }));
  const tot = linhas.filter(x => sel(x.c.id) && x.c.considerar_saldo !== false);
  const todos = contas.every(c => sel(c.id));
  return `<div class="card ${wid && recolhido(wid) ? 'recolhido' : ''}" ${wid ? `id="${wid}"` : ''}>${cardH(titulo, `<button class="icon-btn sm" data-act="ocultar" title="Mostrar/ocultar valores">${ic(document.body.classList.contains('ocultar') ? 'eyeoff' : 'eye')}</button>`, wid)}
    <div class="card-b flush"><table class="t">
      <tr><th class="l"><input type="checkbox" class="ck" data-act="selTodas" ${todos ? 'checked' : ''} aria-label="Todas as contas"></th><th>Confirmado</th><th>Projetado</th></tr>
      ${linhas.map(x => `<tr><td class="l"><label style="cursor:pointer"><input type="checkbox" class="ck" data-act="selConta" data-id="${x.c.id}" ${sel(x.c.id) ? 'checked' : ''}><span class="dot" style="background:${esc(x.c.cor)};margin-right:6px"></span>${esc(x.c.nome)}</label></td><td>${vH(x.conf)}</td><td>${vH(x.proj)}</td></tr>`).join('')
        || `<tr><td colspan="3" class="l muted">Nenhuma conta cadastrada. <a href="#contas">Cadastrar</a></td></tr>`}
      <tr class="tot"><td class="l">Total</td><td>${vH(soma(tot, x => x.conf))}</td><td>${vH(soma(tot, x => x.proj))}</td></tr>
    </table></div></div>`;
}
// painel "Resultados": entradas e saídas das contas selecionadas no período
function resultadosCaixa(lista, ids) {
  let rec = 0, te = 0, desp = 0, ts = 0;
  for (const l of lista) {
    const e = ids.reduce((a, id) => a + efeitoConta(l, id), 0);
    if (!e) continue;
    const transf = l.tipo === 'transferencia' || l.tipo === 'pagamento_fatura';
    if (e > 0) transf ? te += e : rec += e; else transf ? ts += e : desp += e;
  }
  return { rec: r2(rec), te: r2(te), desp: r2(desp), ts: r2(ts), ent: r2(rec + te), sai: r2(desp + ts), res: r2(rec + te + desp + ts) };
}
function painelResultados(r, titulo = 'Resultados (R$)') {
  return `<div class="card">${cardH(titulo)}<div class="card-b">
    <div class="kv"><span>Entradas</span>${vH(r.ent)}</div>
    <div class="kv ind"><span>Receitas</span>${vH(r.rec)}</div><div class="kv ind"><span>Transferências</span>${vH(r.te)}</div>
    <div class="kv"><span>Saídas</span>${vH(r.sai)}</div>
    <div class="kv ind"><span>Despesas</span>${vH(r.desp)}</div><div class="kv ind"><span>Transferências</span>${vH(r.ts)}</div>
    <div class="kv tot"><span>Resultado</span>${vH(r.res)}</div></div></div>`;
}
function chipsStatus(lista) {
  return `<span class="lbl">Filtrar</span>` + lista.map(s => `<button class="fchip ${S.status.has(s) ? 'on' : ''}" data-act="status" data-s="${s}"><i></i>${STATUS_N[s]}</button>`).join('');
}
const acoesLista = (csv = true) => `<span class="sp"></span><span class="acts" style="display:flex">${csv ? `<button class="icon-btn sm" data-act="exportar" title="Exportar (CSV)">${ic('dl')}</button>` : ''}<button class="icon-btn sm" data-act="imprimir" title="Imprimir">${ic('print')}</button></span>`;
// ícone de status clicável (pendente / atrasado / agendado / confirmado / conciliado)
function stBtn(l) {
  const s = statusL(l), h = hoje();
  if (s === 'conciliado') return `<button class="st conc" data-act="togglePago" data-id="${l.id}" title="Conciliado">${ic('dcheck')}</button>`;
  if (s === 'confirmado') return `<button class="st conf" data-act="togglePago" data-id="${l.id}" title="Confirmado — clique para voltar a pendente">${ic('checkc')}</button>`;
  const atraso = l.data < h ? difDias(l.data, h) : 0;
  return `<button class="st ${atraso ? 'atr' : 'pend'}" data-act="togglePago" data-id="${l.id}" title="${s === 'agendado' ? 'Agendado' : atraso ? `Atrasado ${atraso} dia(s)` : 'Pendente'} — clique para confirmar">${ic('clock')}${atraso ? `<span class="dias">${atraso > 99 ? '99+' : atraso}</span>` : ''}</button>`;
}
const chipConta = id => { const c = byId('contas', id); return c ? `<span class="chip"><span class="dot" style="background:${esc(c.cor)}"></span>${esc(c.nome)}</span>` : ''; };
const chipCartao = id => { const c = byId('cartoes', id); return c ? `<span class="chip cc">${ic('cartao')}${esc(c.nome)}</span>` : ''; };
const chipCat = id => `<span class="chip"><span class="dot" style="background:${esc(corCat(id))}"></span>${esc(nomeCat(id))}</span>`;
const chipsTags = l => (l.tags || []).map(t => byId('tags', t)).filter(Boolean).map(t => `<span class="chip tag" style="background:${esc(t.cor)}">${esc(t.nome)}</span>`).join('');
const marcaSerie = l => l.total_parcelas > 1 ? ` <span class="chip">${l.parcela}/${l.total_parcelas}</span>` : (l.serie || '').startsWith('fixa') ? ` <span class="rep" title="Fixa (repete todo mês)">${ic('rep')}</span>` : l.serie === 'detalhado' ? ` <span class="rep" title="Lançamento detalhado">${ic('hub')}</span>` : '';
// linha de lançamento no estilo do Meu Dinheiro
function linhaL(l, o = {}) {
  const ids = o.ids || contasAtivas().map(c => c.id);
  let v;
  if (o.cartao) v = l.tipo === 'despesa' ? -num(l.valor) : num(l.valor);
  else v = l.tipo === 'receita' ? num(l.valor) : l.tipo === 'despesa' ? -num(l.valor) : (o.ids ? ids.reduce((a, id) => a + efeitoConta(l, id), 0) || -num(l.valor) : -num(l.valor));
  let chips = '';
  if (l.tipo === 'transferencia') chips = `${chipConta(l.conta_id)} <span class="muted">→</span> ${chipConta(l.conta_destino_id)} <span class="chip">Transferência</span>`;
  else if (l.tipo === 'pagamento_fatura') chips = `${chipConta(l.conta_id)} <span class="muted">⇄</span> ${chipCartao(l.cartao_id)} <span class="chip">Pagamento de cartão</span>`;
  else chips = `${o.cartao ? (l.criado_por ? `<span class="chip cc">${ic('cartao')}${esc(l.criado_por)}</span>` : '') : l.cartao_id ? chipCartao(l.cartao_id) : (o.semConta ? '' : chipConta(l.conta_id))} ${chipCat(l.categoria_id)}${!o.cartao && l.criado_por ? ` <span class="chip">${esc(l.criado_por)}</span>` : ''}`;
  chips += chipsTags(l) + ((l.anexos || []).length ? ` <span class="rep" title="${(l.anexos || []).length} anexo(s)">${ic('clip')}</span>` : '');
  const st = o.cartao ? `<button class="st ${l.conciliado ? 'conc' : ''}" style="color:${l.conciliado ? '' : 'var(--line)'}" data-act="toggleConc" data-id="${l.id}" title="${l.conciliado ? 'Conciliado' : 'Não conciliado'} — clique para alternar">${ic(l.conciliado ? 'dcheck' : 'checkc')}</button>` : stBtn(l);
  return `<div class="lrow">
    ${o.semData ? '' : `<span class="dt ${l.data === hoje() ? 'hoje' : ''}">${dataCurta(l.data)}</span>`}
    <div class="mid" data-act="editLanc" data-id="${l.id}"><div class="ds">${esc(l.descricao)}${marcaSerie(l)}</div><div class="chips">${chips}</div></div>
    ${o.cartao ? '' : st}
    <span class="val num v ${corV(v)}">${fmtN(v)}</span>
    ${o.saldo !== undefined ? `<span class="sal num v">${fmtN(o.saldo)}</span>` : ''}
    ${o.cartao ? st : ''}
    <button class="icon-btn sm" data-act="lancMenu" data-id="${l.id}" aria-label="Opções">${ic('more')}</button>
  </div>`;
}
const vazio = (txt, botao = '') => `<div class="empty"><div class="ico">ⓘ</div>${txt}${botao ? `<br>${botao}` : ''}</div>`;

/* ---------- menu de contexto ---------- */
function abrirCMenu(el, itens) {
  fecharCMenu();
  const m = document.createElement('div');
  m.className = 'cmenu';
  m.innerHTML = itens.map(it => it === '-' ? '<hr>' : `<button data-i="${itens.indexOf(it)}" class="${it.cls || ''}">${it.ic ? ic(it.ic) : ''}${esc(it.t)}</button>`).join('');
  document.body.appendChild(m);
  const r = el.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h > innerHeight - 8 ? Math.max(8, r.top - h) : r.bottom) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; fecharCMenu(); itens[+b.dataset.i].f(); });
  setTimeout(() => document.addEventListener('click', fecharCMenuFora, { once: true }), 0);
}
function fecharCMenuFora(e) { if (!e.target.closest('.cmenu')) fecharCMenu(); }
function fecharCMenu() { $$('.cmenu').forEach(m => m.remove()); }

/* ---------- modais ---------- */
function modal({ titulo, tituloHTML, corpo, ok = 'Salvar', extra = '', rodape, onSubmit, onOpen, largo = false }) {
  fecharModal();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<form class="modal ${largo ? 'wide' : ''}" novalidate><header>${tituloHTML || `<h2>${esc(titulo)}</h2>`}<button type="button" class="icon-btn" data-close aria-label="Fechar">${ic('x')}</button></header>
    <div class="body">${corpo}<div class="err-msg hidden" id="mErr"></div></div>
    <footer>${rodape ?? `${extra}<span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn pri">${esc(ok)}</button>`}</footer></form>`;
  document.body.appendChild(ov);
  const form = ov.querySelector('form');
  ov.addEventListener('mousedown', e => { if (e.target === ov) fecharModal(); });
  ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', fecharModal));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const sub = e.submitter;
    const btns = form.querySelectorAll('footer button');
    const err = form.querySelector('#mErr'); err.classList.add('hidden');
    try {
      btns.forEach(b => b.disabled = true);
      const msg = await onSubmit(form, sub);
      if (typeof msg === 'string') { err.textContent = msg; err.classList.remove('hidden'); err.scrollIntoView({ block: 'nearest' }); btns.forEach(b => b.disabled = false); return; }
      if (msg !== false) fecharModal(); else btns.forEach(b => b.disabled = false);
    } catch (ex) { btns.forEach(b => b.disabled = false); console.error(ex); }
  });
  onOpen?.(form);
  const first = form.querySelector('[autofocus]') || form.querySelector('.body input:not([type=hidden]):not([type=checkbox]):not([type=file]),.body select');
  if (first && matchMedia('(min-width:700px)').matches) first.focus();
  return form;
}
function fecharModal() { $$('.overlay').forEach(o => o.remove()); }
function escolha(titulo, texto, opcoes) {
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.zIndex = 85;
    ov.innerHTML = `<div class="modal" style="max-width:440px"><header><h2>${esc(titulo)}</h2></header><div class="body"><p>${texto}</p></div>
      <footer><span class="sp"></span>${opcoes.map((o, i) => `<button type="button" class="btn ${o.cls || ''}" data-i="${i}">${esc(o.t)}</button>`).join('')}</footer></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { ov.remove(); res(opcoes[+b.dataset.i].v); } else if (e.target === ov) { ov.remove(); res(null); } });
  });
}
const confirmar = (titulo, texto, ok = 'Excluir') => escolha(titulo, texto, [{ t: 'Cancelar', v: false }, { t: ok, v: true, cls: 'danger' }]);
const v = (form, n) => form.elements[n]?.value ?? '';
const corInput = (val, nome = 'cor') => `<div class="f"><label>Cor</label><input type="color" name="${nome}" value="${esc(val)}"></div>`;
const swHTML = (name, checked, attrs = '') => `<label class="sw"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${attrs}><span></span></label>`;

/* ---------- exportar / imprimir ---------- */
let _csvAtual = null;   // cada tela registra aqui as linhas exportáveis
function baixarCSV(linhas, nome) {
  const csv = '﻿' + linhas.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nome}-${hoje()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csvLanc = lista => [['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta/Cartão', 'Fatura', 'Valor', 'Situação', 'Parcela', 'Titular/Pessoa', 'Tags', 'Observação'],
  ...lista.map(l => [dataBR(l.data), l.tipo, l.descricao, (l.tipo === 'despesa' || l.tipo === 'receita') ? nomeCat(l.categoria_id) : '', ondeTexto(l),
    l.fatura_mes ? mesCurto(fatMes(l)) : '', NUM.format(num(l.valor)), statusL(l), l.total_parcelas > 1 ? `${l.parcela}/${l.total_parcelas}` : '',
    l.criado_por || '', (l.tags || []).map(t => byId('tags', t)?.nome).filter(Boolean).join(', '), l.observacao || ''])];
