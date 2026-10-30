// =====================================================================
//  NOSSO CAIXA · Sincronização Open Finance (Pluggy / Meu Pluggy)
//  Supabase Edge Function "pluggy-sync"
//  Segredos necessários (Supabase → Edge Functions → Secrets):
//    PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET
//  Chamadas:
//    - pelo site (usuário logado): { acao: 'contas' } ou { acao: 'sincronizar' }
//    - pelo agendamento (pg_cron): cabeçalho x-nc-cron
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const PLUGGY = 'https://api.pluggy.ai';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nc-cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- utilitários ----------
const p2 = (n: number) => String(n).padStart(2, '0');
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília
const addDias = (ds: string, n: number) => { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMeses = (ym: string, n: number) => { let [y, m] = ym.split('-').map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${p2(m)}`; };
const diasNoMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const difDias = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const semAcento = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

function faturaYM(c: any, ds: string) {
  const ym = ds.slice(0, 7), d = +ds.slice(8, 10);
  const [y, m] = ym.split('-').map(Number);
  const fech = Math.min(c.dia_fechamento, diasNoMes(y, m));
  const fechYM = d >= fech ? addMeses(ym, 1) : ym;
  let fy = c.dia_vencimento > c.dia_fechamento ? fechYM : addMeses(fechYM, 1);
  const fechadas: string[] = c.faturas_fechadas || [];
  for (let i = 0; i < 24 && fechadas.includes(fy); i++) fy = addMeses(fy, 1);
  return fy;
}

// categoria da Pluggy → nome de categoria do Nosso Caixa (usado só quando não há regra nem histórico)
const CAT_PLUGGY: [RegExp, string][] = [
  [/supermarket|groceries|supermercado/i, 'Supermercado'], [/restaurant|food delivery|eating|bar|lanch/i, 'Restaurantes/Lanches'],
  [/pharmac|drugstore|health|hospital|medic|dentist/i, 'Saúde'], [/gas station|fuel|parking|transport|taxi|ride|toll|automotive/i, 'Transporte'],
  [/telecom|phone|internet|mobile/i, 'Telefonia'], [/electricity|energy/i, 'Energia Elétrica'], [/streaming|leisure|entertainment|travel|tourism/i, 'Lazer'],
  [/education|school|course/i, 'Educação'], [/clothing|apparel/i, 'Vestuário'], [/insurance/i, 'Seguros'], [/tax|fee|bank fees|iof/i, 'Impostos e Tarifas'],
  [/rent|housing|condominium|home/i, 'Moradia'], [/salary|wage|payroll/i, 'Salário'], [/investment income|interest|yield|dividend/i, 'Rendimentos'],
];

// ===================== RELATÓRIO DIÁRIO (Telegram) =====================
const brl = (v: number) => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const escH = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dataBR = (ds: string) => `${ds.slice(8, 10)}/${ds.slice(5, 7)}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
async function tudo(admin: any, tabela: string, cols: string, userId: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(tabela).select(cols).eq('user_id', userId).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
async function tg(token: string, metodo: string, corpo: any) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('Telegram: ' + (j.description || r.status));
  return j.result;
}
async function montarRelatorio(admin: any, userId: string, prefs: any, P: (p: string) => Promise<any>, vinculos: any[]) {
  const h = hoje(), ontem = addDias(h, -1), ym = h.slice(0, 7), iniMes = ym + '-01';
  const [contas, cartoes, cats, orcs, lancs] = await Promise.all([
    tudo(admin, 'contas', 'id,nome,arquivada,considerar_saldo,saldo_inicial', userId),
    tudo(admin, 'cartoes', 'id,nome,arquivado,limite,dia_fechamento,dia_vencimento,faturas_fechadas', userId),
    tudo(admin, 'categorias', 'id,nome,parent_id', userId),
    tudo(admin, 'orcamentos', 'id,categoria_id,mes,valor', userId),
    tudo(admin, 'lancamentos', 'id,tipo,descricao,valor,data,pago,conta_id,conta_destino_id,cartao_id,fatura_mes,categoria_id,serie', userId),
  ]);
  const num = (v: any) => Number(v) || 0;
  const L: string[] = [];
  L.push(`<b>☀️ Nosso Caixa · ${dataBR(h)}</b>`);

  // ---- saldo do banco ----
  L.push('', '<b>🏦 Saldo</b>');
  const efeito = (l: any, cid: string) => {
    const v = num(l.valor);
    if (l.cartao_id && l.tipo !== 'pagamento_fatura') return 0;
    if ((l.tipo === 'receita') && l.conta_id === cid) return v;
    if ((l.tipo === 'despesa' || l.tipo === 'pagamento_fatura') && l.conta_id === cid) return -v;
    if (l.tipo === 'transferencia') { if (l.conta_id === cid) return -v; if (l.conta_destino_id === cid) return v; }
    return 0;
  };
  const saldosBanco: Record<string, number> = {};
  for (const v of vinculos.filter(x => x.conta_id)) {
    try { const a = await P('/accounts/' + v.id); if (a?.type === 'BANK' && typeof a.balance === 'number') saldosBanco[v.conta_id] = (saldosBanco[v.conta_id] || 0) + a.balance; } catch { /* sem saldo */ }
  }
  let totalNC = 0;
  for (const c of contas.filter((c: any) => !c.arquivada && c.considerar_saldo !== false)) {
    let sc = num(c.saldo_inicial), prev = sc;
    for (const l of lancs) { if (l.data > h) { if (l.data.slice(0, 7) === ym) prev += efeito(l, c.id); continue; } const e = efeito(l, c.id); if (l.pago) sc += e; prev += e; }
    sc = r2(sc); prev = r2(prev); totalNC += sc;
    if (Math.abs(sc) < 0.005 && !(c.id in saldosBanco)) continue;
    const banco = saldosBanco[c.id];
    L.push(`• ${escH(c.nome)}: <b>${brl(banco ?? sc)}</b>` + (banco !== undefined && Math.abs(banco - sc) >= 1 ? ` <i>(no Nosso Caixa: ${brl(sc)})</i>` : ''));
    if (Math.abs(prev - sc) >= 1) L.push(`   previsto p/ fim do mês: ${brl(prev)}`);
  }

  // ---- contas pagas e valores recebidos (lançamentos confirmados nas contas) ----
  const idsContas = new Set(contas.map((c: any) => c.id));
  const nomeConta = (id: string) => (contas.find((c: any) => c.id === id) as any)?.nome || '';
  const nomeCartao = (id: string) => (cartoes.find((c: any) => c.id === id) as any)?.nome || '';
  const desc = (l: any) => escH(l.tipo === 'pagamento_fatura' ? `Fatura ${nomeCartao(l.cartao_id)}` : String(l.descricao || '').replace(/\s+/g, ' ').slice(0, 34));
  const saidas = lancs.filter((l: any) => l.pago && idsContas.has(l.conta_id) && (l.tipo === 'pagamento_fatura' || (l.tipo === 'despesa' && !l.cartao_id)));
  const entradas = lancs.filter((l: any) => l.pago && idsContas.has(l.conta_id) && l.tipo === 'receita' && !l.cartao_id);
  const lista = (arr: any[], max: number) => {
    const ord = [...arr].sort((a, b) => num(b.valor) - num(a.valor));
    const out = ord.slice(0, max).map(l => `   ${desc(l)} · ${brl(num(l.valor))}`);
    if (ord.length > max) out.push(`   <i>+ ${ord.length - max} outro(s)</i>`);
    return out;
  };
  const soma2 = (arr: any[]) => r2(arr.reduce((s: number, l: any) => s + num(l.valor), 0));
  const pagOntem = saidas.filter((l: any) => l.data === ontem), pagMes = saidas.filter((l: any) => l.data.slice(0, 7) === ym && l.data <= h);
  const recOntem = entradas.filter((l: any) => l.data === ontem), recMes = entradas.filter((l: any) => l.data.slice(0, 7) === ym && l.data <= h);
  L.push('', `<b>✅ Contas pagas ontem</b>`);
  if (pagOntem.length) L.push(`• ${pagOntem.length} pagamento(s) · <b>${brl(soma2(pagOntem))}</b>`, ...lista(pagOntem, 8));
  else L.push('• Nenhum pagamento ontem.');
  L.push(`<i>No mês: ${pagMes.length} pagamento(s) · ${brl(soma2(pagMes))}</i>`);
  L.push('', `<b>💰 Valores recebidos</b>`);
  if (recOntem.length) L.push(`• Ontem: <b>${brl(soma2(recOntem))}</b>`, ...lista(recOntem, 6));
  else L.push('• Ontem: nada recebido.');
  L.push(`• No mês: <b>${brl(soma2(recMes))}</b>`);
  if (recMes.length) L.push(...lista(recMes, 4).map(x => x.replace('   ', '   ↳ ')));

  // ---- Pix (direto do banco) ----
  const contaBanco = vinculos.filter(x => x.conta_id);
  let pixE = { n: 0, v: 0 }, pixR = { n: 0, v: 0 }, pixEm = 0, pixRm = 0;
  for (const v of contaBanco) {
    try {
      const r = await P(`/v2/transactions?accountId=${encodeURIComponent(v.id)}&dateFrom=${iniMes < ontem ? iniMes : ontem}&dateTo=${h}`);
      for (const t of r.results || []) {
        if (!/pix/i.test(String(t.description || '') + ' ' + String(t.descriptionRaw || '') + ' ' + String(t.paymentData?.paymentMethod || ''))) continue;
        const d = String(t.date).slice(0, 10), val = Math.abs(num(t.amount)), ent = t.type ? t.type === 'CREDIT' : t.amount > 0;
        if (d.slice(0, 7) === ym) { if (ent) pixRm += val; else pixEm += val; }
        if (d === ontem) { if (ent) { pixR.n++; pixR.v += val; } else { pixE.n++; pixE.v += val; } }
      }
    } catch { /* sem pix */ }
  }
  L.push('', `<b>⚡ Pix de ontem (${dataBR(ontem)})</b>`,
    `• Enviados: ${pixE.n} · <b>${brl(pixE.v)}</b>`, `• Recebidos: ${pixR.n} · <b>${brl(pixR.v)}</b>`,
    `<i>No mês: enviados ${brl(pixEm)} · recebidos ${brl(pixRm)}</i>`);

  // ---- cartões ----
  const base = prefs.faturas_base || '';
  const fatMes = (l: any) => String(l.fatura_mes || '').slice(0, 7);
  const cache = new Map<string, number>();
  const aPagar = (c: any, fym: string): number => {
    const k = c.id + fym; if (cache.has(k)) return cache.get(k)!;
    const doC = lancs.filter((l: any) => l.cartao_id === c.id);
    const tot = doC.filter((l: any) => fatMes(l) === fym && (l.tipo === 'despesa' || l.tipo === 'receita')).reduce((s: number, l: any) => s + (l.tipo === 'despesa' ? 1 : -1) * num(l.valor), 0);
    const pago = doC.filter((l: any) => l.tipo === 'pagamento_fatura' && l.pago && fatMes(l) === fym).reduce((s: number, l: any) => s + num(l.valor), 0);
    const meses = [...new Set(doC.map(fatMes).filter(Boolean))].sort();
    const prev = addMeses(fym, -1);
    const ant = meses.length && meses[0] < fym && prev >= meses[0] && prev > base ? aPagar(c, prev) : 0;
    const v = r2(Math.max(0, ant + tot - pago)); cache.set(k, v); return v;
  };
  L.push('', '<b>💳 Cartões</b>');
  let gastoOntemTot = 0, gastoMesTot = 0;
  for (const c of cartoes.filter((c: any) => !c.arquivado)) {
    const doC = lancs.filter((l: any) => l.cartao_id === c.id && (l.tipo === 'despesa' || l.tipo === 'receita'));
    const sinal = (l: any) => (l.tipo === 'despesa' ? 1 : -1) * num(l.valor);
    const gOntem = r2(doC.filter((l: any) => l.data === ontem).reduce((s: number, l: any) => s + sinal(l), 0));
    const gMes = r2(doC.filter((l: any) => l.data.slice(0, 7) === ym && l.data <= h).reduce((s: number, l: any) => s + sinal(l), 0));
    const fym = faturaYM(c, h);
    const fat = aPagar(c, fym);
    const venc = `${fym}-${p2(Math.min(c.dia_vencimento, diasNoMes(+fym.slice(0, 4), +fym.slice(5, 7))))}`;
    // fatura anterior ainda em aberto (fechada e não paga)
    const fAnt = addMeses(fym, -1), vAnt = aPagar(c, fAnt);
    if (!gMes && !fat && !vAnt) continue;
    gastoOntemTot += gOntem; gastoMesTot += gMes;
    L.push(`<b>${escH(c.nome)}</b>`, `• Gasto ontem: ${brl(gOntem)} · no mês: ${brl(gMes)}`, `• Fatura ${MESES[+fym.slice(5, 7) - 1]} (vence ${dataBR(venc)}): <b>${brl(fat)}</b>`);
    if (vAnt > 0.004 && fAnt > base) L.push(`• ⚠️ Fatura de ${MESES[+fAnt.slice(5, 7) - 1]} ainda a pagar: <b>${brl(vAnt)}</b>`);
  }
  L.push(`<i>Total no cartão: ontem ${brl(gastoOntemTot)} · no mês ${brl(gastoMesTot)}</i>`);

  // ---- orçamento ----
  const catById = new Map(cats.map((c: any) => [c.id, c]));
  const raiz = (id: string) => { const c: any = catById.get(id); return c?.parent_id ? (catById.get(c.parent_id) as any) || c : c; };
  const metas = new Map<string, number>();
  for (const o of orcs.filter((o: any) => String(o.mes).slice(0, 7) === ym)) { const k = raiz(o.categoria_id)?.id || o.categoria_id; metas.set(k, (metas.get(k) || 0) + num(o.valor)); }
  L.push('', `<b>🎯 Orçamento de ${MESES[+ym.slice(5, 7) - 1]}</b>`);
  if (!metas.size) L.push('<i>Nenhuma meta definida para este mês (Metas → Orçamento).</i>');
  else {
    const real = new Map<string, number>();
    for (const l of lancs) {
      if (l.data.slice(0, 7) !== ym || l.data > h) continue;
      const desp = l.tipo === 'despesa', estCartao = l.tipo === 'receita' && l.cartao_id;
      if (!desp && !estCartao) continue;
      const k = raiz(l.categoria_id)?.id || '_';
      real.set(k, (real.get(k) || 0) + (desp ? 1 : -1) * num(l.valor));
    }
    let tM = 0, tR = 0; const linhas: any[] = [];
    for (const [k, m] of metas) { const r = r2(real.get(k) || 0); tM += m; tR += r; linhas.push({ nome: (catById.get(k) as any)?.nome || '?', m, r, p: m ? r / m : 0 }); }
    const dia = +h.slice(8, 10), dm = diasNoMes(+ym.slice(0, 4), +ym.slice(5, 7));
    const pct = tM ? Math.round(tR / tM * 100) : 0, pctMes = Math.round(dia / dm * 100);
    L.push(`• Usado: <b>${pct}%</b> (${brl(tR)} de ${brl(tM)})`, `• Mês decorrido: ${pctMes}% ${pct > pctMes + 5 ? '— acima do ritmo ⚠️' : pct < pctMes - 5 ? '— abaixo do ritmo ✅' : '— no ritmo'}`);
    const alertas = linhas.filter(x => x.p >= 0.8).sort((a, b) => b.p - a.p).slice(0, 4);
    if (alertas.length) L.push('<i>Atenção:</i> ' + alertas.map(x => `${escH(x.nome)} ${Math.round(x.p * 100)}%`).join(' · '));
  }
  L.push('', '<a href="https://brunnocoe-cloud.github.io/nosso-caixa/">Abrir o Nosso Caixa</a>');
  return L.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
  let SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SERVICE) { try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); SERVICE = k.default || Object.values(k)[0] as string || ''; } catch { /* sem chave */ } }
  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }

  // ---------- quem está chamando ----------
  let userId: string | null = null, origem = 'manual';
  const cron = req.headers.get('x-nc-cron');
  if (cron) {
    const { data: ok } = await admin.rpc('nc_cron_ok', { t: cron });
    if (ok !== true) return json({ erro: 'Não autorizado.' }, 401);
    const { data: p } = await admin.from('preferencias').select('user_id').limit(1);
    userId = p?.[0]?.user_id ?? null; origem = 'agendado';
  } else {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data } = await admin.auth.getUser(jwt);
    userId = data?.user?.id ?? null;
  }
  if (!userId) return json({ erro: 'Faça login no Nosso Caixa.' }, 401);

  // ---------- Telegram (token e conversas ficam no cofre privado) ----------
  const cfg = async (k: string) => { const { data } = await admin.rpc('nc_cfg_get', { k }); return (data as string) || ''; };
  const setCfg = async (k: string, v: string) => { const { error } = await admin.rpc('nc_cfg_set', { k, v }); if (error) throw error; };
  try {
    if (body.acao === 'telegram_status') {
      const token = await cfg('telegram_token'), chats = await cfg('telegram_chats');
      let bot = '';
      if (token) { try { bot = (await tg(token, 'getMe', {})).username; } catch { /* token inválido */ } }
      return json({ token: Boolean(token), bot, conversas: chats ? chats.split(',').filter(Boolean).length : 0 });
    }
    if (body.acao === 'telegram_salvar') {
      const token = String(body.token || '').trim();
      if (!/^\d+:[\w-]{30,}$/.test(token)) return json({ erro: 'Esse não parece um token do BotFather (formato 123456789:ABC...).' }, 400);
      const me = await tg(token, 'getMe', {});
      await setCfg('telegram_token', token);
      return json({ ok: true, bot: me.username });
    }
    if (body.acao === 'telegram_vincular') {
      const token = await cfg('telegram_token');
      if (!token) return json({ erro: 'Cadastre primeiro o token do bot.' }, 400);
      const ups = await tg(token, 'getUpdates', { limit: 100 });
      const ids = new Set((await cfg('telegram_chats')).split(',').filter(Boolean));
      const novos: string[] = [];
      for (const u of ups) { const ch = u.message?.chat; if (ch?.type === 'private' && !ids.has(String(ch.id))) { ids.add(String(ch.id)); novos.push(ch.first_name || String(ch.id)); } }
      if (!ids.size) return json({ erro: 'O bot ainda não recebeu nenhuma mensagem. Abra o bot no Telegram, toque em Iniciar (/start) e tente de novo.' }, 400);
      await setCfg('telegram_chats', [...ids].join(','));
      for (const id of ids) await tg(token, 'sendMessage', { chat_id: id, text: '✅ Nosso Caixa vinculado. O resumo financeiro chega aqui todos os dias às 8h.' }).catch(() => {});
      return json({ ok: true, conversas: ids.size, novos });
    }
    if (body.acao === 'telegram_desvincular') { await setCfg('telegram_chats', ''); return json({ ok: true }); }
  } catch (e) { return json({ erro: String((e as Error)?.message || e) }, 500); }

  // ---------- credenciais da Pluggy (segredo do Supabase ou cofre privado do banco) ----------
  let ultimoErroAuth = '';
  const autenticar = async (id: string, secret: string) => {
    const r = await fetch(PLUGGY + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id, clientSecret: secret }) });
    if (r.ok) return (await r.json()).apiKey as string;
    ultimoErroAuth = `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
    return null;
  };
  if (body.acao === 'salvar_credenciais') {
    const id = String(body.clientId || '').trim(), secret = String(body.clientSecret || '').trim();
    if (!id || !secret) return json({ erro: 'Informe o Client ID e o Client Secret.' }, 400);
    if (!(await autenticar(id, secret))) return json({ erro: 'A Pluggy não aceitou esse Client ID / Client Secret (' + ultimoErroAuth + ').' }, 400);
    const { error } = await admin.rpc('nc_pluggy_cred_salvar', { cid: id, csecret: secret });
    if (error) return json({ erro: 'Não foi possível guardar a chave: ' + error.message }, 500);
    return json({ ok: true });
  }
  let clientId = Deno.env.get('PLUGGY_CLIENT_ID') || '', clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET') || '';
  if (!clientId || !clientSecret) { const { data: c } = await admin.rpc('nc_pluggy_cred'); clientId = c?.id || ''; clientSecret = c?.secret || ''; }
  if (body.acao === 'status') return json({ credenciais: Boolean(clientId && clientSecret) });
  if (!clientId || !clientSecret) return json({ erro: 'Falta cadastrar a chave da Pluggy (Client ID e Client Secret) na tela Open Finance.' }, 400);

  const exec = { user_id: userId, origem, novos: 0, conciliados: 0, ignorados: 0, erro: null as string | null, detalhes: [] as string[] };
  try {
    // ---------- Pluggy ----------
    const apiKey = await autenticar(clientId, clientSecret);
    if (!apiKey) throw new Error('A Pluggy recusou a chave cadastrada (Client ID / Client Secret). Cadastre-a de novo na tela Open Finance.');
    const P = async (path: string) => {
      const r = await fetch(PLUGGY + path, { headers: { 'X-API-KEY': apiKey } });
      if (!r.ok) throw new Error(`Pluggy ${r.status} em ${path.split('?')[0]}: ${(await r.text()).slice(0, 200)}`);
      return r.json();
    };
    if (body.acao === 'connect_token') {
      const r = await fetch(PLUGGY + '/connect_token', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify(body.itemId ? { itemId: body.itemId, options: { clientUserId: userId } } : { options: { clientUserId: userId, avoidDuplicates: true } }) });
      if (!r.ok) throw new Error('Pluggy não gerou o acesso de conexão: ' + (await r.text()).slice(0, 200));
      return json({ accessToken: (await r.json()).accessToken });
    }
    const { data: prefRow } = await admin.from('preferencias').select('dados').eq('user_id', userId).limit(1);
    const prefs = prefRow?.[0]?.dados || {};
    const itens: string[] = (body.itens || prefs.pluggy?.itens || []).map((s: string) => String(s).trim()).filter(Boolean);
    if (!itens.length) return json({ erro: 'Nenhuma conexão (Item ID) informada. Cadastre em Configurações → Open Finance.' }, 400);

    // ---------- listar contas para o vínculo ----------
    if (body.acao === 'contas') {
      const contas: any[] = [];
      const [{ data: ncContas }, { data: ncCartoes }, { data: jaVinc }] = await Promise.all([
        admin.from('contas').select('id,nome,arquivada').eq('user_id', userId),
        admin.from('cartoes').select('id,nome,arquivado').eq('user_id', userId),
        admin.from('pluggy_contas').select('id,conta_id,cartao_id').eq('user_id', userId),
      ]);
      const palavras = (s: string) => semAcento(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !['conta', 'corrente', 'cartao', 'credito', 'banco', 'poupanca', 'card'].includes(w));
      const adivinhar = (lista: any[], ...textos: string[]) => {
        const ws = new Set(textos.flatMap(t => palavras(t || '')));
        const achados = lista.filter(x => palavras(x.nome).some(w => ws.has(w)));
        return achados.length === 1 ? achados[0].id : null;
      };
      for (const it of itens) {
        const item = await P('/items/' + it);
        const acc = await P('/accounts?itemId=' + it);
        for (const a of acc.results || []) {
          contas.push({ id: a.id, item_id: it, nome: a.name || a.marketingName, tipo: a.type, subtipo: a.subtype, numero: a.number, saldo: a.balance,
            banco: item.connector?.name, status: item.status, atualizado: item.lastUpdatedAt || item.updatedAt });
          const reg: any = { id: a.id, user_id: userId, item_id: it, nome: a.name || a.marketingName, tipo: a.type, numero: a.number };
          const antigo = (jaVinc || []).find((x: any) => x.id === a.id);
          if (!antigo || (!antigo.conta_id && !antigo.cartao_id)) {
            // primeiro vínculo automático pelo nome (dá para trocar na tela)
            if (a.type === 'CREDIT') reg.cartao_id = adivinhar((ncCartoes || []).filter((c: any) => !c.arquivado), a.name, a.marketingName, a.creditData?.brand);
            else reg.conta_id = adivinhar((ncContas || []).filter((c: any) => !c.arquivada), a.name, a.marketingName, item.connector?.name);
          }
          await admin.from('pluggy_contas').upsert(reg, { onConflict: 'id' });
        }
      }
      return json({ contas });
    }

    // ---------- sincronizar ----------
    const { data: vinculos } = await admin.from('pluggy_contas').select('*').eq('user_id', userId).eq('ativo', true);
    const ativos = (vinculos || []).filter((v: any) => v.conta_id || v.cartao_id);
    if (body.acao === 'relatorio') {
      const texto = await montarRelatorio(admin, userId, prefs, P, ativos);
      if (body.previa) return json({ texto });
      const token = await cfg('telegram_token'), chats = (await cfg('telegram_chats')).split(',').filter(Boolean);
      if (!token || !chats.length) return json({ erro: 'Telegram ainda não configurado (token e /start no bot).', texto }, 400);
      for (const id of chats) await tg(token, 'sendMessage', { chat_id: id, text: texto, parse_mode: 'HTML', disable_web_page_preview: true });
      return json({ ok: true, enviados: chats.length });
    }
    if (!ativos.length) return json({ erro: 'Nenhuma conta da Pluggy vinculada. Em Configurações → Open Finance, clique em "Buscar contas" e escolha o destino de cada uma.' }, 400);

    if (body.acao === 'diagnostico') {
      const ini = body.desde || addDias(hoje(), -10);
      const rel: any[] = [];
      for (const v of ativos) {
        const r = await P(`/v2/transactions?accountId=${encodeURIComponent(v.id)}&dateFrom=${ini}&dateTo=${addDias(hoje(), 45)}`);
        const ts = r.results || [];
        const { data: ja } = await admin.from('lancamentos').select('ext_id').eq('user_id', userId).in('ext_id', ts.map((t: any) => 'pluggy:' + t.id));
        const setJa = new Set((ja || []).map((x: any) => x.ext_id));
        rel.push({ conta: v.nome, tipo: v.tipo, total: ts.length,
          finais: Object.entries(ts.reduce((m: any, t: any) => { const k = t.creditCardMetadata?.cardNumber || '-'; m[k] = (m[k] || 0) + 1; return m; }, {})),
          itens: ts.slice(0, 15).map((t: any) => [String(t.date).slice(0, 10), t.amount, t.type, t.status, String(t.description || '').slice(0, 22), setJa.has('pluggy:' + t.id) ? 'no NC' : '-', t.creditCardMetadata?.cardNumber || '']) });
      }
      return json({ desde: prefs.pluggy?.desde, rel });
    }
    const desdeCfg = prefs.pluggy?.desde || hoje();
    const desde = desdeCfg > addDias(hoje(), -120) ? desdeCfg : addDias(hoje(), -120);
    const [{ data: cartoes }, { data: regras }, { data: categorias }] = await Promise.all([
      admin.from('cartoes').select('*').eq('user_id', userId),
      admin.from('regras').select('*').eq('user_id', userId),
      admin.from('categorias').select('id,nome,tipo,parent_id').eq('user_id', userId),
    ]);
    // lançamentos existentes da janela (para não duplicar e para conciliar)
    const existentes: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('lancamentos').select('id,tipo,descricao,valor,data,pago,conta_id,cartao_id,fatura_mes,ext_id,observacao,categoria_id')
        .eq('user_id', userId).gte('data', addDias(desde, -40)).order('id').range(from, from + 999);
      if (error) throw error;
      existentes.push(...data); if (data.length < 1000) break;
    }
    // parcelas e fixas de cartão lançadas com a data da compra original: buscar também pela fatura
    const vistos = new Set(existentes.map(l => l.id));
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('lancamentos').select('id,tipo,descricao,valor,data,pago,conta_id,cartao_id,fatura_mes,ext_id,observacao,categoria_id')
        .eq('user_id', userId).gte('fatura_mes', addMeses(desde.slice(0, 7), -1) + '-01').order('id').range(from, from + 999);
      if (error) throw error;
      for (const l of data) if (!vistos.has(l.id)) existentes.push(l);
      if (data.length < 1000) break;
    }
    const comExt = new Set(existentes.map(l => l.ext_id).filter(Boolean));
    // histórico para aprender categoria pela descrição
    const { data: hist } = await admin.from('lancamentos').select('descricao,tipo,categoria_id').eq('user_id', userId).not('categoria_id', 'is', null).order('data', { ascending: false }).limit(3000);
    const aprendido = new Map<string, string>();
    for (const h of hist || []) { const k = h.tipo + '|' + semAcento(h.descricao); if (!aprendido.has(k)) aprendido.set(k, h.categoria_id); }
    const catPorNome = (nome: string, tipo: string) => (categorias || []).find((c: any) => c.tipo === tipo && semAcento(c.nome) === semAcento(nome))?.id || null;
    const regraPara = (desc: string, tipo: string) => {
      const d = semAcento(desc); const rs = (regras || []).filter((r: any) => r.tipo === tipo);
      return rs.find((r: any) => semAcento(r.descricao) === d)
        || rs.find((r: any) => String(r.palavras || '').split(/[,;\n]/).map(semAcento).filter(Boolean).some((p: string) => d.includes(p)))
        || rs.find((r: any) => semAcento(r.descricao).length >= 4 && d.includes(semAcento(r.descricao))) || null;
    };
    const categorizar = (desc: string, tipo: string, catPluggy: string) => {
      const r = regraPara(desc, tipo);
      if (r?.categoria_id) return { cat: r.categoria_id, regra: r };
      const k = aprendido.get(tipo + '|' + semAcento(desc)); if (k) return { cat: k, regra: r };
      for (const [re, nome] of CAT_PLUGGY) if (re.test(catPluggy || '')) { const id = catPorNome(nome, tipo); if (id) return { cat: id, regra: r }; }
      return { cat: null, regra: r };
    };
    const usados = new Set<string>();
    const novos: any[] = [], atualizar: [string, any][] = [], remover: string[] = [];
    const EM_ABERTO = 'Open Finance (em aberto)';
    const porExt = new Map(existentes.filter(l => l.ext_id).map(l => [l.ext_id, l]));

    for (const v of ativos) {
      const txs: any[] = [];
      // v2 com cursor (o /transactions paginado foi desativado pela Pluggy)
      // cartão: a Pluggy recusa janelas acima de ~90 dias (medido no Fôlego); usa no máximo 85
      const iniConta = v.cartao_id && desde < addDias(hoje(), -85) ? addDias(hoje(), -85) : desde;
      let caminho = `/v2/transactions?accountId=${encodeURIComponent(v.id)}&dateFrom=${iniConta}&dateTo=${addDias(hoje(), 45)}`;
      for (let pag = 0; pag < 40; pag++) {
        const r = await P(caminho);
        txs.push(...(r.results || []));
        const nx = r.next;
        if (!nx) break;
        caminho = String(nx).startsWith('http') ? new URL(nx).pathname + new URL(nx).search : String(nx).startsWith('/') ? nx : `/v2/transactions?${String(nx).replace(/^\?/, '')}`;
      }
      let bills: Record<string, string> = {};
      if (v.cartao_id) { try { const b = await P(`/bills?accountId=${v.id}&pageSize=500`); for (const x of b.results || []) bills[x.id] = String(x.dueDate).slice(0, 10); } catch { /* sem faturas */ } }
      const cartao = v.cartao_id ? (cartoes || []).find((c: any) => c.id === v.cartao_id) : null;
      const cartoesDaConta = (cartoes || []).filter((c: any) => !c.arquivado && c.conta_id === v.conta_id);

      const idsAgora = new Set(txs.map((t: any) => 'pluggy:' + t.id));
      for (const t of txs) {
        const ext = 'pluggy:' + t.id;
        if (comExt.has(ext)) {
          // compra de cartão que estava em aberto e agora foi confirmada: só atualiza
          const ja = porExt.get(ext);
          if (ja && ja.observacao === EM_ABERTO && t.status !== 'PENDING') { atualizar.push([ja.id, { observacao: 'Open Finance' }]); exec.conciliados++; }
          else exec.ignorados++;
          continue;
        }
        const data = String(t.date).slice(0, 10);
        if (data < desde) continue;
        const valor = r2(Math.abs(t.amount));
        if (!valor) continue;
        const entrada = t.type ? t.type === 'CREDIT' : t.amount > 0;
        const desc = String(t.description || t.descriptionRaw || 'Lançamento').replace(/\s+/g, ' ').trim().slice(0, 120);
        // conta: só entra confirmado. Cartão: a compra fica PENDING até a fatura fechar,
        // então entra já (marcada "em aberto") para a fatura atual ficar correta.
        if (t.status === 'PENDING' && !cartao) { exec.ignorados++; continue; }
        const pendente = t.status === 'PENDING';
        let linha: any = { user_id: userId, descricao: desc, valor, data, pago: true, conciliado: false, ext_id: ext, observacao: pendente ? 'Open Finance (em aberto)' : 'Open Finance', tags: [] };

        if (cartao) {
          // pagamento da fatura visto pelo cartão: já entra pelo lado da conta
          if (entrada && /pagamento|pgto|pag fat|payment/i.test(desc)) { exec.ignorados++; continue; }
          const md = t.creditCardMetadata || {};
          const fy = md.billId && bills[md.billId] ? bills[md.billId].slice(0, 7) : faturaYM(cartao, data);
          linha = { ...linha, tipo: entrada ? 'receita' : 'despesa', cartao_id: cartao.id, fatura_mes: fy + '-01' };
          if (md.totalInstallments > 1) { linha.parcela = md.installmentNumber; linha.total_parcelas = md.totalInstallments; linha.serie = 'parcelada'; }
          const { cat, regra } = categorizar(desc, linha.tipo, t.category);
          linha.categoria_id = cat; if (regra?.titular) linha.criado_por = regra.titular; if (regra?.tags?.length) linha.tags = regra.tags;
          // conciliação: mesmo cartão, mesmo valor, mesma fatura ou data próxima (ex.: parcelas e fixas já trazidas do Meu Dinheiro)
          const par = existentes.find(l => !usados.has(l.id) && l.cartao_id === cartao.id && l.tipo === linha.tipo && Math.abs(Number(l.valor) - valor) < 0.005
            && !String(l.ext_id || '').startsWith('pluggy:') && ((l.fatura_mes || '').slice(0, 7) === fy || Math.abs(difDias(l.data, data)) <= 4));
          // já previsto (parcela/fixa do Meu Dinheiro): só vincula quando a Pluggy confirmar; enquanto em aberto, não duplica
          if (par && pendente) { usados.add(par.id); exec.ignorados++; continue; }
          if (par) { usados.add(par.id); atualizar.push([par.id, { ext_id: ext, observacao: 'Open Finance', fatura_mes: linha.fatura_mes }]); exec.conciliados++; continue; }
          // a mesma compra que entrou "em aberto" com outro id da Pluggy: troca o id em vez de duplicar
          if (!pendente) {
            const aberto = existentes.find(l => !usados.has(l.id) && l.cartao_id === cartao.id && l.observacao === EM_ABERTO && l.tipo === linha.tipo
              && Math.abs(Number(l.valor) - valor) < 0.005 && Math.abs(difDias(l.data, data)) <= 5 && !idsAgora.has(l.ext_id));
            if (aberto) { usados.add(aberto.id); atualizar.push([aberto.id, { ext_id: ext, observacao: 'Open Finance', fatura_mes: linha.fatura_mes }]); exec.conciliados++; continue; }
          }
          novos.push(linha); comExt.add(ext); continue;
        }

        // conta bancária
        linha.conta_id = v.conta_id;
        linha.tipo = entrada ? 'receita' : 'despesa';
        // pagamento de fatura de cartão
        if (!entrada && /fatura|cart[aã]o|cartao|pgto cc|pag cc|card/i.test(desc) && cartoesDaConta.length) {
          let alvo = cartoesDaConta.length === 1 ? cartoesDaConta[0] : null;
          if (!alvo) alvo = cartoesDaConta.find((c: any) => semAcento(desc).includes(semAcento(c.nome))) || null;
          // paga a última fatura já fechada na data do pagamento
          if (alvo) { linha = { ...linha, tipo: 'pagamento_fatura', cartao_id: alvo.id, fatura_mes: addMeses(faturaYM(alvo, data), -1) + '-01', descricao: `Pagamento cartão ${alvo.nome}` }; }
        }
        if (linha.tipo !== 'pagamento_fatura') {
          const { cat, regra } = categorizar(desc, linha.tipo, t.category);
          linha.categoria_id = cat; if (regra?.tags?.length) linha.tags = regra.tags;
        }
        if (pendente) linha.pago = false;
        // conciliação: lançamento previsto (ex.: conta fixa) na mesma conta, mesmo valor, até 5 dias de diferença
        const parFatura = linha.tipo === 'pagamento_fatura' ? existentes.find(l => !usados.has(l.id) && l.tipo === 'pagamento_fatura' && !l.pago
          && l.cartao_id === linha.cartao_id && (l.fatura_mes || '').slice(0, 7) === linha.fatura_mes.slice(0, 7) && !String(l.ext_id || '').startsWith('pluggy:')) : null;
        if (parFatura) {
          usados.add(parFatura.id);
          atualizar.push([parFatura.id, { ext_id: ext, pago: true, conciliado: true, data, valor, conta_id: v.conta_id }]);
          exec.conciliados++; continue;
        }
        const par = existentes
          .filter(l => !usados.has(l.id) && l.conta_id === v.conta_id && Boolean(l.cartao_id) === (linha.tipo === 'pagamento_fatura') && l.tipo === linha.tipo
            && Math.abs(Number(l.valor) - valor) < 0.005 && Math.abs(difDias(l.data, data)) <= 5 && !String(l.ext_id || '').startsWith('pluggy:'))
          .sort((a, b) => (a.pago === b.pago ? 0 : a.pago ? 1 : -1) || Math.abs(difDias(a.data, data)) - Math.abs(difDias(b.data, data)))[0];
        if (par) {
          usados.add(par.id);
          atualizar.push([par.id, { ext_id: ext, pago: !pendente, conciliado: !pendente, data, observacao: par.observacao || 'Open Finance' }]);
          exec.conciliados++; continue;
        }
        novos.push(linha); comExt.add(ext);
      }
      // compras "em aberto" que sumiram da Pluggy (canceladas ou confirmadas com outro id já tratadas acima)
      if (cartao) for (const l of existentes) {
        if (l.cartao_id === cartao.id && l.observacao === EM_ABERTO && String(l.ext_id || '').startsWith('pluggy:')
          && !idsAgora.has(l.ext_id) && !usados.has(l.id) && l.data >= iniConta) remover.push(l.id);
      }
      await admin.from('pluggy_contas').update({ atualizado_em: new Date().toISOString() }).eq('id', v.id);
    }
    if (body.simular) {
      const nomeDe = (l: any) => l.cartao_id ? 'cartao' : 'conta';
      return json({ simulacao: true,
        novos: novos.map(l => [l.data, l.tipo, nomeDe(l), l.valor, l.descricao.slice(0, 30), l.fatura_mes || '', l.categoria_id ? 1 : 0]),
        conciliados: atualizar.map(([id, u]) => { const l = existentes.find(x => x.id === id); return [l?.data, l?.tipo, l?.valor, String(l?.descricao || '').slice(0, 30), u.data || '', u.valor ?? '']; }),
        ignorados: exec.ignorados, remover: remover.length });
    }
    for (let i = 0; i < novos.length; i += 400) { const { error } = await admin.from('lancamentos').insert(novos.slice(i, i + 400)); if (error) throw error; }
    for (const [id, upd] of atualizar) { const { error } = await admin.from('lancamentos').update(upd).eq('id', id).eq('user_id', userId); if (error) throw error; }
    for (const id of remover) { const { error } = await admin.from('lancamentos').delete().eq('id', id).eq('user_id', userId); if (error) throw error; }
    exec.novos = novos.length;
  } catch (e) {
    exec.erro = String((e as Error)?.message || e).slice(0, 500);
  }
  await admin.from('pluggy_execucoes').insert({ user_id: exec.user_id, origem: exec.origem, novos: exec.novos, conciliados: exec.conciliados, ignorados: exec.ignorados, erro: exec.erro, fim: new Date().toISOString() });
  return json(exec, exec.erro ? 500 : 200);
});
