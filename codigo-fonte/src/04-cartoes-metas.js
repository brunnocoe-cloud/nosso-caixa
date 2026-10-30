/* =====================================================================
   CARTÕES DE CRÉDITO
   ===================================================================== */
function vCartoes(pos) {
  if (!S.cartoes.length) return vazio('Nenhum cartão de crédito cadastrado.', `<button class="btn pri" data-act="novoCartao">Cadastrar cartão</button>`);
  if (!S.cartaoSel || !byId('cartoes', S.cartaoSel)) S.cartaoSel = (cartoesAtivos()[0] || S.cartoes[0]).id;
  const c = byId('cartoes', S.cartaoSel);
  const fym = S.faturaSel[c.id] || faturaYM(c, hoje());
  const f = faturaInfo(c, fym), u = usoCartao(c);
  const F = S.cartaoFiltro;
  let itens = f.itens.filter(l => !F.conc.size || F.conc.has(l.conciliado ? 'sim' : 'nao'));
  if (F.titular) itens = itens.filter(l => (l.criado_por || '') === (F.titular === '_' ? '' : F.titular));
  itens = filtroBusca(itens);
  if (F.ordem === 'valor') itens = [...itens].sort((a, b) => num(b.valor) - num(a.valor));
  _csvAtual = { linhas: csvLanc(itens.concat(f.pagamentos)), nome: `fatura-${c.nome}-${fym}` };
  const parcFuturas = S.lancamentos.filter(l => l.cartao_id === c.id && l.serie === 'parcelada' && fatMes(l) > fym && l.tipo === 'despesa');
  const titulares = [...new Set([...(c.titulares || []), ...f.itens.map(l => l.criado_por).filter(Boolean)])];
  const porTit = new Map();
  for (const l of f.itens) { const k = l.criado_por || 'Sem titular'; porTit.set(k, (porTit.get(k) || 0) + (l.tipo === 'despesa' ? -1 : 1) * num(l.valor)); }
  const catItens = porCategoria(itens.filter(l => l.tipo === 'despesa'));
  if (F.grafico && catItens.length) pos.push(() => donut('gFatCat', catItens));
  // lista agrupada por data (como "Total em 17/11")
  let lista = '';
  if (F.ordem === 'valor') lista = itens.map(l => linhaL(l, { cartao: true })).join('');
  else {
    const grupos = new Map();
    for (const l of itens) { if (!grupos.has(l.data)) grupos.set(l.data, []); grupos.get(l.data).push(l); }
    for (const [d, ls] of grupos) lista += `<div class="dsep"><span>Total em ${dataBR(d).slice(0, 5)}</span>${vH(-soma(ls, l => l.tipo === 'despesa' ? l.valor : -l.valor))}</div>` + ls.map(l => linhaL(l, { cartao: true, semData: true })).join('');
  }
  if (f.pagamentos.length && !F.conc.size && !F.titular && !S.busca) lista += `<div class="dsep"><span>Pagamentos</span>${vH(f.pago)}</div>` + f.pagamentos.map(l => linhaL(l)).join('');
  return `<div class="pg"><div class="lado">
      <div class="card"><div class="sel"><span class="dot" style="background:${esc(c.cor)}"></span><select data-act="selCartao" aria-label="Cartão">${S.cartoes.filter(x => !x.arquivado || x.id === c.id).map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
        <button class="icon-btn sm" data-act="editCartao" data-id="${c.id}" title="Editar cartão">${ic('edit')}</button></div>
        <div class="mesnav"><button class="icon-btn" data-act="fatNav" data-id="${c.id}" data-ym="${addMeses(fym, -1)}">${ic('left')}</button><span class="lbl">${nomeMes(fym)}</span><button class="icon-btn" data-act="fatNav" data-id="${c.id}" data-ym="${addMeses(fym, 1)}">${ic('right')}</button>
          <button class="icon-btn sm" data-act="fatNav" data-id="${c.id}" data-ym="${faturaYM(c, hoje())}" title="Fatura atual">${ic('clock')}</button></div></div>
      <div class="card"><div class="card-b" style="padding-top:12px">
        <div class="sec-t">Fatura ${f.status === 'aberta' ? 'atual' : ''} (R$) ${chipFat(f.status)}</div>
        <div class="kv"><span>Fechamento</span><span>${dataBR(f.fechamento)}</span></div>
        <div class="kv"><span>Vencimento</span><span>${dataBR(f.vencimento)}</span></div>
        <div class="kv"><span>Saldo anterior</span>${vH(-f.saldoAnterior)}</div>
        <div class="kv"><span>Despesas do período</span>${vH(-f.despesas)}</div>
        ${f.creditos ? `<div class="kv"><span>Créditos / estornos</span>${vH(f.creditos)}</div>` : ''}
        <div class="kv"><span>Total pago</span>${vH(f.pago)}</div>
        <div class="kv tot"><span>Total</span>${vH(-(f.saldoAnterior + f.total))}</div>
        <div class="kv b"><span>Valor a pagar</span>${vH(-f.aPagar)}</div>
        <div class="acoes-l"><button class="lnk acc" data-act="fecharFatura" data-id="${c.id}" data-ym="${fym}">${f.fechadaManual ? 'Reabrir fatura' : 'Fechar fatura'}</button><button class="lnk acc" data-act="pagarFatura" data-id="${c.id}" data-ym="${fym}">Lançar pagamento</button></div>
        <div class="sec-t">Detalhamento</div>
        <div class="kv"><span>Despesas</span>${vH(-f.total)}</div>
        <div class="kv"><span>Total conciliado</span>${vH(-f.conciliado)}</div>
        <div class="kv"><span>Total não conciliado</span>${vH(-f.naoConciliado)}</div>
        <div class="kv"><span>Despesas fixas</span>${vH(-f.fixas)}</div>
        <div class="kv"><span>Parcelas futuras ${parcFuturas.length ? `<button class="lnk" data-act="antecipar" data-id="${c.id}" data-ym="${fym}">Antecipar parcelas</button>` : ''}</span>${vH(-soma(parcFuturas))}</div>
        ${porTit.size ? `<div class="sec-t">Totais por cartão (R$)</div>${[...porTit].map(([n, val]) => `<div class="kv"><span>${esc(n)}</span>${vH(r2(val))}</div>`).join('')}` : ''}
        <div class="sec-t">Limite (Total)</div>
        <div class="kv"><span>Limite da conta</span>${vH(num(c.limite), 'muted')}</div>
        <div class="kv"><span>Utilizado</span>${vH(-u.usado)}</div>
        <div class="kv tot"><span>Disponível</span>${vH(u.disponivel)}</div>
        <div class="bar" style="margin-top:8px"><i style="width:${num(c.limite) ? Math.min(100, u.usado / num(c.limite) * 100) : 0}%;background:${esc(c.cor)}"></i></div>
      </div></div></div>
    <div class="card"><div class="tb"><span class="lbl">Filtrar</span>
        <button class="fchip ${F.conc.has('nao') ? 'on' : ''}" data-act="concFiltro" data-v="nao"><i></i>Não conciliados</button>
        <button class="fchip ${F.conc.has('sim') ? 'on' : ''}" data-act="concFiltro" data-v="sim"><i></i>Conciliados</button>
        ${buscaInput()}
        ${titulares.length ? `<select data-act="titularFiltro" aria-label="Titular"><option value="">Todos os titulares</option>${titulares.map(t => `<option ${F.titular === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
        <button class="icon-btn sm ${F.grafico ? 'on' : ''}" data-act="fatGrafico" title="Gráfico por categoria">${ic('chart')}</button>
        <button class="icon-btn sm ${F.ordem === 'valor' ? 'on' : ''}" data-act="fatOrdem" title="Ordenar por ${F.ordem === 'valor' ? 'data' : 'valor'}">${ic('sort')}</button>
        <button class="icon-btn sm" data-act="novaCompra" data-id="${c.id}" title="Nova compra neste cartão">${ic('plus')}</button>${acoesLista()}</div>
      ${F.grafico && catItens.length ? `<div style="display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:12px;padding:12px;border-bottom:1px solid var(--line)"><div class="chart-box" style="height:200px"><canvas id="gFatCat"></canvas></div>
        <div class="legend-l">${catItens.map(x => `<div class="row"><span class="dot" style="background:${esc(x.cor)}"></span><span class="n">${esc(x.nome)}</span>${vH(-x.v)}</div>`).join('')}</div></div>` : ''}
      ${lista || vazio('Nenhum lançamento nesta fatura.', `<button class="btn" data-act="novaCompra" data-id="${c.id}">Lançar compra</button>`)}</div></div>`;
}

/* =====================================================================
   ORÇAMENTO (METAS DE DESPESA)
   ===================================================================== */
function linhasOrcamento(ym) {
  const ini = iniMes(ym), fim = fimMes(ym);
  const desp = despesasPer(ini, fim).concat(S.lancamentos.filter(l => l.tipo === 'receita' && l.cartao_id && noPeriodo(l, ini, fim)));
  const real = new Map();
  for (const l of desp) { const r = catRaiz(l.categoria_id); const k = r?.id || '_'; real.set(k, (real.get(k) || 0) + (l.tipo === 'despesa' ? 1 : -1) * num(l.valor)); }
  const metas = new Map(S.orcamentos.filter(o => o.mes.slice(0, 7) === ym).map(o => [catRaiz(o.categoria_id)?.id || o.categoria_id, (0) + num(o.valor)]));
  const ids = new Set([...real.keys(), ...metas.keys()]);
  return [...ids].map(id => ({ id, nome: id === '_' ? 'Sem categoria' : (catById(id)?.nome || '?'), cor: id === '_' ? '#9aa0a6' : corCat(id), meta: r2(metas.get(id) || 0), realizado: r2(real.get(id) || 0) }))
    .sort((a, b) => (b.meta ? 1 : 0) - (a.meta ? 1 : 0) || b.realizado - a.realizado);
}
function vOrcamento() {
  const ym = S.mes;
  const linhas = linhasOrcamento(ym);
  const comMeta = linhas.filter(x => x.meta), semMeta = linhas.filter(x => !x.meta && x.realizado);
  const tM = soma(comMeta, x => x.meta), tR = soma(comMeta, x => x.realizado), tOut = soma(semMeta, x => x.realizado);
  const temAnterior = S.orcamentos.some(o => o.mes.slice(0, 7) === addMeses(ym, -1));
  _csvAtual = { linhas: [['Categoria', 'Meta', 'Realizado', 'Saldo', '%'], ...linhas.map(x => [x.nome, fmtN(x.meta), fmtN(x.realizado), fmtN(x.meta - x.realizado), x.meta ? Math.round(x.realizado / x.meta * 100) + '%' : ''])], nome: 'metas-despesa-' + ym };
  return `<div class="pg"><div class="lado">${painelMes()}
      <div class="card">${cardH('Resumo do período (R$)')}<div class="card-b">
        <div class="kv"><span>Metas definidas</span>${vH(tM, 'muted')}</div><div class="kv"><span>Realizado nas categorias com meta</span>${vH(-tR)}</div>
        <div class="kv tot"><span>Saldo das metas</span>${vH(tM - tR)}</div><div class="kv"><span>Despesas sem meta</span>${vH(-tOut)}</div>
        ${tM ? `<div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, tR / tM * 100)}%;background:${tR > tM ? css('--neg') : css('--accent')}"></i></div>` : ''}
        <div class="acoes-l"><button class="lnk acc" data-act="definirMetas">Definir metas</button>${temAnterior ? `<button class="lnk acc" data-act="copiarOrc">Copiar de ${mesCurto(addMeses(ym, -1))}</button>` : ''}</div></div></div></div>
    <div class="card">${cardH(`Metas de despesa · ${nomeMes(ym)}`, acoesLista())}
      ${comMeta.length ? `<table class="t"><tr><th class="l">Categoria</th><th>Meta</th><th>Realizado</th><th>Saldo</th><th class="l hide-m" style="width:28%">Uso</th></tr>
        ${comMeta.map(x => { const pct = x.realizado / x.meta * 100; const cor = pct > 100 ? css('--neg') : pct > 85 ? css('--warn') : x.cor;
          return `<tr class="click" data-act="verCategoria" data-id="${x.id}"><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:8px"></span>${esc(x.nome)}</td><td>${vH(x.meta, 'muted')}</td><td>${vH(-x.realizado)}</td><td>${vH(x.meta - x.realizado)}</td>
            <td class="l hide-m"><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${Math.min(100, pct)}%;background:${esc(cor)}"></i></div><span class="muted num" style="font-size:12px;width:38px">${Math.round(pct)}%</span></div></td></tr>`; }).join('')}
        <tr class="tot"><td class="l">Total</td><td>${vH(tM)}</td><td>${vH(-tR)}</td><td>${vH(tM - tR)}</td><td class="hide-m"></td></tr></table>`
        : vazio('Sem metas de despesa definidas no período.<br>Escolha um período diferente ou defina uma nova meta.', `<button class="btn" data-act="definirMetas">Definir metas</button>${temAnterior ? ` <button class="btn" data-act="copiarOrc">Copiar do mês anterior</button>` : ''}`)}
      ${semMeta.length ? `<div class="sec-t" style="margin-top:16px">Despesas sem meta</div><table class="t">${semMeta.map(x => `<tr class="click" data-act="verCategoria" data-id="${x.id}"><td class="l"><span class="dot" style="background:${esc(x.cor)};margin-right:8px"></span>${esc(x.nome)}</td><td>${vH(-x.realizado)}</td></tr>`).join('')}</table>` : ''}
    </div></div>`;
}
function formMetasDespesa() {
  const ym = S.mes;
  const atuais = new Map(S.orcamentos.filter(o => o.mes.slice(0, 7) === ym).map(o => [o.categoria_id, o]));
  const pais = arvoreCategorias('despesa', true).filter(x => x.nivel === 0).map(x => x.c);
  const media = id => { let t = 0; for (let i = 1; i <= 3; i++) { const m = addMeses(ym, -i); t += linhasOrcamento(m).find(x => x.id === id)?.realizado || 0; } return r2(t / 3); };
  modal({
    titulo: `Definir metas de despesa · ${nomeMes(ym)}`, largo: true,
    corpo: `<p class="muted" style="margin-top:0">Informe o limite de gasto de cada categoria (inclui as subcategorias). Deixe vazio para não definir meta.</p>
      <table class="t"><tr><th class="l">Categoria</th><th class="hide-m">Média 3 meses</th><th>Meta (R$)</th></tr>
      ${pais.map(c => `<tr><td class="l"><span class="dot" style="background:${esc(c.cor)};margin-right:8px"></span>${esc(c.nome)}</td><td class="hide-m muted num">${fmtN(media(c.id))}</td>
        <td><input class="num" style="width:120px;text-align:right;border:0;border-bottom:1px solid var(--line);background:transparent;padding:4px" inputmode="decimal" name="m_${c.id}" value="${atuais.has(c.id) ? valorInput(atuais.get(c.id).valor) : ''}" placeholder="—"></td></tr>`).join('')}</table>
      <div class="f" style="margin-top:14px;max-width:320px"><label>Aplicar também aos meses seguintes</label><select name="rep"><option value="0">Somente ${nomeMes(ym)}</option><option value="2">Próximos 2 meses</option><option value="5">Próximos 5 meses</option><option value="11">Próximos 11 meses</option></select></div>`,
    onSubmit: async form => {
      const meses = [ym, ...[...Array(+v(form, 'rep'))].map((_, i) => addMeses(ym, i + 1))];
      const ins = [], upd = [], del = [];
      for (const c of pais) {
        const txt = v(form, 'm_' + c.id).trim(); const val = txt ? parseValor(txt) : null;
        if (txt && (isNaN(val) || val < 0)) return `Valor inválido em ${c.nome}.`;
        for (const m of meses) {
          const ex = S.orcamentos.find(o => o.categoria_id === c.id && o.mes.slice(0, 7) === m);
          if (val === null) { if (ex && m === ym) del.push(ex.id); }
          else if (ex) { if (num(ex.valor) !== val) upd.push([ex.id, val]); }
          else ins.push({ categoria_id: c.id, mes: m + '-01', valor: val });
        }
      }
      if (del.length) await excluir('orcamentos', del);
      for (const [id, val] of upd) await op(sb.from('orcamentos').update({ valor: val }).eq('id', id));
      if (ins.length) await inserirMuitos('orcamentos', ins);
      toast('Metas salvas');
      await recarregarERender(['orcamentos']);
    },
  });
}
async function copiarOrc() {
  const ym = S.mes, ant = addMeses(ym, -1);
  const existentes = new Set(S.orcamentos.filter(o => o.mes.slice(0, 7) === ym).map(o => o.categoria_id));
  const novos = S.orcamentos.filter(o => o.mes.slice(0, 7) === ant && !existentes.has(o.categoria_id)).map(o => ({ categoria_id: o.categoria_id, mes: ym + '-01', valor: o.valor }));
  if (!novos.length) return toast('Nada para copiar.');
  await inserirMuitos('orcamentos', novos, `${novos.length} meta(s) copiada(s)`);
  await recarregarERender(['orcamentos']);
}

/* =====================================================================
   METAS DE ECONOMIA
   ===================================================================== */
function statusMeta(m) {
  const atual = m.conta_id && byId('contas', m.conta_id) ? saldoConta(m.conta_id, { ate: hoje() }) : num(m.valor_atual);
  const alvo = num(m.valor_alvo), falta = r2(Math.max(0, alvo - atual));
  let meses = null;
  if (m.data_alvo) { const [y1, m1] = ymHoje().split('-').map(Number), [y2, m2] = m.data_alvo.slice(0, 7).split('-').map(Number); meses = (y2 - y1) * 12 + (m2 - m1); }
  const ideal = falta <= 0 ? 0 : meses && meses > 0 ? r2(falta / meses) : falta;
  return { atual: r2(atual), alvo, falta, meses, ideal, pct: alvo ? Math.max(0, Math.min(100, atual / alvo * 100)) : 0 };
}
function vEconomia() {
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn pri" data-act="novaMeta">${ic('plus')}Nova meta de economia</button></div>
  ${S.metas.length ? `<div class="mini-cards">${S.metas.map(m => {
    const st = statusMeta(m), conta = byId('contas', m.conta_id);
    return `<div class="card"><div class="card-h"><span class="dot" style="background:${esc(m.cor)}"></span><h3>${esc(m.nome)}</h3><div class="acts"><button class="icon-btn sm" data-act="metaMenu" data-id="${m.id}">${ic('more')}</button></div></div>
      <div class="card-b"><div style="display:flex;align-items:center;gap:14px;margin-bottom:10px"><div style="font-size:30px;font-weight:300">${Math.round(st.pct)}%</div><div class="bar" style="flex:1;height:10px"><i style="width:${st.pct}%;background:${esc(m.cor)}"></i></div></div>
        ${conta ? `<div class="kv"><span>Conta</span><span>${esc(conta.nome)}</span></div>` : ''}
        <div class="kv"><span>${conta ? 'Saldo total atualizado' : 'Valor guardado'}</span>${vH(st.atual)}</div>
        <div class="kv"><span>Objetivo</span><span class="num v">${fmtN(st.alvo)}${m.data_alvo ? ` <span class="muted">até ${nomeMes(m.data_alvo.slice(0, 7))}</span>` : ''}</span></div>
        <div class="kv"><span>A realizar</span>${vH(st.falta, st.falta ? 'warn' : 'pos')}</div>
        <div class="kv"><span>Aplicação mensal ideal</span>${vH(st.ideal, 'muted')}</div>
        ${st.meses !== null && st.meses <= 0 && st.falta > 0 ? `<div class="hint err" style="margin:6px 0 0">Prazo encerrado</div>` : ''}
        <div class="acoes-l">${conta ? `<button class="lnk" data-act="verExtrato" data-id="${conta.id}">Visualizar extrato</button>` : `<button class="lnk acc" data-act="aporte" data-id="${m.id}" data-s="1">Guardar</button><button class="lnk" data-act="aporte" data-id="${m.id}" data-s="-1">Retirar</button>`}</div></div></div>`;
  }).join('')}</div>` : `<div class="card">${vazio('Nenhuma meta de economia.<br>Crie objetivos como reserva de emergência, viagem ou troca de carro e acompanhe pelo saldo de uma conta.', `<button class="btn" data-act="novaMeta">Criar meta</button>`)}</div>`}`;
}
