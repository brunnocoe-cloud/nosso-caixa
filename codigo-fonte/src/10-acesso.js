function traduzErro(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'e-mail ou senha incorretos.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'sem conexão com o servidor.';
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m)) return 'tabelas não encontradas — execute o SQL no Supabase.';
  if (/Invalid API key|No API key/i.test(m)) return 'chave do Supabase inválida.';
  if (/NOSSO_CAIXA_JA_TEM_ACESSO|Database error saving new user/i.test(m)) return 'já existe um acesso criado neste Nosso Caixa. Use “Entrar”.';
  if (/User already registered/i.test(m)) return 'este e-mail já tem acesso. Use “Entrar”.';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return 'novos cadastros estão desativados no Supabase. Use “Entrar” ou crie o usuário pelo painel do Supabase.';
  if (/Password should be at least/i.test(m)) return 'a senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(m)) return 'e-mail ainda não confirmado: abra o link que o Supabase enviou para o seu e-mail.';
  if (/rate limit/i.test(m)) return 'muitas tentativas seguidas. Aguarde alguns minutos.';
  return m;
}
const tabelaFaltando = e => /relation .* does not exist|Could not find the table|schema cache|42P01|PGRST205/i.test((e?.message || '') + ' ' + (e?.code || ''));
function conectar(cfg) {
  sb = window.supabase.createClient(cfg.u, cfg.k, { auth: { persistSession: true, autoRefreshToken: true } });
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && $('#view')) telaLogin(); });
}
async function testarTabelas() {
  for (const [t, cols] of [['contas', 'id,considerar_saldo'], ['lancamentos', 'id,conciliado,tags,anexos,serie,ext_id'], ['regras', 'id'], ['preferencias', 'user_id'], ['categorias', 'id,parent_id,ativa'], ['cartoes', 'id,titulares,faturas_fechadas']]) {
    const { error } = await sb.from(t).select(cols).limit(1);
    if (!error) continue;
    if (tabelaFaltando(error) || /column|does not exist/i.test(error.message || '')) return 'sem-tabelas';
    throw error;
  }
  return 'ok';
}
async function aposTabelas() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) iniciarApp(); else telaSetup(3);
}
const passosHTML = n => `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
const marca = `<div class="brand"><span class="logo">${LOGO}</span>Nosso Caixa</div>`;
function telaSetup(passo = 1, msg = '') {
  const cfg = lerConfig();
  const erro = msg ? `<div class="err-msg">${esc(msg)}</div>` : '';
  if (passo === 1) {
    $('#root').innerHTML = `<div class="login"><form class="box card wide" id="fSetup">${marca}
      <p class="lead">Primeiro acesso · 1 de 3: conectar ao banco</p>${passosHTML(1)}${erro}
      <p style="margin-top:0">No painel do <b>Supabase</b>, abra <b>Project Settings → API</b> (ou <b>Data API / API Keys</b>) e copie os dois dados abaixo.</p>
      <div class="f"><label for="sUrl">Project URL</label><input id="sUrl" placeholder="https://xxxxxxxx.supabase.co" value="${esc(cfg?.u || '')}" required></div>
      <div class="f"><label for="sKey">Chave anon / publishable</label><input id="sKey" placeholder="eyJhbGciOi… ou sb_publishable_…" value="${esc(cfg?.k || '')}" required></div>
      <p class="muted" style="font-size:12px;margin-top:-4px">Use a chave <b>anon</b> (ou <b>publishable</b>). Nunca a <i>service_role</i> / <i>secret</i>.</p>
      <button class="btn pri" style="width:100%;justify-content:center;padding:12px" type="submit">Conectar</button>
    </form></div>`;
    $('#fSetup').addEventListener('submit', async e => {
      e.preventDefault();
      let u = $('#sUrl').value.trim().replace(/\/+$/, ''); const k = $('#sKey').value.trim();
      if (!/^https:\/\/[^\s/]+$/.test(u)) return telaSetup(1, 'A Project URL deve ser algo como https://xxxxxxxx.supabase.co');
      if (/service_role|sb_secret_/.test(k) || /"role"\s*:\s*"service_role"/.test(atobSeguro(k.split('.')[1] || ''))) return telaSetup(1, 'Essa é a chave secreta (service_role). Use a chave anon / publishable.');
      const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Testando conexão…';
      gravarConfig(u, k); conectar({ u, k });
      try {
        const r = await testarTabelas();
        r === 'ok' ? aposTabelas() : telaSetup(2);
      } catch (err) { telaSetup(1, 'Não foi possível conectar: ' + traduzErro(err)); }
    });
  }
  if (passo === 2) {
    const ref = (() => { try { return new URL(cfg.u).hostname.split('.')[0]; } catch { return ''; } })();
    $('#root').innerHTML = `<div class="login"><div class="box card wide">${marca}
      <p class="lead">Primeiro acesso · 2 de 3: criar as tabelas</p>${passosHTML(2)}${erro}
      <p style="margin-top:0">A conexão funcionou, mas o banco ainda está vazio. Faça assim:</p>
      <ol style="padding-left:20px;margin:0 0 12px">
        <li>Clique em <b>Copiar SQL</b>.</li>
        <li>Abra o <a href="https://supabase.com/dashboard/project/${esc(ref)}/sql/new" target="_blank" rel="noopener"><b>SQL Editor do Supabase</b></a>, cole e clique em <b>Run</b>.</li>
        <li>Volte aqui e clique em <b>Já executei</b>.</li>
      </ol>
      <textarea class="sqlbox" id="sqlTxt" readonly>${esc($('#sqlSchema').textContent.trim())}</textarea>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" id="bCopiar">Copiar SQL</button>
        <button class="btn pri" id="bVerif" style="margin-left:auto">Já executei</button>
      </div>
      <button class="linkbtn" id="bVoltar">Voltar e trocar a conexão</button>
    </div></div>`;
    $('#bCopiar').onclick = async () => {
      const t = $('#sqlTxt');
      try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
      toast('SQL copiado');
    };
    $('#bVerif').onclick = async () => {
      try { const r = await testarTabelas(); if (r === 'ok') aposTabelas(); else telaSetup(2, 'As tabelas ainda não apareceram. Confira se o SQL rodou com “Success” e tente de novo em alguns segundos.'); }
      catch (err) { telaSetup(2, traduzErro(err)); }
    };
    $('#bVoltar').onclick = () => telaSetup(1);
  }
  if (passo === 3) {
    $('#root').innerHTML = `<div class="login"><form class="box card wide" id="fSetup">${marca}
      <p class="lead">Primeiro acesso · 3 de 3: criar o login do casal</p>${passosHTML(3)}${erro}
      <p style="margin-top:0">Este será o <b>único</b> acesso do site, usado por vocês dois. Depois de criado, ninguém mais consegue se cadastrar.</p>
      <div class="f"><label for="sEmail">E-mail</label><input id="sEmail" type="email" autocomplete="username" required></div>
      <div class="f"><label for="sSenha">Senha</label><input id="sSenha" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="f"><label for="sSenha2">Repita a senha</label><input id="sSenha2" type="password" autocomplete="new-password" required></div>
      <button class="btn pri" style="width:100%;justify-content:center;padding:12px" type="submit">Criar acesso e entrar</button>
      <div style="text-align:center;margin-top:8px"><button type="button" class="linkbtn" id="bJaTenho">Já tenho acesso: entrar</button></div>
    </form></div>`;
    $('#bJaTenho').onclick = () => telaLogin();
    $('#fSetup').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#sEmail').value.trim(), s1 = $('#sSenha').value, s2 = $('#sSenha2').value;
      if (s1.length < 8) return telaSetup(3, 'Use uma senha com pelo menos 8 caracteres.');
      if (s1 !== s2) return telaSetup(3, 'As duas senhas não são iguais.');
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Criando acesso…';
      const { data, error } = await sb.auth.signUp({ email, password: s1 });
      if (error) return telaSetup(3, 'Não foi possível criar: ' + traduzErro(error));
      if (data?.session) { toast('Acesso criado!'); return iniciarApp(); }
      telaLogin('Acesso criado! O Supabase enviou um e-mail de confirmação para ' + email + '. Clique no link do e-mail e depois entre aqui.', true);
    });
  }
}
function atobSeguro(s) { try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } }
function telaLogin(msg = '', info = false) {
  const cfg = lerConfig();
  $('#root').innerHTML = `<div class="login"><form class="box card" id="fLogin">
    ${marca}
    <p class="lead">Controle financeiro da família</p>
    ${msg ? `<div class="${info ? 'banner' : 'err-msg'}" ${info ? 'style="display:block;font-size:14px"' : ''}>${esc(msg)}</div>` : ''}
    <div class="f"><label for="lEmail">E-mail</label><input id="lEmail" type="email" autocomplete="username" required></div>
    <div class="f"><label for="lSenha">Senha</label><input id="lSenha" type="password" autocomplete="current-password" required></div>
    <button class="btn pri" style="width:100%;justify-content:center;padding:12px" type="submit">Entrar</button>
    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button type="button" class="linkbtn" id="bPrimeiro">Primeiro acesso: criar senha</button>
      ${cfg?.fixo ? '' : '<button type="button" class="linkbtn" id="bConexao">Trocar conexão</button>'}
    </div>
  </form></div>`;
  $('#bPrimeiro').onclick = () => telaSetup(3);
  $('#bConexao')?.addEventListener('click', () => telaSetup(1));
  $('#fLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email: $('#lEmail').value.trim(), password: $('#lSenha').value });
    if (error) return telaLogin(traduzErro(error));
    iniciarApp();
  });
}
