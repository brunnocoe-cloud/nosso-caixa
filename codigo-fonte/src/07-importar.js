/* =====================================================================
   IMPORTAR LANÇAMENTOS (OFX / CSV)
   ===================================================================== */
S.imp = { destino: '', inverter: false, fatura: 'auto', arquivo: '', linhas: null, csv: null };
function parseDataBR(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${p2(m[2])}-${p2(m[1])}`; }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function lerTexto(buf) {
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t;
}
function parseOFX(t) {
  const out = [];
  const blocos = t.split(/<STMTTRN>/i).slice(1);
  const tag = (b, n) => { const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
  for (const b of blocos) {
    const data = parseDataBR(tag(b, 'DTPOSTED'));
    const valor = parseFloat(tag(b, 'TRNAMT').replace(',', '.'));
    const desc = (tag(b, 'MEMO') || tag(b, 'NAME') || 'Lançamento').replace(/\s+/g, ' ');
    if (data && isFinite(valor)) out.push({ data, desc, valor: r2(valor), ext: tag(b, 'FITID') || null });
  }
  return out;
}
function parseCSVTexto(t) {
  const linha1 = t.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = [';', '\t', ','].map(s => [s, linha1.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x.trim())) rows.push(row.map(x => x.trim())); row = []; cur = ''; }
    else cur += ch;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row.map(x => x.trim()));
  return rows;
}
function detectarColunas(rows) {
  const n = Math.max(...rows.map(r => r.length));
  const amostra = rows.slice(0, 40);
  const score = f => [...Array(n)].map((_, c) => amostra.filter(r => f(r[c] || '')).length);
  const sData = score(x => !!parseDataBR(x)), sVal = score(x => /^-?\s*(R\$)?\s*-?[\d.]+(,\d{1,2})?$|^-?[\d]+(\.\d{1,2})?$/.test(x.replace(/\s/g, '')) && !parseDataBR(x)), sTxt = score(x => /[a-zA-Zà-ú]{3,}/.test(x));
  const best = arr => arr.indexOf(Math.max(...arr));
  const data = best(sData), valor = best(sVal.map((s, i) => i === data ? -1 : s)), desc = best(sTxt.map((s, i) => i === data || i === valor ? -1 : s));
  const header = !parseDataBR(rows[0][data] || '');
  return { data, valor, desc, header, n };
}
function linhasDoCSV() {
  const { rows, map } = S.imp.csv;
  return rows.slice(map.header ? 1 : 0).map(r => ({ data: parseDataBR(r[map.data]), desc: (r[map.desc] || '').replace(/\s+/g, ' ') || 'Lançamento', valor: parseValor(r[map.valor]), ext: null }))
    .filter(x => x.data && isFinite(x.valor) && x.valor !== 0);
}
function prepararLinhas(brutas) {
  const [k, id] = S.imp.destino.split(':');
  const existentes = S.lancamentos.filter(l => k === 'cartao' ? l.cartao_id === id : (l.conta_id === id && !l.cartao_id));
  const chave = (d, v, ds) => `${d}|${r2(Math.abs(v))}|${semAcento(ds)}`;
  const jaTem = new Set(existentes.map(l => chave(l.data, l.valor, l.descricao)));
  const exts = new Set(existentes.map(l => l.ext_id).filter(Boolean));
  S.imp.linhas = brutas.map(b => {
    let valor = S.imp.inverter ? -b.valor : b.valor;
    const tipo = valor < 0 ? 'despesa' : 'receita';
    const regra = regraPara(b.desc, tipo);
    const ant = [...S.lancamentos].reverse().find(l => l.tipo === tipo && semAcento(l.descricao) === semAcento(b.desc) && l.categoria_id);
    const dup = (b.ext && exts.has(b.ext)) || jaTem.has(chave(b.data, valor, b.desc));
    const pagto = k === 'cartao' && tipo === 'receita' && /pagamento|pgto|pag\b/i.test(b.desc);
    return { ...b, valor, tipo, cat: regra?.categoria_id || ant?.categoria_id || '', tags: regra?.tags || [], titular: regra?.titular || '', dup, sel: !dup && !pagto, obs: pagto ? 'Pagamento de fatura (desmarcado: registre pelo botão "Lançar pagamento")' : '' };
  });
}
function vImportar() {
  const I = S.imp;
  const destinos = `<option value="">Escolha…</option><optgroup label="Contas">${contasAtivas().map(c => `<option value="conta:${c.id}" ${I.destino === 'conta:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>
    ${recurso('cartoes') ? `<optgroup label="Cartões de crédito">${cartoesAtivos().map(c => `<option value="cartao:${c.id}" ${I.destino === 'cartao:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>` : ''}`;
  const ehCartao = I.destino.startsWith('cartao:');
  const cartao = ehCartao ? byId('cartoes', I.destino.slice(7)) : null;
  let preview = '';
  if (I.csv) {
    const m = I.csv.map, opts = sel => [...Array(m.n)].map((_, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>Coluna ${i + 1}${m.header ? ': ' + esc(I.csv.rows[0][i] || '') : ''}</option>`).join('');
    preview += `<div class="fr" style="margin-top:6px"><div class="f"><label>Coluna da data</label><select data-imp="map.data">${opts(m.data)}</select></div><div class="f"><label>Coluna da descrição</label><select data-imp="map.desc">${opts(m.desc)}</select></div><div class="f"><label>Coluna do valor</label><select data-imp="map.valor">${opts(m.valor)}</select></div></div>
      <label class="inline"><input type="checkbox" data-imp="map.header" ${m.header ? 'checked' : ''}>Primeira linha é cabeçalho</label>`;
  }
  if (I.linhas) {
    const sel = I.linhas.filter(x => x.sel);
    preview += `<div class="tb" style="position:static;padding:10px 0;border:0"><b>${I.linhas.length} lançamento(s) no arquivo</b><span class="muted">· ${sel.length} selecionado(s) · ${I.linhas.filter(x => x.dup).length} já existente(s)</span><span class="sp"></span>
        <label class="inline" style="margin:0"><input type="checkbox" data-imp="inverter" ${I.inverter ? 'checked' : ''}>Inverter sinais</label></div>
      <div class="prev-t"><table><tr><th><input type="checkbox" data-imp="todos" ${sel.length === I.linhas.length ? 'checked' : ''}></th><th>Data</th><th>Descrição</th><th style="text-align:right">Valor</th><th>Categoria</th><th>Situação</th></tr>
      ${I.linhas.map((x, i) => `<tr class="${x.dup ? 'dup' : ''}"><td><input type="checkbox" data-imp-sel="${i}" ${x.sel ? 'checked' : ''}></td><td class="num">${dataBR(x.data)}</td><td>${esc(x.desc)}${x.obs ? `<div class="muted" style="font-size:11px">${esc(x.obs)}</div>` : ''}</td>
        <td class="num ${corV(x.valor)}" style="text-align:right">${fmtN(x.valor)}</td><td><select data-imp-cat="${i}">${optsCategoria(x.tipo, x.cat)}</select></td><td>${x.dup ? '<span class="chip">Já existe</span>' : '<span class="chip" style="color:var(--pos)">Novo</span>'}</td></tr>`).join('')}</table></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn" data-act="impLimpar">Cancelar</button><button class="btn pri" data-act="impConfirmar" ${sel.length ? '' : 'disabled'}>Importar ${sel.length} lançamento(s)</button></div>`;
  }
  return blocoMD() + `<div class="card" style="max-width:1000px;margin:0 auto"><div class="card-b" style="padding-top:16px">
    <p class="muted" style="margin-top:0">Importe o extrato do banco ou a fatura do cartão em <b>OFX</b> (recomendado; o banco oferece em "exportar extrato") ou <b>CSV</b>. Os lançamentos repetidos são detectados e as regras de preenchimento sugerem a categoria.</p>
    <div class="fr"><div class="f"><label class="req">Importar para</label><select data-imp="destino">${destinos}</select></div>
      ${ehCartao ? `<div class="f"><label>Fatura</label><select data-imp="fatura"><option value="auto">Calcular pela data da compra</option>${[-1, 0, 1, 2].map(i => { const fy = addMeses(faturaYM(cartao, hoje()), i); return `<option value="${fy}" ${I.fatura === fy ? 'selected' : ''}>Fatura de ${nomeMes(fy)}</option>`; }).join('')}</select></div>` : '<div></div>'}
      <div class="f"><label class="req">Arquivo (.ofx ou .csv)</label><input type="file" accept=".ofx,.qfx,.csv,.txt" data-act="impArquivo" ${I.destino ? '' : 'disabled'}></div></div>
    ${I.arquivo ? `<div class="hint">Arquivo: <b>${esc(I.arquivo)}</b></div>` : ''}
    ${preview}</div></div>`;
}
async function lerArquivoImport(file) {
  const t = lerTexto(await file.arrayBuffer());
  S.imp.arquivo = file.name; S.imp.csv = null;
  if (/<OFX>|OFXHEADER|<STMTTRN>/i.test(t)) {
    const ls = parseOFX(t);
    if (!ls.length) return toast('Nenhum lançamento encontrado no OFX.', true);
    S.imp.brutas = ls; prepararLinhas(ls);
  } else {
    const rows = parseCSVTexto(t);
    if (rows.length < 1) return toast('Arquivo vazio ou em formato desconhecido.', true);
    S.imp.csv = { rows, map: detectarColunas(rows) };
    S.imp.brutas = linhasDoCSV(); prepararLinhas(S.imp.brutas);
  }
  render();
}
async function confirmarImport() {
  const I = S.imp, [k, id] = I.destino.split(':');
  const cartao = k === 'cartao' ? byId('cartoes', id) : null;
  const sel = I.linhas.filter(x => x.sel);
  const bloq = sel.find(x => bloqueado({ data: x.data, conta_id: k === 'conta' ? id : null, cartao_id: cartao?.id }));
  if (bloq) return toast(`Há lançamentos em período fechado (${dataBR(bloq.data)}). Reabra a posição ou desmarque-os.`, true);
  const quem = lsGet('nc_quem') || null;
  const linhas = sel.map(x => ({
    tipo: x.tipo, descricao: x.desc.slice(0, 120), valor: Math.abs(x.valor), data: x.data, pago: true, categoria_id: x.cat || null,
    conta_id: k === 'conta' ? id : null, cartao_id: cartao?.id || null, fatura_mes: cartao ? (I.fatura !== 'auto' ? I.fatura : faturaYM(cartao, x.data)) + '-01' : null,
    tags: x.tags || [], criado_por: x.titular || (cartao ? quem : null), ext_id: x.ext, observacao: 'Importado de ' + I.arquivo,
  }));
  await inserirMuitos('lancamentos', linhas, `${linhas.length} lançamento(s) importado(s)`);
  S.imp = { destino: I.destino, inverter: false, fatura: 'auto', arquivo: '', linhas: null, csv: null };
  await recarregarERender(['lancamentos']);
}

/* =====================================================================
   IMPORTAR TUDO DO MEU DINHEIRO
   Os dados chegam da aba do Meu Dinheiro (mensagem entre janelas) e só são
   gravados quando o usuário confirma.
   ===================================================================== */
const MD_ORIGEM = 'https://app.meudinheiroweb.com.br';
S.md = null;
window.addEventListener('message', e => {
  if (e.origin !== MD_ORIGEM || !e.data || e.data.tipo !== 'md-dados') return;
  const p = e.data.payload;
  if (!p || !Array.isArray(p.lancamentos) || !Array.isArray(p.contas)) return;
  S.md = { p, fase: 'pronto', msg: '' };
  if ($('#view')) irPara('importar');
  e.source?.postMessage({ tipo: 'nc-recebido', n: p.lancamentos.length }, MD_ORIGEM);
});
function avisarMeuDinheiro() {
  if (window.opener && /[?&]md=1/.test(location.search)) { try { window.opener.postMessage({ tipo: 'nc-pronto' }, MD_ORIGEM); } catch {} }
}
function blocoMD() {
  const M = S.md; if (!M) return '';
  const p = M.p, L = p.lancamentos;
  const datas = L.map(l => l.d).sort();
  const n = t => L.filter(l => l.t === t).length;
  return `<div class="card" style="max-width:1000px;margin:0 auto 16px;border:2px solid var(--accent)"><div class="card-b" style="padding-top:16px">
    <h3 style="margin:0 0 8px;font-weight:500">Dados recebidos do Meu Dinheiro</h3>
    ${M.fase === 'pronto' ? `<div class="kv"><span>Contas</span><b>${p.contas.filter(c => !c.cartao).length}</b></div><div class="kv"><span>Cartões de crédito</span><b>${p.contas.filter(c => c.cartao).length}</b></div>
      <div class="kv"><span>Categorias</span><b>${p.categorias.length}</b></div>
      <div class="kv"><span>Lançamentos</span><b>${L.length.toLocaleString('pt-BR')}</b></div>
      <div class="kv ind"><span>Receitas / Despesas / Transferências / Pagamentos de cartão</span><span>${n('r')} / ${n('d')} / ${n('t')} / ${n('p')}</span></div>
      <div class="kv ind"><span>Período</span><span>${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}</span></div>
      <div class="kv"><span>Regras de preenchimento / Metas de economia</span><b>${(p.regras || []).length} / ${(p.metas || []).length}</b></div>
      <p class="muted" style="font-size:13px">Nada do que já existe no Nosso Caixa é apagado. Se importar de novo, os lançamentos já trazidos são ignorados (não duplicam).</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="mdCancelar">Cancelar</button><button class="btn pri" data-act="mdImportar">Importar tudo</button></div>`
    : `<p style="font-size:15px">${esc(M.msg)}</p>${M.fase === 'fim' ? `<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn pri" data-act="mdFechar">Ver visão geral</button></div>` : ''}`}
  </div></div>`;
}
async function importarMD() {
  const M = S.md, p = M.p;
  const passo = msg => { M.fase = 'rodando'; M.msg = msg; if (S.view === 'importar') render(); };
  const norm = s => semAcento(s).replace(/\s+/g, ' ');
  // 1) contas e cartões
  passo('Criando contas e cartões…');
  const mapConta = {}, mapCartao = {};
  const TIPO = { 'CONTA CORRENTE': 'corrente', 'POUPANCA': 'poupanca', 'POUPANÇA': 'poupanca', 'INVESTIMENTO': 'ativos', 'DINHEIRO': 'carteira', 'CARTEIRA': 'carteira', 'OUTROS': 'outra' };
  const usados = new Set();
  for (const c of p.contas.filter(c => !c.cartao)) {
    let ex = S.contas.find(x => norm(x.nome) === norm(c.nome) && !usados.has(x.id));
    if (!ex) {
      const [novo] = await op(sb.from('contas').insert({ nome: c.nome, tipo: TIPO[c.tipo] || 'outra', saldo_inicial: c.saldoInicial || 0, arquivada: !c.ativo, considerar_saldo: c.bp !== false, cor: PALETA[Object.keys(mapConta).length % PALETA.length] }).select());
      ex = novo;
    }
    usados.add(ex.id); mapConta[c.id] = ex.id;
  }
  for (const c of p.contas.filter(c => c.cartao)) {
    const nomes = p.contas.filter(x => x.cartao && norm(x.nome) === norm(c.nome));
    const nome = nomes.length > 1 && nomes.indexOf(c) > 0 ? `${c.nome} (${nomes.indexOf(c) + 1})` : c.nome;
    let ex = S.cartoes.find(x => norm(x.nome) === norm(nome) && !usados.has(x.id));
    const dados = { nome, limite: c.limite || 0, dia_fechamento: c.fech || 1, dia_vencimento: c.venc || 10, conta_id: mapConta[c.contaPgto] || null, titulares: c.titulares || [], arquivado: !c.ativo };
    if (ex) await op(sb.from('cartoes').update({ ...dados, nome: ex.nome }).eq('id', ex.id));
    else { const [novo] = await op(sb.from('cartoes').insert({ ...dados, cor: PALETA[(Object.keys(mapCartao).length + 5) % PALETA.length] }).select()); ex = novo; }
    usados.add(ex.id); mapCartao[c.id] = ex.id;
  }
  // 2) categorias (casando pelo nome; cria as que faltarem)
  passo('Conferindo categorias…');
  S.categorias = await fetchAll('categorias');
  const mapCat = {};
  const acha = (tipo, nome, paiId) => S.categorias.find(x => x.tipo === tipo && norm(x.nome) === norm(nome) && (x.parent_id || null) === (paiId || null));
  const mdPais = p.categorias.filter(c => !c.pai), mdSubs = p.categorias.filter(c => c.pai);
  for (const c of mdPais) {
    let ex = acha(c.tipo, c.nome, null);
    if (!ex) { const [n] = await op(sb.from('categorias').insert({ nome: c.nome, tipo: c.tipo, ativa: c.ativa, cor: PALETA[S.categorias.length % PALETA.length] }).select()); S.categorias.push(n); ex = n; }
    mapCat[c.id] = ex.id;
  }
  for (const c of mdSubs) {
    const pai = mapCat[c.pai]; if (!pai) continue;
    let ex = acha(c.tipo, c.nome, pai);
    if (!ex) { const [n] = await op(sb.from('categorias').insert({ nome: c.nome, tipo: c.tipo, parent_id: pai, ativa: c.ativa, cor: catById(pai)?.cor || '#888' }).select()); S.categorias.push(n); ex = n; }
    mapCat[c.id] = ex.id;
  }
  // 3) lançamentos
  passo('Preparando lançamentos…');
  const jaTem = new Set(S.lancamentos.map(l => l.ext_id).filter(Boolean));
  const grupos = {}, ymAtual = ymHoje();
  // séries fixas: só continuam "vivas" se tiverem ocorrência a partir do mês atual
  const fixasVivas = new Set(p.lancamentos.filter(l => l.pa === 'fixa' && l.g && l.d.slice(0, 7) >= ymAtual).map(l => l.g));
  const linhas = [];
  for (const l of p.lancamentos) {
    const ext = 'md:' + l.i;
    if (jaTem.has(ext)) continue;
    const r = { descricao: (l.ds || 'Lançamento').slice(0, 120), valor: r2(Math.abs(l.v)), data: l.d, pago: !!l.pg, conciliado: !!l.cc, observacao: l.o || null, criado_por: l.tit || null, ext_id: ext,
      categoria_id: mapCat[l.cat] || null, conta_id: null, conta_destino_id: null, cartao_id: null, fatura_mes: null, tags: [] };
    if (!(r.valor > 0)) continue;
    if (l.k) {
      r.cartao_id = mapCartao[l.k]; if (!r.cartao_id) continue;
      r.fatura_mes = (l.f || faturaYMcalc(byId('cartoes', r.cartao_id) || { dia_fechamento: 1, dia_vencimento: 10 }, l.d)) + '-01';
      if (l.t === 'p') { r.tipo = 'pagamento_fatura'; r.conta_id = mapConta[l.c] || null; r.categoria_id = null; if (!r.conta_id) continue; }
      else { r.tipo = l.t === 'r' ? 'receita' : 'despesa'; r.pago = true; }
    } else if (l.t === 't') {
      r.tipo = 'transferencia'; r.conta_id = mapConta[l.c]; r.conta_destino_id = mapConta[l.cd]; r.categoria_id = null;
      if (!r.conta_id || !r.conta_destino_id || r.conta_id === r.conta_destino_id) continue;
    } else {
      r.tipo = l.t === 'r' ? 'receita' : 'despesa'; r.conta_id = mapConta[l.c]; if (!r.conta_id) continue;
    }
    if (l.g && l.pa) {
      grupos[l.g] = grupos[l.g] || uuid(); r.grupo_id = grupos[l.g];
      if (l.pa === 'fixa') r.serie = fixasVivas.has(l.g) ? 'fixa' : 'fixa_fim';
      else { const m = String(l.pa).match(/^(\d+)\/(\d+)$/); if (m) { r.serie = 'parcelada'; r.parcela = +m[1]; r.total_parcelas = +m[2]; } }
    }
    linhas.push(r);
  }
  for (let i = 0; i < linhas.length; i += 500) {
    passo(`Gravando lançamentos… ${Math.min(i + 500, linhas.length).toLocaleString('pt-BR')} de ${linhas.length.toLocaleString('pt-BR')}`);
    await op(sb.from('lancamentos').insert(linhas.slice(i, i + 500)));
  }
  // 4) regras e metas
  passo('Importando regras e metas…');
  for (const g of p.regras || []) {
    if (S.regras.some(x => norm(x.descricao) === norm(g.descricao) && x.tipo === g.tipo)) continue;
    await op(sb.from('regras').insert({ tipo: g.tipo, descricao: g.descricao, palavras: g.palavras || null, conta_id: mapConta[g.conta] || null, cartao_id: mapCartao[g.conta] || null, titular: g.titular || null, categoria_id: mapCat[g.cat] || null }));
  }
  for (const m of p.metas || []) {
    if (S.metas.some(x => norm(x.nome) === norm(m.nome))) continue;
    await op(sb.from('metas').insert({ nome: m.nome, valor_alvo: m.valor || 1, data_alvo: m.data || null, conta_id: mapConta[m.conta] || null }));
  }
  if (!S.prefs.faturas_base || S.prefs.faturas_base < ymHoje()) { S.prefs.faturas_base = ymHoje(); await salvarPrefs(); }
  await carregar();
  _fatCache = new Map();
  M.fase = 'fim';
  M.msg = `Pronto! ${linhas.length.toLocaleString('pt-BR')} lançamentos importados${p.lancamentos.length - linhas.length ? ` (${(p.lancamentos.length - linhas.length).toLocaleString('pt-BR')} já existiam ou foram ignorados)` : ''}.`;
  render();
  try { window.opener?.postMessage({ tipo: 'nc-importado', n: linhas.length }, MD_ORIGEM); } catch {}
}
