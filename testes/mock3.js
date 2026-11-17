// Supabase falso, em memória (localStorage), para testar a interface do Nosso Caixa v3
(function () {
  const db = JSON.parse(localStorage.getItem('mockdb') || '{}');
  const files = JSON.parse(localStorage.getItem('mockfiles') || '[]');
  const save = () => { localStorage.setItem('mockdb', JSON.stringify(db)); localStorage.setItem('mockfiles', JSON.stringify(files)); };
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const DEF = {
    contas: { arquivada: false, saldo_inicial: 0, tipo: 'corrente', considerar_saldo: true, fechado_ate: null, cor: '#888' },
    cartoes: { arquivado: false, limite: 0, titulares: [], faturas_fechadas: [], fechado_ate: null, conta_id: null },
    categorias: { ativa: true, parent_id: null, cor: '#888' },
    tags: { cor: '#555' },
    lancamentos: { pago: true, conciliado: false, tags: [], anexos: [], serie: null, ext_id: null, grupo_id: null, parcela: null, total_parcelas: null, observacao: null, criado_por: null, categoria_id: null, conta_id: null, conta_destino_id: null, cartao_id: null, fatura_mes: null },
    metas: { valor_atual: 0, conta_id: null, data_alvo: null },
    regras: { tags: [], palavras: null, conta_id: null, cartao_id: null, titular: null, categoria_id: null },
    orcamentos: {}, preferencias: {},
  };
  let n = 0;
  function builder(t) {
    db[t] = db[t] || [];
    const st = { op: 'select', filters: [], range: null, payload: null, lim: null };
    const b = {
      select() { return b; }, order() { return b; }, limit(x) { st.lim = x; return b; },
      range(a, z) { st.range = [a, z]; return b; },
      insert(p) { st.op = 'insert'; st.payload = Array.isArray(p) ? p : [p]; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(k, v) { st.filters.push(r => r[k] === v); return b; },
      in(k, vs) { st.filters.push(r => vs.includes(r[k])); return b; },
      then(res) {
        try {
          // relê o "servidor" a cada operação: várias abas fazem o papel de vários aparelhos
          const atual = JSON.parse(localStorage.getItem('mockdb') || '{}'); for (const k of Object.keys(atual)) db[k] = atual[k]; db[t] = db[t] || [];
          if (localStorage.getItem('mock_semtabelas') === '1') return res({ data: null, error: { message: "Could not find the table 'public." + t + "' in the schema cache", code: 'PGRST205' } });
          const m = r => st.filters.every(f => f(r));
          let data = null;
          if (st.op === 'select') { data = db[t].slice(st.range ? st.range[0] : 0, st.range ? st.range[1] + 1 : (st.lim || undefined)); }
          if (st.op === 'insert') { data = []; st.payload.forEach(p => { const row = { ...JSON.parse(JSON.stringify(DEF[t] || {})), id: uid(), user_id: 'u1', criado_em: new Date(Date.now() + (n++)).toISOString(), ...p }; db[t].push(row); data.push(row); }); }
          if (st.op === 'update') db[t].forEach(r => { if (m(r)) Object.assign(r, JSON.parse(JSON.stringify(st.payload))); });
          if (st.op === 'delete') {
            const ids = db[t].filter(m).map(r => r.id);
            db[t] = db[t].filter(r => !m(r));
            if (t === 'contas') db.lancamentos = (db.lancamentos || []).filter(l => !ids.includes(l.conta_id) && !ids.includes(l.conta_destino_id));
            if (t === 'cartoes') db.lancamentos = (db.lancamentos || []).filter(l => !ids.includes(l.cartao_id));
            if (t === 'categorias') { db.categorias = db.categorias.filter(c => !ids.includes(c.parent_id)); (db.lancamentos || []).forEach(l => { if (ids.includes(l.categoria_id)) l.categoria_id = null; }); }
          }
          save();
          res({ data: data && JSON.parse(JSON.stringify(data)), error: null });
        } catch (e) { res({ data: null, error: { message: String(e) } }); }
      },
    };
    return b;
  }
  const storage = {
    from() {
      return {
        async list(pref) { return { data: files.filter(f => f.path.startsWith(pref + '/')).map(f => ({ name: f.path.split('/').pop(), created_at: f.at, metadata: { size: f.size } })), error: null }; },
        async upload(path, file) { files.push({ path, size: file.size || 10, at: new Date().toISOString() }); save(); return { data: { path }, error: null }; },
        async createSignedUrl(path) { return { data: { signedUrl: 'about:blank#' + path }, error: null }; },
        async remove(paths) { for (const p of paths) { const i = files.findIndex(f => f.path === p); if (i >= 0) files.splice(i, 1); } save(); return { error: null }; },
      };
    },
  };
  window.supabase = {
    createClient() {
      let logged = localStorage.getItem('mocklogin') === '1';
      return {
        from: builder, storage,
        functions: { async invoke(nome, { body }) {
          if (body.acao === 'telegram_status') { const c = +(localStorage.getItem('mock_tgc') || 0); return { data: { token: localStorage.getItem('mock_tg') === '1', bot: 'NossoCaixaBot', conversas: c,
            pessoas: c ? [{ id: '1', nome: 'Ana', usuario: 'ana' }, { id: '2', nome: 'Beto', usuario: '' }].slice(0, c) : [],
            pendentes: c ? [] : [{ id: '1', nome: 'Ana', usuario: 'ana', quando: '2026-11-05T10:00:00Z' }, { id: '9', nome: 'Estranho', usuario: 'spam', quando: '2026-11-05T11:00:00Z' }] }, error: null }; }
          if (body.acao === 'telegram_desvincular') { localStorage.setItem('mock_tgc', String(Math.max(0, +(localStorage.getItem('mock_tgc') || 0) - 1))); return { data: { ok: true }, error: null }; }
          if (body.acao === 'telegram_recusar') return { data: { ok: true }, error: null };
          if (body.acao === 'telegram_salvar') { localStorage.setItem('mock_tg', '1'); return { data: { ok: true, bot: 'NossoCaixaBot' }, error: null }; }
          if (body.acao === 'telegram_vincular') { window.__vinc = body.ids; localStorage.setItem('mock_tgc', String((body.ids || []).length)); return { data: { ok: true, conversas: (body.ids || []).length, novos: ['Ana'] }, error: null }; }
          if (body.acao === 'relatorio') return { data: body.previa ? { texto: '<b>Nosso Caixa</b>\nSaldo: R$ 10' } : { ok: true, enviados: 2 }, error: null };
          if (body.acao === 'status') return { data: { credenciais: localStorage.getItem('mock_cred') === '1' }, error: null };
          if (body.acao === 'salvar_credenciais') { if (body.clientSecret !== 'certo') return { data: { erro: 'A Pluggy não aceitou esse Client ID / Client Secret.' }, error: null }; localStorage.setItem('mock_cred', '1'); return { data: { ok: true }, error: null }; }
          if (body.acao === 'contas') { db.pluggy_contas = db.pluggy_contas || []; if (!db.pluggy_contas.length) db.pluggy_contas.push({ id: 'ACC1', user_id: 'u1', item_id: body.itens[0], nome: 'Conta Bradesco', tipo: 'BANK', numero: '123', conta_id: null, cartao_id: null, ativo: true }, { id: 'ACC2', user_id: 'u1', item_id: body.itens[0], nome: 'Visa Infinite', tipo: 'CREDIT', conta_id: null, cartao_id: null, ativo: true }); save(); return { data: { contas: db.pluggy_contas }, error: null }; }
          const v = (db.pluggy_contas || []).filter(x => x.conta_id || x.cartao_id);
          if (!v.length) return { data: { erro: 'Nenhuma conta da Pluggy vinculada.' }, error: null };
          db.lancamentos.push({ ...JSON.parse(JSON.stringify(DEF.lancamentos)), id: uid(), user_id: 'u1', tipo: 'despesa', descricao: 'UBER TRIP', valor: 23.9, data: new Date().toISOString().slice(0, 10), conta_id: v[0].conta_id, ext_id: 'pluggy:x1', observacao: 'Open Finance' });
          db.pluggy_execucoes = db.pluggy_execucoes || []; db.pluggy_execucoes.unshift({ id: uid(), inicio: new Date().toISOString(), fim: new Date().toISOString(), origem: 'manual', novos: 1, conciliados: 0 }); save();
          return { data: { novos: 1, conciliados: 0 }, error: null };
        } },
        auth: {
          async getSession() { return { data: { session: logged ? { user: { id: 'u1' } } : null } }; },
          async getUser() { return { data: { user: logged ? { id: 'u1' } : null } }; },
          async signInWithPassword({ password }) { if (password !== 'certa') return { error: { message: 'Invalid login credentials' } }; logged = true; localStorage.setItem('mocklogin', '1'); return { error: null }; },
          async signUp({ email }) { if (localStorage.getItem('mock_usuario')) return { data: {}, error: { message: 'Database error saving new user' } }; localStorage.setItem('mock_usuario', email); logged = true; localStorage.setItem('mocklogin', '1'); return { data: { session: { user: { id: 'u1' } } }, error: null }; },
          async signOut() { logged = false; localStorage.removeItem('mocklogin'); return { error: null }; },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
        },
      };
    },
  };
})();
