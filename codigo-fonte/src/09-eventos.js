/* =====================================================================
   EVENTOS
   ===================================================================== */
const VIEWS = { visao: vVisao, lancamentos: vLancamentos, fluxo: vFluxo, pagar: vPagar, pagas: vPagas, extrato: vExtrato, cartoes: vCartoes,
  orcamento: vOrcamento, economia: vEconomia, relatorios: vRelatorios, categorias: vCategorias, contas: vContas, tags: vTags, documentos: vDocumentos,
  regras: vRegras, importar: vImportar, fechamento: vFechamento, config: vConfig, openfinance: vOpenFinance };
const L = id => byId('lancamentos', id);
const ACOES = {
  menu: () => { const d = $('#drawer'), app = $('#app'); if (innerWidth >= 1100) { app.classList.toggle('fixo'); lsSet('nc_menu_fixo', app.classList.contains('fixo') ? '1' : '0'); if (app.classList.contains('fixo')) return; } d.classList.add('open'); $('#scrim').classList.remove('hidden'); },
  fecharMenu: () => fecharMenu(),
  grupo: (d, el) => { el.classList.toggle('fechado'); lsSet('nc_grp_' + d.g, el.classList.contains('fechado') ? '0' : '1'); },
  tema: d => { lsSet('nc_tema', d.v); aplicarTema(); render(); },
  mes: d => { S.mes = addMeses(S.mes, +d.n); render(); },
  mesHoje: () => { S.mes = ymHoje(); render(); },
  sync: async () => { toast('Atualizando…'); await recarregarERender(); toast('Dados atualizados'); },
  userMenu: (d, el) => abrirCMenu(el, [
    { t: lsGet('nc_quem') ? `Neste aparelho: ${lsGet('nc_quem')}` : 'Definir quem usa este aparelho', ic: 'user', f: () => { S.aba.config = 'geral'; irPara('config'); } },
    { t: 'Configurações', ic: 'ajustes', f: () => irPara('config') }, '-', { t: 'Sair', ic: 'logout', f: () => ACOES.sair() }]),
  buscaGlobal: () => buscaGlobal(),
  calc: () => calculadora(),
  fabMain: () => { if (matchMedia('(hover:hover)').matches) formLanc(null, { tipo: 'despesa' }); else { const w = $('#fab'); if (w.classList.contains('open')) { w.classList.remove('open'); formLanc(null, { tipo: 'despesa' }); } else w.classList.add('open'); } },
  novo: d => { $('#fab').classList.remove('open'); formLanc(null, { tipo: d.t, ...(S.view === 'cartoes' && S.cartaoSel && d.t === 'despesa' ? { onde: 'cartao:' + S.cartaoSel } : S.view === 'extrato' && S.extratoConta ? { onde: 'conta:' + S.extratoConta } : {}), ...(S.mes !== ymHoje() && ['lancamentos', 'pagar', 'extrato'].includes(S.view) ? { data: S.mes + '-01' } : {}) }); },
  editLanc: d => { const l = L(d.id); if (l) { fecharModal(); formLanc(l); } },
  lancMenu: (d, el) => { const l = L(d.id); if (l) menuLanc(el, l); },
  togglePago: d => { const l = L(d.id); if (l) alternarPago(l); },
  toggleConc: d => { const l = L(d.id); if (l) alternarPago(l, 'conciliado'); },
  recolher: d => { const lst = lsJSON('nc_recolhidos', []); const i = lst.indexOf(d.id); i >= 0 ? lst.splice(i, 1) : lst.push(d.id); lsSet('nc_recolhidos', JSON.stringify(lst)); $('#' + d.id)?.classList.toggle('recolhido'); },
  ocultar: () => { document.body.classList.toggle('ocultar'); lsSet('nc_ocultar', document.body.classList.contains('ocultar') ? '1' : '0'); render(); },
  selConta: (d, el) => { if (!S.contasSel) S.contasSel = new Set(contasAtivas().map(c => c.id)); el.checked ? S.contasSel.add(d.id) : S.contasSel.delete(d.id); if (S.contasSel.size === contasAtivas().length) S.contasSel = null; render(); },
  selTodas: (d, el) => { S.contasSel = el.checked ? null : new Set(); render(); },
  status: d => { S.status.has(d.s) ? S.status.delete(d.s) : S.status.add(d.s); render(); },
  aba: d => { S.aba[d.k] = d.v; S.status.clear(); render(); },
  exportar: () => { if (_csvAtual?.linhas?.length) baixarCSV(_csvAtual.linhas, _csvAtual.nome); else toast('Nada para exportar.'); },
  imprimir: () => window.print(),
  personalizar: () => personalizar(),
  projCat: d => { lsSet('nc_proj_' + d.id, lsGet('nc_proj_' + d.id) === '0' ? '1' : '0'); render(); },
  verFatura: d => { S.cartaoSel = d.id; S.faturaSel[d.id] = d.ym; irPara('cartoes'); },
  verCartao: d => { S.cartaoSel = d.id; irPara('cartoes'); },
  verExtrato: d => { S.extratoConta = d.id; irPara('extrato'); },
  verCategoria: d => { S.relatorio = 'lanccat'; S.relParams = { ini: iniMes(S.mes), fim: fimMes(S.mes), tipo: 'despesa' }; irPara('relatorios'); },
  fluxoNav: d => { const { ini } = periodoFluxo(); S.fluxoIni = S.fluxoModo === 'mes' ? iniMes(addMeses(ini.slice(0, 7), +d.n)) : addDias(ini, (S.fluxoModo === '30' ? 30 : 7) * +d.n); render(); },
  fluxoHoje: () => { S.fluxoIni = null; render(); },
  fluxoDia: d => { S.mes = d.d.slice(0, 7); S.busca = ''; irPara('lancamentos'); },
  ajustarSaldo: d => formAjuste(byId('contas', d.id)),
  fatNav: d => { S.faturaSel[d.id] = d.ym; render(); },
  fecharFatura: async d => {
    const c = byId('cartoes', d.id), lst = [...(c.faturas_fechadas || [])], i = lst.indexOf(d.ym);
    i >= 0 ? lst.splice(i, 1) : lst.push(d.ym);
    await op(sb.from('cartoes').update({ faturas_fechadas: lst }).eq('id', c.id), i >= 0 ? 'Fatura reaberta' : 'Fatura fechada: novas compras irão para a fatura seguinte');
    await recarregarERender(['cartoes']);
  },
  pagarFatura: d => formPagamento(byId('cartoes', d.id), d.ym),
  antecipar: d => formAntecipar(byId('cartoes', d.id), d.ym),
  novaCompra: d => formLanc(null, { tipo: 'despesa', onde: 'cartao:' + d.id }),
  concFiltro: d => { const s = S.cartaoFiltro.conc; s.has(d.v) ? s.delete(d.v) : s.add(d.v); render(); },
  fatGrafico: () => { S.cartaoFiltro.grafico = !S.cartaoFiltro.grafico; render(); },
  fatOrdem: () => { S.cartaoFiltro.ordem = S.cartaoFiltro.ordem === 'valor' ? 'data' : 'valor'; render(); },
  definirMetas: () => formMetasDespesa(),
  copiarOrc: () => copiarOrc(),
  novaMeta: () => formMeta(),
  metaMenu: (d, el) => { const m = byId('metas', d.id); abrirCMenu(el, [{ t: 'Editar', ic: 'edit', f: () => formMeta(m) }, ...(m.conta_id ? [] : [{ t: 'Guardar', ic: 'up', f: () => formAporte(m, 1) }, { t: 'Retirar', ic: 'down2', f: () => formAporte(m, -1) }]), '-', { t: 'Excluir', ic: 'trash', cls: 'danger', f: async () => { if (await confirmar('Excluir meta', `Excluir “${esc(m.nome)}”?`)) { await excluir('metas', m.id, 'Meta excluída'); await recarregarERender(['metas']); } } }]); },
  aporte: d => formAporte(byId('metas', d.id), +d.s),
  abrirRel: d => { S.relatorio = d.k; render(); window.scrollTo(0, 0); },
  fecharRel: () => { S.relatorio = null; render(); },
  catTipo: d => { S.catTipo = d.v; render(); },
  novaCat: d => formCat(null, d.t),
  editCat: d => formCat(byId('categorias', d.id)),
  catMenu: (d, el) => { const c = byId('categorias', d.id); abrirCMenu(el, [{ t: 'Editar', ic: 'edit', f: () => formCat(c) }, ...(!c.parent_id ? [{ t: 'Nova subcategoria', ic: 'sub', f: () => formCat(null, c.tipo, c.id) }] : []),
    { t: c.ativa === false ? 'Ativar' : 'Inativar', ic: 'eye', f: async () => { await salvar('categorias', { ativa: c.ativa === false }, c.id, c.ativa === false ? 'Categoria ativada' : 'Categoria inativada'); await recarregarERender(['categorias']); } },
    { t: 'Ver lançamentos', ic: 'lista', f: () => { S.relatorio = 'lanccat'; S.relParams = { ini: iniMes(addMeses(ymHoje(), -11)), fim: fimMes(ymHoje()), tipo: c.tipo }; irPara('relatorios'); } }]); },
  novaConta: () => formConta(),
  novoCartao: () => formCartao(),
  novaContaMenu: (d, el) => abrirCMenu(el, [{ t: 'Conta (banco, poupança, carteira…)', ic: 'banco', f: () => formConta() }, { t: 'Cartão de crédito', ic: 'cartao', f: () => formCartao() }]),
  editConta: d => formConta(byId('contas', d.id)),
  editCartao: d => formCartao(byId('cartoes', d.id)),
  novaTag: () => formTag(),
  editTag: d => formTag(byId('tags', d.id)),
  novaRegra: d => formRegra(null, d.t),
  editRegra: d => formRegra(byId('regras', d.id)),
  abrirDoc: d => abrirDoc(d.path),
  apagarDoc: async d => {
    const usados = S.lancamentos.filter(l => (l.anexos || []).some(a => a.path === d.path));
    if (!await confirmar('Excluir documento', `Excluir este documento?${usados.length ? ` Ele será retirado de ${usados.length} lançamento(s).` : ''}`)) return;
    const { error } = await sb.storage.from('documentos').remove([d.path]); if (error) return toast('Erro: ' + traduzErro(error), true);
    for (const l of usados) await sb.from('lancamentos').update({ anexos: l.anexos.filter(a => a.path !== d.path) }).eq('id', l.id);
    _docs = null; toast('Documento excluído'); await recarregarERender(['lancamentos']);
  },
  impLimpar: () => { S.imp = { destino: S.imp.destino, inverter: false, fatura: 'auto', arquivo: '', linhas: null, csv: null }; render(); },
  impConfirmar: () => confirmarImport(),
  mdImportar: async () => { try { await importarMD(); } catch (e) { S.md.fase = 'fim'; S.md.msg = 'A importação parou por um erro: ' + traduzErro(e) + '. Pode tentar de novo: o que já foi gravado não duplica.'; render(); } },
  mdCancelar: () => { S.md = null; render(); },
  mdFechar: () => { S.md = null; irPara('visao'); },
  marcarFech: () => $$('[data-fech]').forEach(x => x.checked = true),
  fecharPos: () => aplicarFechamento(true),
  reabrirPos: () => aplicarFechamento(false),
  copiarLink: async () => { const t = linkConfig(); try { await navigator.clipboard.writeText(t); } catch { const i = $('#linkCfg'); i.select(); document.execCommand('copy'); } toast('Link copiado'); },
  trocarConexao: async () => { if (!await confirmar('Trocar conexão', 'Desconectar este aparelho do banco atual? Os dados continuam salvos no Supabase.', 'Desconectar')) return; try { await sb.auth.signOut(); } catch {} apagarConfig(); telaSetup(1); },
  exportTudo: () => baixarCSV(csvLanc([...S.lancamentos].sort((a, b) => a.data < b.data ? -1 : 1)), 'nosso-caixa-lancamentos'),
  backup: () => { const dados = { versao: VERSAO, gerado_em: new Date().toISOString(), ...Object.fromEntries(TABELAS.map(t => [t, S[t]])), preferencias: S.prefs }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' })); a.download = `nosso-caixa-backup-${hoje()}.json`; a.click(); },
  sair: async () => { await sb.auth.signOut(); S.lancamentos = []; telaLogin(); },
};
async function aplicarFechamento(fechar) {
  const tipo = S.aba.fech || 'conta', data = $('#dataFech')?.value;
  if (fechar && !data) return toast('Informe a data.', true);
  if (tipo === 'global') {
    S.prefs.fechamento_global = fechar ? data : null;
    await salvarPrefs(fechar ? `Posição fechada até ${dataBR(data)} para todas as contas` : 'Fechamento global removido');
    return render();
  }
  const sel = $$('[data-fech]:checked').map(x => x.dataset.fech.split(':'));
  if (!sel.length) return toast('Selecione as contas.', true);
  for (const [k, id] of sel) await op(sb.from(k === 'conta' ? 'contas' : 'cartoes').update({ fechado_ate: fechar ? data : null }).eq('id', id));
  toast(fechar ? `Posição fechada até ${dataBR(data)}` : 'Posição reaberta');
  await recarregarERender(['contas', 'cartoes']);
}
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); irPara(nav.dataset.nav); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio')) return;
  if (el.closest('.overlay') && !['editLanc', 'lancMenu', 'togglePago'].includes(el.dataset.act)) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.type === 'radio') return;
  const fn = ACOES[el.dataset.act];
  if (fn) { e.stopPropagation(); Promise.resolve(fn(el.dataset, el, e)).catch(err => console.error(err)); }
});
document.addEventListener('input', e => {
  const f = e.target.dataset?.filtro;
  if (!f) return;
  S[f] = e.target.value;
  clearTimeout(window._bt);
  window._bt = setTimeout(() => { const pos = e.target.selectionStart; render(); const i = $(`[data-filtro="${f}"]`); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch {} } }, 250);
});
document.addEventListener('change', async e => {
  const t = e.target, d = t.dataset || {};
  if (t.closest('.overlay')) return;
  if (d.act === 'selExtrato') { S.extratoConta = t.value; render(); }
  if (d.act === 'selCartao') { S.cartaoSel = t.value; S.cartaoFiltro.titular = ''; render(); }
  if (d.act === 'titularFiltro') { S.cartaoFiltro.titular = t.value; render(); }
  if (d.act === 'fluxoModo') { S.fluxoModo = t.value; lsSet('nc_fluxo', t.value); S.fluxoIni = null; render(); }
  if (d.act === 'catAtivas') { S.catAtivas = t.checked; render(); }
  if (d.act === 'contasAtivas') { S.contasAtivas = t.checked; render(); }
  if (d.act === 'tipoFech') { S.aba.fech = t.value; render(); }
  if (d.act === 'enviarDocs') { const env = await enviarArquivos([...t.files]); if (env.length) toast(`${env.length} documento(s) enviado(s)`); _docs = null; render(); }
  if (d.act === 'impArquivo' && t.files[0]) lerArquivoImport(t.files[0]).catch(err => toast('Não foi possível ler o arquivo: ' + err.message, true));
  if (d.rel) {
    const P = S.relParams;
    if (d.rel === 'preset') { if (t.value) aplicarPreset(t.value); }
    else if (d.rel === 'mes') { P.fim = fimMes(t.value); }
    else { P[d.rel] = t.value; if (d.rel === 'ini' || d.rel === 'fim') { P.ini2 = P.fim2 = null; } }
    render();
  }
  if (d.imp !== undefined || d.impSel !== undefined || d.impCat !== undefined) {
    const I = S.imp;
    if (d.impSel !== undefined) { I.linhas[+d.impSel].sel = t.checked; return render(); }
    if (d.impCat !== undefined) { I.linhas[+d.impCat].cat = t.value; return; }
    if (d.imp === 'destino') { I.destino = t.value; I.fatura = 'auto'; if (I.brutas) prepararLinhas(I.brutas); }
    else if (d.imp === 'fatura') I.fatura = t.value;
    else if (d.imp === 'inverter') { I.inverter = t.checked; prepararLinhas(I.brutas); }
    else if (d.imp === 'todos') I.linhas.forEach(x => x.sel = t.checked);
    else if (d.imp.startsWith('map.')) { const k = d.imp.slice(4); I.csv.map[k] = k === 'header' ? t.checked : +t.value; I.brutas = linhasDoCSV(); prepararLinhas(I.brutas); }
    render();
  }
  if (d.recurso) { S.prefs.recursos = { ...(S.prefs.recursos || {}), [d.recurso]: t.checked }; await salvarPrefs('Configuração salva'); $('#nav').innerHTML = navHTML(); render(); }
  if (t.id === 'quem') { lsSet('nc_quem', t.value.trim()); $('#quemTop').textContent = t.value.trim() || 'Família'; toast('Salvo neste aparelho'); }
  if (t.id === 'padraoPago') { lsSet('nc_padrao_pago', t.value); toast('Salvo neste aparelho'); }
  if (t.id === 'tema') { lsSet('nc_tema', t.value); aplicarTema(); render(); }
  if (t.id === 'menuFixo') { lsSet('nc_menu_fixo', t.value); $('#app').classList.toggle('fixo', t.value !== '0'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('.cmenu')) fecharCMenu(); else if ($('.overlay')) $$('.overlay').pop().remove(); else $('.calc')?.remove(); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && $('.overlay form')) $('.overlay form').requestSubmit($('.overlay form button[type=submit]'));
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.view && VIEWS[h] && $('#view')) irPara(h); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && $('#view') && !$('.overlay') && Date.now() - S.carregadoEm > 60000) recarregarERender();
});
function aplicarTema() { const t = lsGet('nc_tema'); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* =====================================================================
   INÍCIO
   ===================================================================== */
async function iniciarApp() {
  $('#root').innerHTML = '<div class="loading">Carregando seus dados…</div>';
  try {
    const { data: { user } } = await sb.auth.getUser();
    S.uid = user?.id;
    await carregarPrefs();
    await carregar();
    if (!S.categorias.length) await semearCategorias();
    await estenderFixas();
  } catch (e) {
    if (tabelaFaltando(e) || /column .* does not exist|preferencias|regras|tags/i.test(e?.message || '')) return telaSetup(2, 'O banco precisa ser atualizado para esta versão: execute o SQL abaixo no Supabase.');
    $('#root').innerHTML = `<div class="login"><div class="box card"><div class="err-msg">Não foi possível carregar os dados: ${esc(traduzErro(e))}</div><button class="btn" data-act="sair">Sair</button></div></div>`;
    return;
  }
  if (lsGet('nc_ocultar') === '1') document.body.classList.add('ocultar');
  casca();
  irPara(S.md ? 'importar' : (location.hash.slice(1) || 'visao'));
  avisarMeuDinheiro();
}
(async function () {
  aplicarTema();
  if (!window.supabase) { $('#root').innerHTML = '<div class="loading">Não foi possível carregar a biblioteca do Supabase. Verifique a internet.</div>'; return; }
  const cfg = lerConfig();
  if (!cfg) return telaSetup(1);
  conectar(cfg);
  const { data: { session } } = await sb.auth.getSession();
  if (session) iniciarApp(); else telaLogin();
})();
