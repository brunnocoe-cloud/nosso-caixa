/* =====================================================================
   LIMPEZA DAS CATEGORIAS (Raio-x) · prévia e aplicação
   As regras (nomes de lojas e pessoas) ficam em preferencias.dados.limpeza_regras, no banco.
   Prévia: troca as categorias só na memória deste aparelho, sem gravar nada (site fica só para leitura).
   Aplicar: grava de verdade, guardando a categoria antiga de cada lançamento para desfazer.
   ===================================================================== */
// As regras com nomes de lojas e de pessoas ficam nas preferências do banco (privado), não no código público.
const limpRegrasCfg = () => S.prefs?.limpeza_regras || {};
const limpRG = () => (limpRegrasCfg().rg || []).map(([p, c, loja]) => [new RegExp(p, 'i'), c, loja]);
const LIMPEZA_DESDE = '2026-01-01';
// categorias-mãe que a limpeza revê; as que têm nome de pessoa vêm do banco (limpeza_regras.escopo, com o destino em limpeza_regras.destino)
const LIMPEZA_ESCOPO_BASE = ['outras despesas', 'pessoais', 'familiares diversas', 'empregados'];
const limpEscopo = () => [...LIMPEZA_ESCOPO_BASE, ...Object.keys(limpRegrasCfg().destino || {}).map(semAcento)];
const LIMPEZA_SUPER = /^(sup\.?\s*bh|supermercado\s*bh|supermercado|super\s*nosso|supernosso)(\s+em casa)?$/i;
// regras automáticas criadas ao aplicar: limpRegrasCfg().automaticas = [descrição, palavras, categoria]
const PREVIA = { on: false, mudancas: 0 };
const limpNorm = s => (s || '').replace(/ - DOCTO.*$/i, '').replace(/\s\d{2}\/\d{2}(\/\d{2,4})?/g, '').replace(/\s+/g, ' ').trim();
const limpCat = id => S.categorias.find(c => c.id === id);
const limpRaiz = id => { let c = limpCat(id); while (c && c.parent_id) c = limpCat(c.parent_id); return c; };
function limpSugestao(catAtual, desc) {
  const partes = desc.split(/\s[-\/]\s/).map(s => s.trim()).filter(Boolean);
  const achados = [...partes, desc].map(t => limpRG().find(x => x[0].test(t))).filter(Boolean);
  const a = achados.find(x => !x[2]) || achados[0];
  if (a) return a[1];
  if (catAtual === 'empregados') return 'Empregados';
  if (catAtual === 'familiares diversas') return 'Familiares Diversas';
  const dest = Object.entries(limpRegrasCfg().destino || {}).find(([k]) => semAcento(k) === catAtual); if (dest) return dest[1];
  return 'Outras despesas';
}
// plano: [{ l, de (nome atual), para (nome novo) }] para as despesas de 2026 em diante
function limpezaPlano() {
  const plano = [], fechados = [];
  for (const l of S.lancamentos) {
    if (l.tipo !== 'despesa' || l.data < LIMPEZA_DESDE) continue;
    const c = limpCat(l.categoria_id), r = limpRaiz(l.categoria_id);
    const raiz = semAcento(r?.nome || ''), desc = limpNorm(l.descricao);
    let para = null;
    if (!l.categoria_id || limpEscopo().includes(raiz)) para = limpSugestao(raiz, desc);
    else if (LIMPEZA_SUPER.test(desc)) para = 'Supermercado';
    if (!para || para === 'Fora do Raio-x') continue;
    // já está na categoria-mãe certa (sem ser subcategoria de pessoa): não muda
    const ehPessoa = c && c.parent_id && raiz === 'pessoais';
    if (!ehPessoa && c && semAcento(r.nome) === semAcento(para) ) continue;
    if (bloqueado(l)) { fechados.push(l); continue; }
    plano.push({ l, de: c ? (c.parent_id ? `${r.nome} / ${c.nome}` : c.nome) : 'Sem categoria', para });
  }
  return { plano, fechados };
}
const limpAlvo = nome => S.categorias.find(c => c.tipo === 'despesa' && !c.parent_id && semAcento(c.nome) === semAcento(nome));

/* ---------- prévia (nada é gravado) ---------- */
function previaAplicar() {
  if (!PREVIA.on) return;
  const { plano } = limpezaPlano();
  for (const p of plano) {
    let alvo = limpAlvo(p.para);
    if (!alvo) { alvo = { id: 'previa:' + p.para, nome: p.para, tipo: 'despesa', cor: '#7b61ff', parent_id: null, ativa: true, _previa: true }; S.categorias.push(alvo); }
    p.l._catAntes = p.l.categoria_id; p.l.categoria_id = alvo.id;
  }
  for (const c of S.categorias) if (c.parent_id && semAcento(limpCat(c.parent_id)?.nome) === 'pessoais' && (limpRegrasCfg().pessoas || []).some(n => semAcento(n) === semAcento(c.nome))) c.ativa = false;
  PREVIA.mudancas = plano.length; _fatCache = new Map();
}
function previaFaixa() {
  let el = document.getElementById('previaFaixa');
  if (!PREVIA.on) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'previaFaixa'; el.style.cssText = 'position:sticky;top:0;z-index:60;background:#7b61ff;color:#fff;padding:8px 14px;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap'; document.getElementById('view')?.before(el); }
  el.innerHTML = `<b>Prévia das categorias novas</b><span>${PREVIA.mudancas} lançamentos mostrados com a categoria nova. Nada foi gravado, e só este aparelho vê. O site fica só para leitura.</span>
    <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" style="background:#fff;color:#4b35c4" data-act="previaLista">Ver as mudanças</button><button class="btn sm" style="background:#fff;color:#4b35c4" data-act="previaSair">Sair da prévia</button><button class="btn sm" style="background:#1b1340;color:#fff" data-act="limpezaAplicar">Tornar definitivo</button></span>`;
}
async function previaLigar(on) {
  PREVIA.on = on;
  await carregar(); render();
}
// toda recarga dos dados reaplica a prévia; qualquer gravação é recusada enquanto ela estiver ligada
{
  const carregarOriginal = carregar;
  carregar = async function (...a) { await carregarOriginal(...a); previaAplicar(); };
  const renderOriginal = render;
  render = function (...a) { renderOriginal(...a); previaFaixa(); };
}
function previaProteger() {
  if (!sb || sb._previaOk) return; sb._previaOk = true;
  const from = sb.from.bind(sb);
  sb.from = t => {
    const q = from(t);
    if (PREVIA.on && !PREVIA.liberado) for (const m of ['insert', 'update', 'delete', 'upsert']) q[m] = () => { toast('Prévia ligada: saia da prévia para alterar.', true); throw new Error('Prévia ligada: o site está só para leitura.'); };
    return q;
  };
}

/* ---------- aplicar de verdade e desfazer ---------- */
const limpPrefs = () => gravarPrefs();
async function limpezaGravar() {
  previaProteger(); PREVIA.liberado = true;
  try {
    PREVIA.on = false;
    await carregar();
    const { plano, fechados } = limpezaPlano();
    // 1) foto de antes, gravada primeiro: é o que permite desfazer
    const antes = {}; for (const p of plano) antes[p.l.id] = p.l.categoria_id || null;
    const novas = [...new Set(plano.map(p => p.para))].filter(n => !limpAlvo(n));
    const pessoas = S.categorias.filter(c => c.parent_id && semAcento(limpCat(c.parent_id)?.nome) === 'pessoais' && c.ativa !== false && (limpRegrasCfg().pessoas || []).some(n => semAcento(n) === semAcento(c.nome)));
    S.prefs.limpeza_2026 = { em: new Date().toISOString(), antes, categorias_criadas: [], regras_criadas: [], inativadas: pessoas.map(c => c.id) };
    await limpPrefs();
    // 2) categorias novas
    for (const nome of novas) {
      const { data, error } = await sb.from('categorias').insert({ nome, tipo: 'despesa', cor: '#7b61ff' }).select('id');
      if (error) throw error; S.prefs.limpeza_2026.categorias_criadas.push(data[0].id);
    }
    await limpPrefs(); await carregar(['categorias']);
    // 3) lançamentos, em lotes por categoria nova
    const porAlvo = new Map();
    for (const p of plano) { const id = limpAlvo(p.para).id; if (!porAlvo.has(id)) porAlvo.set(id, []); porAlvo.get(id).push(p.l.id); }
    for (const [cat, ids] of porAlvo) for (let i = 0; i < ids.length; i += 150) {
      const { error } = await sb.from('lancamentos').update({ categoria_id: cat }).in('id', ids.slice(i, i + 150));
      if (error) throw error;
    }
    // 4) regras automáticas (só as que ainda não existem)
    for (const [descricao, palavras, catNome] of (limpRegrasCfg().automaticas || [])) {
      if (S.regras.some(r => semAcento(r.descricao) === semAcento(descricao)) || !limpAlvo(catNome)) continue;
      const { data, error } = await sb.from('regras').insert({ tipo: 'despesa', descricao, palavras, categoria_id: limpAlvo(catNome).id }).select('id');
      if (error) throw error; S.prefs.limpeza_2026.regras_criadas.push(data[0].id);
    }
    // 5) subcategorias de pessoas saem das listas (continuam nos lançamentos antigos)
    if (pessoas.length) { const { error } = await sb.from('categorias').update({ ativa: false }).in('id', pessoas.map(c => c.id)); if (error) throw error; }
    await limpPrefs();
    await carregar(); render();
    return { mudados: plano.length, novas, fechados: fechados.length };
  } finally { PREVIA.liberado = false; }
}
async function limpezaDesfazerGravar() {
  const reg = S.prefs.limpeza_2026; if (!reg) return null;
  const porCat = new Map();
  for (const [id, cat] of Object.entries(reg.antes || {})) { const k = cat || ''; if (!porCat.has(k)) porCat.set(k, []); porCat.get(k).push(id); }
  for (const [cat, ids] of porCat) for (let i = 0; i < ids.length; i += 150) {
    const { error } = await sb.from('lancamentos').update({ categoria_id: cat || null }).in('id', ids.slice(i, i + 150));
    if (error) throw error;
  }
  if (reg.inativadas?.length) { const { error } = await sb.from('categorias').update({ ativa: true }).in('id', reg.inativadas); if (error) throw error; }
  if (reg.regras_criadas?.length) { const { error } = await sb.from('regras').delete().in('id', reg.regras_criadas); if (error) throw error; }
  await carregar(['lancamentos']);
  // categoria criada pela limpeza só é apagada se ninguém mais a usa (lançamento novo, orçamento)
  for (const id of reg.categorias_criadas || []) {
    if (S.lancamentos.some(l => l.categoria_id === id) || S.orcamentos.some(o => o.categoria_id === id) || S.regras.some(r => r.categoria_id === id && !(reg.regras_criadas || []).includes(r.id))) continue;
    const { error } = await sb.from('categorias').delete().eq('id', id); if (error) throw error;
  }
  const n = Object.keys(reg.antes || {}).length;
  delete S.prefs.limpeza_2026; await limpPrefs();
  await carregar(); render();
  return n;
}
function limpezaCartao() {
  const reg = S.prefs.limpeza_2026;
  return `<div class="f" style="border-top:1px solid var(--line);padding-top:14px"><label>Limpeza das categorias (Raio-x dos gastos)</label>
    ${reg ? `<p style="font-size:14px;margin:4px 0 8px">Aplicada em <b>${fmtDH(reg.em)}</b>: ${Object.keys(reg.antes || {}).length} lançamentos reclassificados.</p>
      <button class="btn out" data-act="limpezaDesfazer">Desfazer a limpeza</button>`
    : `<p class="muted" style="font-size:13px;margin:4px 0 8px">Reclassifica as despesas de 2026 que estão em Outras despesas, em categorias de pessoas ou sem categoria. A prévia mostra o resultado no site sem gravar nada.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" data-act="previaEntrar">${PREVIA.on ? 'Prévia ligada' : 'Ver prévia no site'}</button></div>`}</div>`;
}
Object.assign(ACOES, {
  previaEntrar: async () => { if (!PREVIA.on) { previaProteger(); await previaLigar(true); toast('Prévia ligada. Navegue pelo site; nada foi gravado.'); } },
  previaSair: async () => { await previaLigar(false); toast('Prévia desligada. O site voltou ao normal.'); },
  previaLista: () => {
    const g = new Map();
    for (const l of S.lancamentos) if (l._catAntes !== undefined) {
      const de = limpCat(l._catAntes), r = limpRaiz(l._catAntes), k = `${de ? (de.parent_id ? r.nome + ' / ' + de.nome : de.nome) : 'Sem categoria'} → ${limpCat(l.categoria_id)?.nome}`;
      const x = g.get(k) || [0, 0]; x[0]++; if (l.data <= hoje()) x[1] += +l.valor; g.set(k, x);
    }
    const linhas = [...g].sort((a, b) => b[1][1] - a[1][1]).map(([k, [n, v]]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td><td class="num">${fmtN(r2(v))}</td></tr>`).join('');
    escolha('Mudanças da prévia', `<div style="max-height:60vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>De → para</th><th class="num">Lanç.</th><th class="num">R$ até hoje</th></tr></thead><tbody>${linhas}</tbody></table></div>`, [{ t: 'Fechar', v: true }]);
  },
  limpezaAplicar: async () => {
    const total = PREVIA.on ? PREVIA.mudancas : limpezaPlano().plano.length;
    if (!await confirmar('Tornar a limpeza definitiva', `Vou gravar a categoria nova em <b>${total}</b> lançamentos, criar as categorias e regras novas e tirar das listas as subcategorias de pessoas.<br><br>Isso muda o Extrato, os relatórios e o resumo do Telegram, para vocês dois. Dá para voltar atrás em <b>Configurações › Geral › Desfazer a limpeza</b>.`, 'Tornar definitivo')) return;
    try { const r = await limpezaGravar(); toast(`Limpeza aplicada: ${r.mudados} lançamentos${r.fechados ? ` (${r.fechados} em período fechado ficaram de fora)` : ''}.`); }
    catch (e) { toast('A limpeza parou no meio: ' + e.message + '. Use Desfazer a limpeza em Configurações.', true); await carregarPrefs(); await carregar(); render(); }
  },
  limpezaDesfazer: async () => {
    if (!await confirmar('Desfazer a limpeza', 'Os lançamentos voltam para as categorias que tinham antes da limpeza. Correções que você fez depois, nesses mesmos lançamentos, também voltam.', 'Desfazer')) return;
    previaProteger(); PREVIA.liberado = true;
    try { const n = await limpezaDesfazerGravar(); toast(`Limpeza desfeita: ${n} lançamentos voltaram às categorias antigas.`); } catch (e) { toast(e.message, true); } finally { PREVIA.liberado = false; }
  },
});
