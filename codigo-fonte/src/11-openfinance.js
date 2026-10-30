/* =====================================================================
   OPEN FINANCE (Pluggy / Meu Pluggy) — lançamentos automáticos
   A chave secreta da Pluggy fica só no servidor (função pluggy-sync + cofre privado).
   ===================================================================== */
const OF = { contas: null, execs: null, carregando: false, faltaSQL: false, erro: '', cred: null, tg: null };
const fmtDH = s => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

async function ofCarregar() {
  if (OF.carregando) return; OF.carregando = true;
  try {
    const [a, b] = await Promise.all([
      sb.from('pluggy_contas').select('*').order('item_id'),
      sb.from('pluggy_execucoes').select('*').order('inicio', { ascending: false }).limit(15),
    ]);
    if (a.error || b.error) { const e = a.error || b.error; if (tabelaFaltando(e)) { OF.faltaSQL = true; OF.contas = []; OF.execs = []; } else throw e; }
    else { OF.faltaSQL = false; OF.contas = a.data; OF.execs = b.data; }
    if (!OF.faltaSQL) { try { OF.cred = (await ofChamar({ acao: 'status' })).credenciais; } catch (e) { OF.cred = false; } }
    try { OF.tg = await ofChamar({ acao: 'telegram_status' }); } catch (e) { OF.tg = { token: false, erro: e.message }; }
  } catch (e) { OF.erro = traduzErro(e); OF.contas = OF.contas || []; OF.execs = OF.execs || []; }
  OF.carregando = false;
  if (S.view === 'openfinance') render();
}

async function ofChamar(corpo) {
  const { data, error } = await sb.functions.invoke('pluggy-sync', { body: corpo });
  if (error) {
    let msg = error.message || String(error);
    try { const j = await error.context?.json?.(); if (j?.erro) msg = j.erro; } catch {}
    if (/Failed to send|not found|404/i.test(msg)) msg = 'A função "pluggy-sync" ainda não foi publicada no Supabase.';
    throw new Error(msg);
  }
  if (data?.erro) throw new Error(data.erro);
  return data;
}

function vOpenFinance() {
  if (OF.contas === null) { setTimeout(ofCarregar); return '<div class="empty">Carregando…</div>'; }
  const P = S.prefs.pluggy || {};
  const itens = (P.itens || []).join('\n');
  const destinoSel = pc => {
    const v = pc.conta_id ? 'conta:' + pc.conta_id : pc.cartao_id ? 'cartao:' + pc.cartao_id : '';
    const op = [['', '— não importar —'],
      ...S.contas.filter(c => !c.arquivada).map(c => ['conta:' + c.id, 'Conta · ' + c.nome]),
      ...S.cartoes.filter(c => !c.arquivado).map(c => ['cartao:' + c.id, 'Cartão · ' + c.nome])];
    return `<select data-of-destino="${esc(pc.id)}">${op.map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  };
  const ult = (OF.execs || [])[0];
  return `<div style="max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:16px;min-width:0">
  ${OF.faltaSQL ? `<div class="card" style="border-left:4px solid var(--warn,#f9a825)"><div class="card-b" style="padding-top:14px">
     <b>Falta um passo no banco de dados.</b> Copie o SQL abaixo e rode no <a href="https://supabase.com/dashboard/project/cuhrhtkwfuwgsvsdrkng/sql/new" target="_blank" rel="noopener">SQL Editor do Supabase</a>.
     <div style="margin-top:10px"><button class="btn pri sm" data-act="ofCopiarSQL">Copiar SQL</button></div></div></div>` : ''}
  ${OF.erro ? `<div class="err-msg">${esc(OF.erro)}</div>` : ''}
  <div class="card">${cardH('Lançamentos automáticos pelo Open Finance')}
    <div class="card-b" style="padding-top:12px">
      <p style="margin-top:0">O Nosso Caixa busca os lançamentos das contas e cartões conectados no <b>Meu Pluggy</b> (gratuito) <b>4 vezes por dia</b> (0h, 6h, 12h e 18h) e também quando você clica em <b>Sincronizar agora</b>.
      Lançamentos que já existem (por exemplo, contas fixas e parcelas) são <b>conciliados</b> em vez de duplicados. A categoria vem das <b>regras de preenchimento</b> e do histórico.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn pri" data-act="ofSincronizar">${ic('sync')}Sincronizar agora</button>
        <span class="muted" style="font-size:13px">${ult ? `Última: ${fmtDH(ult.fim || ult.inicio)} · ${ult.erro ? '<span style="color:var(--late)">erro</span>' : `${ult.novos} novo(s), ${ult.conciliados} conciliado(s)`}` : 'Ainda não sincronizado.'}</span>
      </div>
    </div></div>

  <div class="card">${cardH('1. Conta no Meu Pluggy (gratuita)')}
    <div class="card-b" style="padding-top:12px;font-size:14px">
      <p style="margin-top:0">Abra <a href="https://meu.pluggy.ai" target="_blank" rel="noopener"><b>meu.pluggy.ai</b></a>, crie a conta (e-mail e senha) e conecte o banco e os cartões. A autorização é feita no app do próprio banco.</p></div></div>

  <div class="card">${cardH('2. Chave da Pluggy')}
    <div class="card-b" style="padding-top:12px;font-size:14px">
      ${OF.cred ? `<p style="margin-top:0">${ic('taskok')} <b>Chave cadastrada.</b> Ela fica guardada só no servidor e não aparece no site.</p>
        <button class="btn out sm" data-act="ofTrocarChave">Trocar chave</button>`
      : `<p style="margin-top:0">Entre em <a href="https://dashboard.pluggy.ai" target="_blank" rel="noopener"><b>dashboard.pluggy.ai</b></a> (pode usar o mesmo e-mail), crie uma aplicação e copie o <b>Client ID</b> e o <b>Client Secret</b> para cá.</p>
        <div class="f"><label for="ofCid">Client ID</label><input id="ofCid" autocomplete="off" spellcheck="false"></div>
        <div class="f"><label for="ofSec">Client Secret</label><input id="ofSec" type="password" autocomplete="new-password" spellcheck="false"></div>
        <button class="btn pri" data-act="ofSalvarChave">Salvar chave</button>
        <p class="muted" style="font-size:12px">A chave é conferida na Pluggy e guardada num cofre do banco de dados que só o servidor lê.</p>`}
    </div></div>

  <div class="card">${cardH('3. Conectar o banco ao Nosso Caixa')}
    <div class="card-b" style="padding-top:12px;font-size:14px">
      <p style="margin-top:0">Clique no botão, procure <b>MeuPluggy</b> e entre com o e-mail e a senha do Meu Pluggy. O resto é automático: as contas são buscadas, vinculadas e sincronizadas.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn pri" data-act="ofConectar" ${OF.cred ? '' : 'disabled'}>${ic('banco')}Conectar banco</button>
        <span class="muted" style="font-size:13px">${(P.itens || []).length ? `${P.itens.length} conexão(ões) ativa(s)` : 'Nenhuma conexão ainda.'}</span></div>
      <div class="f" style="max-width:260px;margin-top:14px"><label for="ofDesde">Importar lançamentos a partir de</label><input type="date" id="ofDesde" value="${esc(P.desde || hoje())}"></div>
      <p class="muted" style="font-size:12px;margin-top:-4px">Hoje = só o que for novo (o histórico já veio do Meu Dinheiro). Limite: 120 dias para trás.</p>
      <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:13px">Avançado: informar o Item ID manualmente</summary>
        <div class="f" style="margin-top:10px"><label for="ofItens">Item ID (um por linha)</label><textarea id="ofItens" rows="2">${esc(itens)}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn out sm" data-act="ofSalvarItens">Salvar</button><button class="btn out sm" data-act="ofBuscarContas">Buscar contas</button></div>
      </details>
    </div></div>

  <div class="card">${cardH('4. Para onde vai cada conta')}
    <div class="card-b ${OF.contas.length ? 'flush' : ''}">${OF.contas.length ? `<div style="overflow-x:auto"><table class="t"><tr><th class="l">Conta no banco</th><th class="l">Tipo</th><th class="l">Lançar em</th><th>Atualizado</th></tr>
      ${OF.contas.map(pc => `<tr><td class="l">${esc(pc.nome || '')}${pc.numero ? ` <span class="muted">· ${esc(pc.numero)}</span>` : ''}</td><td class="l">${pc.tipo === 'CREDIT' ? 'Cartão' : 'Conta'}</td><td class="l">${destinoSel(pc)}</td><td>${fmtDH(pc.atualizado_em)}</td></tr>`).join('')}</table></div>`
      : '<p class="muted" style="padding-top:12px">Aparece aqui depois de conectar o banco. O vínculo é sugerido pelo nome e pode ser trocado.</p>'}</div></div>

  <div class="card">${cardH('Resumo diário no Telegram (8h)')}
    <div class="card-b" style="padding-top:12px;font-size:14px">
      <p style="margin-top:0">Todo dia às <b>8h</b> chega no Telegram: saldo do banco, gasto no cartão, valor das faturas, Pix enviados e recebidos e quanto do orçamento já foi usado. Gratuito.</p>
      ${OF.tg?.token ? `<p>${ic('taskok')} Bot <b>@${esc(OF.tg.bot || '?')}</b> configurado · ${OF.tg.conversas ? `<b>${OF.tg.conversas}</b> pessoa(s) recebendo` : '<span style="color:var(--late)">ninguém vinculado ainda</span>'}</p>
        <ol style="padding-left:20px;line-height:1.6;margin:0 0 10px">
          <li>Abra <a href="https://t.me/${esc(OF.tg.bot || '')}" target="_blank" rel="noopener"><b>t.me/${esc(OF.tg.bot || '')}</b></a> no celular e toque em <b>Iniciar</b>. A Rúbia pode fazer o mesmo para receber também.</li>
          <li>Volte aqui e clique em <b>Vincular</b>.</li></ol>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn out" data-act="tgVincular">Vincular</button><button class="btn pri" data-act="tgTeste" ${OF.tg.conversas ? '' : 'disabled'}>Enviar resumo agora</button><button class="btn out sm" data-act="tgPrevia">Ver prévia</button><button class="btn out sm" data-act="tgTrocar">Trocar bot</button></div>`
      : `<ol style="padding-left:20px;line-height:1.6;margin:0 0 10px">
          <li>No Telegram, abra <a href="https://t.me/BotFather" target="_blank" rel="noopener"><b>@BotFather</b></a>, envie <code>/newbot</code>, escolha um nome (ex.: Nosso Caixa) e um usuário terminado em <i>bot</i>.</li>
          <li>Copie o <b>token</b> que ele devolve e cole abaixo.</li></ol>
        <div class="f"><label for="tgToken">Token do bot</label><input id="tgToken" type="password" autocomplete="off" spellcheck="false" placeholder="123456789:ABC..."></div>
        <button class="btn pri" data-act="tgSalvar">Salvar token</button>`}
      <div id="tgPrev"></div>
    </div></div>

  <div class="card">${cardH('Histórico de sincronizações')}
    <div class="card-b ${OF.execs.length ? 'flush' : ''}">${OF.execs.length ? `<div style="overflow-x:auto"><table class="t"><tr><th class="l">Quando</th><th class="l">Origem</th><th>Novos</th><th>Conciliados</th><th class="l">Situação</th></tr>
      ${OF.execs.map(x => `<tr><td class="l">${fmtDH(x.fim || x.inicio)}</td><td class="l">${x.origem === 'agendado' ? 'Automática' : 'Manual'}</td><td>${x.novos ?? 0}</td><td>${x.conciliados ?? 0}</td><td class="l">${x.erro ? `<span style="color:var(--late)">${esc(x.erro)}</span>` : 'OK'}</td></tr>`).join('')}</table></div>`
      : '<p class="muted" style="padding-top:12px">Nenhuma sincronização ainda.</p>'}</div></div>

  </div>`;
}

function ofCarregarWidget() {
  if (window.PluggyConnect) return Promise.resolve();
  return new Promise((ok, falha) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js';
    sc.onload = () => ok(); sc.onerror = () => falha(new Error('Não foi possível carregar a janela de conexão da Pluggy.'));
    document.head.appendChild(sc);
  });
}

Object.assign(ACOES, {
  tgSalvar: async (d, el) => {
    const token = $('#tgToken').value.trim(); if (!token) return toast('Cole o token do BotFather.', true);
    el.disabled = true;
    try { const r = await ofChamar({ acao: 'telegram_salvar', token }); toast(`Bot @${r.bot} configurado`); OF.erro = ''; } catch (e) { OF.erro = e.message; toast(e.message, true); }
    OF.contas = null; render();
  },
  tgTrocar: () => { OF.tg = { token: false }; render(); },
  tgVincular: async (d, el) => {
    el.disabled = true;
    try { const r = await ofChamar({ acao: 'telegram_vincular' }); toast(`${r.conversas} pessoa(s) vinculada(s). Confira a mensagem no Telegram.`); OF.erro = ''; } catch (e) { OF.erro = e.message; toast(e.message, true); }
    OF.contas = null; render();
  },
  tgTeste: async (d, el) => {
    el.disabled = true; el.textContent = 'Enviando…';
    try { const r = await ofChamar({ acao: 'relatorio' }); toast(`Resumo enviado para ${r.enviados} pessoa(s)`); } catch (e) { toast(e.message, true); }
    el.disabled = false; el.textContent = 'Enviar resumo agora';
  },
  tgPrevia: async () => {
    $('#tgPrev').innerHTML = '<p class="muted">Montando…</p>';
    try { const r = await ofChamar({ acao: 'relatorio', previa: true }); $('#tgPrev').innerHTML = `<div style="white-space:pre-wrap;background:var(--bg);border-radius:8px;padding:12px;margin-top:12px;font-size:13px">${r.texto.replace(/<a [^>]*>([^<]*)<\/a>/g, '$1')}</div>`; }
    catch (e) { $('#tgPrev').innerHTML = `<div class="err-msg">${esc(e.message)}</div>`; }
  },
  ofCopiarSQL: async () => { await navigator.clipboard.writeText($('#sqlOF').textContent.trim()); toast('SQL copiado. Cole no SQL Editor e clique em Run.'); },
  ofSalvarChave: async (d, el) => {
    const clientId = $('#ofCid').value.trim(), clientSecret = $('#ofSec').value.trim();
    if (!clientId || !clientSecret) return toast('Cole o Client ID e o Client Secret.', true);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(clientId)) return toast(`O Client ID colado não está no formato esperado (${clientId.length} caracteres; o certo tem 36, tipo xxxxxxxx-xxxx-…).`, true);
    if (/[•*●]/.test(clientSecret)) return toast('O Client Secret foi copiado ainda escondido (••••). Na Pluggy, clique no ícone da chave para mostrá-lo e copie de novo.', true);
    el.disabled = true; el.textContent = 'Conferindo na Pluggy…';
    try { await ofChamar({ acao: 'salvar_credenciais', clientId, clientSecret }); OF.cred = true; OF.erro = ''; toast('Chave conferida e guardada'); }
    catch (e) { OF.erro = e.message; toast(e.message, true); }
    render();
  },
  ofTrocarChave: () => { OF.cred = false; render(); },
  ofConectar: async (d, el) => {
    el.disabled = true;
    try {
      const { accessToken } = await ofChamar({ acao: 'connect_token' });
      await ofCarregarWidget();
      const pc = new window.PluggyConnect({
        connectToken: accessToken, language: 'pt', includeSandbox: false,
        onSuccess: async ({ item }) => {
          const itens = [...new Set([...(S.prefs.pluggy?.itens || []), item.id])];
          S.prefs.pluggy = { ...(S.prefs.pluggy || {}), itens, desde: $('#ofDesde')?.value || S.prefs.pluggy?.desde || hoje() };
          await salvarPrefs('Banco conectado');
          try {
            await ofChamar({ acao: 'contas', itens }); toast('Contas vinculadas. Sincronizando…');
            const r = await ofChamar({ acao: 'sincronizar' }); OF.erro = '';
            toast(`${r.novos} lançamento(s) novo(s), ${r.conciliados} conciliado(s)`); await carregar(['lancamentos']);
          } catch (e) { OF.erro = e.message; }
          OF.contas = null; render();
        },
        onError: ({ message }) => { OF.erro = 'Conexão não concluída: ' + (message || 'erro'); render(); },
        onClose: () => { el.disabled = false; },
      });
      pc.init();
    } catch (e) { OF.erro = e.message; toast(e.message, true); el.disabled = false; render(); }
  },
  ofSalvarItens: async () => {
    const itens = $('#ofItens').value.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    S.prefs.pluggy = { ...(S.prefs.pluggy || {}), itens, desde: $('#ofDesde').value || hoje() };
    await salvarPrefs('Conexões salvas');
    return itens;
  },
  ofBuscarContas: async (d, el) => {
    const itens = await ACOES.ofSalvarItens();
    if (!itens.length) return toast('Informe o Item ID.', true);
    el.disabled = true; toast('Buscando contas na Pluggy…');
    try { const r = await ofChamar({ acao: 'contas', itens }); toast(`${r.contas.length} conta(s) encontrada(s). Escolha o destino de cada uma.`); OF.erro = ''; }
    catch (e) { OF.erro = e.message; }
    el.disabled = false; OF.contas = null; render();
  },
  ofSincronizar: async (d, el) => {
    el.disabled = true; el.innerHTML = ic('sync') + 'Sincronizando…';
    try {
      const r = await ofChamar({ acao: 'sincronizar' });
      OF.erro = '';
      toast(r.novos || r.conciliados ? `${r.novos} lançamento(s) novo(s), ${r.conciliados} conciliado(s)` : 'Nada novo no banco.');
      await carregar(['lancamentos']);
    } catch (e) { OF.erro = e.message; toast(e.message, true); }
    OF.contas = null; render();
  },
});

document.addEventListener('change', async e => {
  if (e.target.id === 'ofDesde') { S.prefs.pluggy = { ...(S.prefs.pluggy || {}), desde: e.target.value || hoje() }; return salvarPrefs('Data salva'); }
  const id = e.target.dataset?.ofDestino;
  if (id === undefined) return;
  const v = e.target.value;
  const upd = { conta_id: v.startsWith('conta:') ? v.slice(6) : null, cartao_id: v.startsWith('cartao:') ? v.slice(7) : null };
  const { error } = await sb.from('pluggy_contas').update(upd).eq('id', id);
  if (error) return toast(traduzErro(error), true);
  const pc = OF.contas.find(x => x.id === id); if (pc) Object.assign(pc, upd);
  toast(v ? 'Vínculo salvo' : 'Esta conta não será importada');
});
