/* =====================================================================
   CADASTROS: CATEGORIAS
   ===================================================================== */
function vCategorias() {
  const tipo = S.catTipo;
  const n = t => S.categorias.filter(c => c.tipo === t).length;
  const arv = arvoreCategorias(tipo, S.catAtivas);
  const uso = id => S.lancamentos.filter(l => l.categoria_id === id).length;
  _csvAtual = { linhas: [['Tipo', 'Categoria', 'Subcategoria', 'Ativa', 'Lançamentos'], ...arvoreCategorias('despesa').concat(arvoreCategorias('receita')).map(({ c }) => { const p = c.parent_id ? catById(c.parent_id) : null; return [c.tipo, p ? p.nome : c.nome, p ? c.nome : '', c.ativa === false ? 'não' : 'sim', uso(c.id)]; })], nome: 'categorias' };
  return `<div class="tabs"><button class="tab ${tipo === 'despesa' ? 'on' : ''}" data-act="catTipo" data-v="despesa">${ic('down2')} Despesas <span class="chip">${n('despesa')}</span></button><button class="tab ${tipo === 'receita' ? 'on' : ''}" data-act="catTipo" data-v="receita">${ic('up')} Receitas <span class="chip">${n('receita')}</span></button></div>
    <div class="card" style="max-width:820px;margin:0 auto"><div class="tb"><label class="inline" style="margin:0">${swHTML('ativas', S.catAtivas, 'data-act="catAtivas"')}<span>Exibir apenas categorias ativas</span></label><span class="sp"></span>
      <button class="btn sm" data-act="exportar">${ic('dl')}Exportar categorias</button><button class="btn sm pri" data-act="novaCat" data-t="${tipo}">${ic('plus')}Nova</button></div>
      <div class="lista-cad">${arv.map(({ c, nivel }) => `<div class="item ${nivel ? 'sub' : ''} ${c.ativa === false ? 'off' : ''}" data-act="editCat" data-id="${c.id}">
        ${nivel ? `<span class="muted">${ic('sub')}</span>` : ''}<span class="dot" style="background:${esc(c.cor)}"></span><div class="grow">${esc(c.nome)}${!nivel && S.categorias.some(s => s.parent_id === c.id) ? ` <span class="chip">${S.categorias.filter(s => s.parent_id === c.id).length}</span>` : ''}${c.ativa === false ? ' <span class="chip">inativa</span>' : ''}</div>
        <span class="s">${uso(c.id)} lanç.</span><button class="icon-btn sm" data-act="catMenu" data-id="${c.id}" aria-label="Opções">${ic('more')}</button></div>`).join('') || vazio('Nenhuma categoria.')}</div></div>`;
}

/* =====================================================================
   CADASTROS: CONTAS
   ===================================================================== */
function vContas() {
  const b = semAcento(S.buscaContas || ''), ativas = S.contasAtivas !== false;
  const filtra = x => (!b || semAcento(x.nome).includes(b));
  const grupos = Object.entries(TIPOS_CONTA).map(([t, n]) => [n, S.contas.filter(c => c.tipo === t && filtra(c) && (!ativas || !c.arquivada))]).filter(g => g[1].length);
  const cards = S.cartoes.filter(k => filtra(k) && (!ativas || !k.arquivado));
  _csvAtual = { linhas: [['Tipo', 'Nome', 'Saldo/Limite', 'Ativa'], ...S.contas.map(c => [TIPOS_CONTA[c.tipo], c.nome, fmtN(saldoConta(c.id, { ate: hoje() })), c.arquivada ? 'não' : 'sim']), ...S.cartoes.map(k => ['Cartão de crédito', k.nome, fmtN(k.limite), k.arquivado ? 'não' : 'sim'])], nome: 'contas' };
  return `<div class="card" style="max-width:900px;margin:0 auto"><div class="tb"><input class="busca" placeholder="Filtrar contas" data-filtro="buscaContas" value="${esc(S.buscaContas || '')}">
      <label class="inline" style="margin:0">${swHTML('ativas', ativas, 'data-act="contasAtivas"')}<span class="hide-m">Exibir apenas contas ativas</span></label>
      <button class="btn sm" data-act="exportar">${ic('dl')}<span class="hide-m">Exportar contas</span></button><button class="btn sm pri" data-act="novaContaMenu">${ic('plus')}Nova</button></div>
    <div class="lista-cad">
      ${grupos.map(([n, cs]) => `<div class="grp-h">${n} · ${cs.length} conta${cs.length > 1 ? 's' : ''}</div>${cs.map(c => { const s = saldoConta(c.id, { ate: hoje() }); return `<div class="item ${c.arquivada ? 'off' : ''}" data-act="editConta" data-id="${c.id}"><span class="logo" style="width:30px;height:30px;font-size:12px;background:${esc(c.cor)};color:#fff">${esc(c.nome.slice(0, 2).toUpperCase())}</span>
        <div class="grow">${esc(c.nome)}<div class="s">${c.considerar_saldo === false ? 'Não considera saldo' : 'Considerar saldo'}${c.arquivada ? ' · inativa' : ''}${c.fechado_ate ? ` · fechada até ${dataBR(c.fechado_ate)}` : ''}</div></div>
        <div style="text-align:right"><div class="s">Saldo atual</div>${vH(s)}</div><button class="icon-btn sm" data-act="verExtrato" data-id="${c.id}" title="Extrato">${ic('extrato')}</button></div>`; }).join('')}`).join('')}
      ${cards.length ? `<div class="grp-h">Cartão de Crédito · ${cards.length} conta${cards.length > 1 ? 's' : ''}</div>${cards.map(k => `<div class="item ${k.arquivado ? 'off' : ''}" data-act="editCartao" data-id="${k.id}"><span class="logo" style="width:30px;height:30px;background:${esc(k.cor)};color:#fff">${ic('cartao')}</span>
        <div class="grow">${esc(k.nome)}<div class="s">Fecha dia ${k.dia_fechamento} · Vencimento dia ${k.dia_vencimento}${(k.titulares || []).length ? ' · ' + k.titulares.map(esc).join(', ') : ''}${k.arquivado ? ' · inativo' : ''}</div></div>
        <div style="text-align:right"><div class="s">Limite</div>${vH(num(k.limite), 'muted')}</div><button class="icon-btn sm" data-act="verCartao" data-id="${k.id}" title="Faturas">${ic('cartao')}</button></div>`).join('')}` : ''}
      ${!grupos.length && !cards.length ? vazio('Nenhuma conta encontrada.') : ''}
    </div></div>`;
}

/* =====================================================================
   CADASTROS: TAGS
   ===================================================================== */
function vTags() {
  const uso = id => S.lancamentos.filter(l => (l.tags || []).includes(id));
  return `<div class="card" style="max-width:760px;margin:0 auto"><div class="tb"><span class="lbl">Tags</span><span class="sp"></span><button class="btn sm pri" data-act="novaTag">${ic('plus')}Criar tag</button></div>
    ${S.tags.length ? `<div class="lista-cad">${[...S.tags].sort(ordenaNome).map(t => { const u = uso(t.id); return `<div class="item" data-act="editTag" data-id="${t.id}"><span class="chip tag" style="background:${esc(t.cor)};font-size:13px;padding:3px 10px">${esc(t.nome)}</span><div class="grow"></div><span class="s">${u.length} lanç. · ${vH(soma(u, l => l.tipo === 'receita' ? l.valor : -l.valor))}</span></div>`; }).join('')}</div>`
      : vazio('Sem tags cadastradas.<br>As tags que você cadastrar serão listadas aqui e poderão ser associadas aos lançamentos.', `<button class="btn" data-act="novaTag">Criar tag</button>`)}</div>`;
}

/* =====================================================================
   CADASTROS: DOCUMENTOS (anexos no Storage)
   ===================================================================== */
let _docs = null;
async function carregarDocs() {
  const { data, error } = await sb.storage.from('documentos').list(S.uid, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) { _docs = { erro: traduzErro(error) }; } else _docs = data.filter(f => f.name && !f.name.startsWith('.'));
  if (S.view === 'documentos') render();
}
const nomeDoc = n => n.replace(/^\d+-/, '');
const tamanho = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function vDocumentos() {
  if (!_docs) { carregarDocs(); return `<div class="card">${vazio('Carregando documentos…')}</div>`; }
  if (_docs.erro) return `<div class="card">${vazio('Não foi possível listar os documentos: ' + esc(_docs.erro) + '<br>Confira se o SQL da versão 3 foi executado no Supabase.')}</div>`;
  const vinc = path => S.lancamentos.filter(l => (l.anexos || []).some(a => a.path === path));
  return `<div class="card" style="max-width:900px;margin:0 auto"><div class="tb"><span class="lbl">${_docs.length} documento(s)</span><span class="sp"></span>
      <label class="btn sm pri" style="cursor:pointer">${ic('upload')}Enviar documento<input type="file" multiple hidden data-act="enviarDocs"></label></div>
    ${_docs.length ? `<div class="lista-cad">${_docs.map(f => { const path = `${S.uid}/${f.name}`, ls = vinc(path); return `<div class="item" data-act="abrirDoc" data-path="${esc(path)}">${ic('file')}<div class="grow">${esc(nomeDoc(f.name))}<div class="s">${tamanho(f.metadata?.size || 0)} · ${f.created_at ? dataBR(f.created_at.slice(0, 10)) : ''}${ls.length ? ' · ' + ls.map(l => esc(l.descricao)).join(', ') : ' · sem lançamento'}</div></div>
      <button class="icon-btn sm" data-act="apagarDoc" data-path="${esc(path)}" title="Excluir">${ic('trash')}</button></div>`; }).join('')}</div>`
      : vazio('Nenhum documento encontrado.<br>Os documentos que você enviar serão armazenados aqui e poderão ser anexados a lançamentos.')}</div>`;
}
async function enviarArquivos(files) {
  const out = [];
  for (const f of files) {
    if (f.size > 10 * 1048576) { toast(`${f.name}: limite de 10 MB por arquivo`, true); continue; }
    const nome = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${S.uid}/${Date.now()}-${nome}`;
    const { error } = await sb.storage.from('documentos').upload(path, f, { contentType: f.type || 'application/octet-stream' });
    if (error) { toast('Erro ao enviar ' + f.name + ': ' + traduzErro(error), true); continue; }
    out.push({ path, nome: f.name, tam: f.size });
  }
  return out;
}
async function abrirDoc(path) {
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(path, 300);
  if (error) return toast('Erro: ' + traduzErro(error), true);
  window.open(data.signedUrl, '_blank', 'noopener');
}

/* =====================================================================
   CADASTROS: REGRAS DE PREENCHIMENTO
   ===================================================================== */
function vRegras() {
  const tipo = S.aba.regras || 'despesa';
  const n = t => S.regras.filter(r => r.tipo === t).length;
  const lista = S.regras.filter(r => r.tipo === tipo).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  return `<div class="tabs"><button class="tab ${tipo === 'despesa' ? 'on' : ''}" data-act="aba" data-k="regras" data-v="despesa">Despesas (${n('despesa')})</button><button class="tab ${tipo === 'receita' ? 'on' : ''}" data-act="aba" data-k="regras" data-v="receita">Receitas (${n('receita')})</button></div>
    <div class="card" style="max-width:1000px;margin:0 auto"><div class="tb"><span class="muted" style="font-size:13px">Ao digitar a descrição de um lançamento, a regra preenche conta, cartão, titular, categoria e tags automaticamente.</span><span class="sp"></span><button class="btn sm pri" data-act="novaRegra" data-t="${tipo}">${ic('plus')}Nova regra</button></div>
    ${lista.length ? `<table class="t"><tr><th class="l">Descrição</th><th class="l">Classificação</th><th class="l hide-m">Palavras alternativas</th></tr>
      ${lista.map(r => `<tr class="click" data-act="editRegra" data-id="${r.id}"><td class="l">${esc(r.descricao)}</td><td class="l"><div class="chips" style="display:flex;flex-wrap:wrap;gap:4px">${r.conta_id ? chipConta(r.conta_id) : ''}${r.cartao_id ? chipCartao(r.cartao_id) : ''}${r.titular ? `<span class="chip">${esc(r.titular)}</span>` : ''}${r.categoria_id ? chipCat(r.categoria_id) : ''}${chipsTags(r)}</div></td><td class="l hide-m muted">${esc(r.palavras || '')}</td></tr>`).join('')}</table>`
      : vazio('Nenhuma regra de preenchimento.', `<button class="btn" data-act="novaRegra" data-t="${tipo}">Criar regra</button>`)}</div>`;
}

/* =====================================================================
   CADASTROS: FECHAMENTO DE POSIÇÃO
   ===================================================================== */
function vFechamento() {
  const tipo = S.aba.fech || 'conta', g = S.prefs.fechamento_global;
  const item = (k, x, ehCartao) => `<label class="item" style="cursor:pointer"><input type="checkbox" class="ck" data-fech="${k}:${x.id}"><div class="grow">${esc(x.nome)}</div><span class="s">${x.fechado_ate ? `Fechada até ${dataBR(x.fechado_ate)}` : 'Posição aberta'}</span></label>`;
  const contasG = Object.entries(TIPOS_CONTA).map(([t, n]) => [n, S.contas.filter(c => c.tipo === t && !c.arquivada)]).filter(x => x[1].length);
  return `<div class="card" style="max-width:820px;margin:0 auto"><div class="card-b" style="padding-top:16px">
    <div class="f"><label>Tipo de fechamento</label></div>
    <label class="inline"><input type="radio" name="tfech" data-act="tipoFech" value="conta" ${tipo === 'conta' ? 'checked' : ''}><div><b>Fechamento por Conta</b><div class="muted" style="font-size:13px">Bloqueia lançamentos e operações até a data definida apenas para as contas selecionadas. As demais contas continuam abertas.</div></div></label>
    <label class="inline"><input type="radio" name="tfech" data-act="tipoFech" value="global" ${tipo === 'global' ? 'checked' : ''}><div><b>Fechamento Global</b><div class="muted" style="font-size:13px">Bloqueia lançamentos e operações até a data definida para todas as contas, sem exceção.</div></div></label>
    <div class="fr c2" style="align-items:end;margin-top:8px"><div class="f"><label>Fechar posição até</label><input type="date" id="dataFech" value="${addDias(iniMes(ymHoje()), -1)}"></div>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${tipo === 'conta' ? '<button class="btn sm" data-act="marcarFech">Marcar todos</button>' : ''}<button class="btn sm pri" data-act="fecharPos">Fechar posição</button><button class="btn sm out" data-act="reabrirPos">Reabrir posição</button></div></div>
    ${tipo === 'global' ? `<div class="banner">${g ? `Fechamento global ativo: nada pode ser lançado ou alterado até <b>${dataBR(g)}</b>.` : 'Nenhum fechamento global ativo.'}</div>` : ''}
    </div>${tipo === 'conta' ? `<div class="lista-cad">${contasG.map(([n, cs]) => `<div class="grp-h">${n}</div>${cs.map(c => item('conta', c)).join('')}`).join('')}
      ${cartoesAtivos().length ? `<div class="grp-h">Cartão de Crédito</div>${cartoesAtivos().map(k => item('cartao', k, true)).join('')}` : ''}</div>` : ''}</div>`;
}

/* =====================================================================
   CONFIGURAÇÕES DE UTILIZAÇÃO
   ===================================================================== */
function linkConfig() {
  const c = lerConfig(); if (!c) return '';
  return location.origin + location.pathname + '#cfg=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({ u: c.u, k: c.k })))));
}
function vConfig() {
  const aba = S.aba.config || 'recursos', R = S.prefs.recursos || {};
  const linha = (k, icone, nome, desc) => `<div class="opt-row">${ic(icone)}<div class="grow"><b>${nome}</b><div class="s">${desc}</div></div><label class="sw"><input type="checkbox" data-recurso="${k}" ${R[k] !== false ? 'checked' : ''}><span></span></label></div>`;
  const c = lerConfig();
  const pessoas = [...new Set([lsGet('nc_quem'), ...S.cartoes.flatMap(k => k.titulares || []), ...S.lancamentos.map(l => l.criado_por)].filter(Boolean))];
  return `<div class="tabs">${[['recursos', 'Recursos habilitados'], ['geral', 'Geral'], ['acesso', 'Acesso e dados']].map(([k, n]) => `<button class="tab ${aba === k ? 'on' : ''}" data-act="aba" data-k="config" data-v="${k}">${n}</button>`).join('')}</div>
  <div class="card" style="max-width:820px;margin:0 auto">
  ${aba === 'recursos' ? `<div class="grp-h" style="padding:12px 16px;color:var(--muted);font-weight:500">Cadastros</div>
      ${linha('tags', 'tag', 'Tags', 'Utilizar o cadastro de tags, adicionando o campo aos lançamentos.')}
      <div class="grp-h" style="padding:12px 16px;color:var(--muted);font-weight:500">Metas</div>
      ${linha('orcamento', 'pie', 'Metas de orçamento', 'Utilizar o módulo de metas de orçamento (limite de despesa por categoria).')}
      ${linha('economia', 'savings', 'Metas de economia', 'Utilizar o módulo de metas de economia.')}
      <div class="grp-h" style="padding:12px 16px;color:var(--muted);font-weight:500">Outros recursos</div>
      ${linha('cartoes', 'cartao', 'Cartões de crédito', 'Utilizar o módulo de cartões de crédito.')}` : ''}
  ${aba === 'geral' ? `<div class="card-b" style="padding-top:16px">
      <div class="f"><label for="quem">Quem usa este aparelho (titular padrão nos lançamentos)</label><input id="quem" list="dlQuem" placeholder="Ex.: Bruno Roberto Lopes Coelho" value="${esc(lsGet('nc_quem') || '')}"><datalist id="dlQuem">${pessoas.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="f"><label>Situação padrão de um novo lançamento</label><select id="padraoPago"><option value="1" ${lsGet('nc_padrao_pago') !== '0' ? 'selected' : ''}>Confirmado (já pago/recebido)</option><option value="0" ${lsGet('nc_padrao_pago') === '0' ? 'selected' : ''}>Pendente</option></select></div>
      <div class="f"><label>Aparência</label><select id="tema">${[['', 'Tema do sistema'], ['light', 'Tema claro'], ['dark', 'Tema escuro']].map(([k, n]) => `<option value="${k}" ${(lsGet('nc_tema') || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="f"><label>Menu lateral no computador</label><select id="menuFixo"><option value="1" ${lsGet('nc_menu_fixo') !== '0' ? 'selected' : ''}>Sempre visível</option><option value="0" ${lsGet('nc_menu_fixo') === '0' ? 'selected' : ''}>Recolhido</option></select></div>
      <p class="muted" style="font-size:12px">Estas opções valem só para este aparelho.</p></div>` : ''}
  ${aba === 'acesso' ? `<div class="card-b" style="padding-top:16px">
      <p class="muted" style="font-size:13px;margin-top:0">Banco: <b>${esc(c ? c.u.replace('https://', '') : '—')}</b>${c?.fixo ? ' (conexão já embutida no site)' : ''}</p>
      ${c?.fixo ? '<p style="font-size:14px">Para usar em <b>outro celular ou computador</b>, basta abrir o mesmo endereço do site e entrar com o e-mail e a senha.</p>'
        : `<p style="font-size:14px">Para usar em <b>outro aparelho</b>, abra lá o link abaixo uma vez e entre com o e-mail e a senha.</p><div class="f"><input id="linkCfg" readonly value="${esc(linkConfig())}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn out sm" data-act="copiarLink">Copiar link</button><button class="btn danger sm" data-act="trocarConexao">Trocar conexão</button></div>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:14px">
        <button class="btn out" data-act="exportTudo">${ic('dl')}Exportar lançamentos (CSV)</button>
        <button class="btn out" data-act="backup">${ic('dl')}Cópia de segurança (JSON)</button>
        <button class="btn danger" data-act="sair">${ic('logout')}Sair</button></div></div>` : ''}
  </div>`;
}
