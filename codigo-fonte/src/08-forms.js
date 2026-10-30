/* =====================================================================
   FORMULÁRIO DE LANÇAMENTO
   ===================================================================== */
const pessoasConhecidas = () => [...new Set([lsGet('nc_quem'), ...S.cartoes.flatMap(k => k.titulares || []), ...S.lancamentos.slice(-500).map(l => l.criado_por)].filter(Boolean))];
const TIPO_NOME = { despesa: 'despesa', receita: 'receita', transferencia: 'transferência' };
function formLanc(l = null, preset = {}) {
  if (!S.contas.length && !S.cartoes.length) { toast('Cadastre primeiro uma conta.', true); return formConta(); }
  if (l?.tipo === 'pagamento_fatura') return formPagamento(byId('cartoes', l.cartao_id), fatMes(l), l);
  const novo = !l, dup = !!preset.duplicar;
  const detalhado = novo && preset.tipo === 'detalhado';
  const tipo0 = l?.tipo || (detalhado ? 'despesa' : preset.tipo) || 'despesa';
  const onde0 = l ? (l.cartao_id ? 'cartao:' + l.cartao_id : 'conta:' + l.conta_id) : (preset.onde || lsGet('nc_ultimaOnde') || (contasAtivas()[0] ? 'conta:' + contasAtivas()[0].id : ''));
  const pago0 = l ? !!l.pago : preset.pago ?? (lsGet('nc_padrao_pago') !== '0');
  const conc0 = l ? !!l.conciliado : false;
  const descs = [...new Set([...S.regras.map(r => r.descricao), ...S.lancamentos.slice(-600).map(x => x.descricao)])].slice(0, 400);
  const optOnde = sel => `<optgroup label="Contas">${contasAtivas().concat(S.contas.filter(c => c.arquivada && 'conta:' + c.id === sel)).map(c => `<option value="conta:${c.id}" ${sel === 'conta:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`
    + (recurso('cartoes') ? `<optgroup label="Cartões de crédito" data-grp-cartao>${cartoesAtivos().concat(S.cartoes.filter(c => c.arquivado && 'cartao:' + c.id === sel)).map(c => `<option value="cartao:${c.id}" ${sel === 'cartao:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>` : '');
  const tagsHTML = recurso('tags') && S.tags.length ? `<div class="f"><label>Tags</label><div class="tagsel">${[...S.tags].sort(ordenaNome).map(t => `<label><input type="checkbox" name="tag" value="${t.id}" ${(l?.tags || preset.tags || []).includes(t.id) ? 'checked' : ''}><span class="dot" style="background:${esc(t.cor)}"></span><span>${esc(t.nome)}</span></label>`).join('')}</div></div>` : '';
  const serieInfo = l?.grupo_id ? (l.total_parcelas > 1 ? `Parcela ${l.parcela} de ${l.total_parcelas}` : (l.serie || '').startsWith('fixa') ? 'Lançamento fixo (repete todo mês)' : l.serie === 'detalhado' ? 'Parte de um lançamento detalhado' : '') : '';
  const anexos = [...(l?.anexos || [])];
  const corpo = `
    <input type="hidden" name="tipo" value="${tipo0}"><input type="hidden" name="pago" value="${pago0 ? 1 : 0}"><input type="hidden" name="conciliado" value="${conc0 ? 1 : 0}">
    <div class="fr">
      <div class="f"><label class="req" for="fValor">Valor (R$)</label><div class="valwrap"><input id="fValor" class="num" name="valor" inputmode="decimal" placeholder="0,00" value="${valorInput(l?.valor ?? preset.valor)}" ${detalhado ? 'readonly' : 'autofocus'} required>
        <button type="button" class="icon-btn sm" data-calc title="Calcular (ex.: 10,50+3*2)">${ic('calc')}</button></div></div>
      <div class="f"><label class="req" for="fData">Data</label><input id="fData" type="date" name="data" value="${(dup ? null : l?.data) || preset.data || hoje()}" required></div>
      ${novo || dup ? `<div class="f" data-show="naoTransf"><label for="fRep">Repetição</label><select id="fRep" name="repeticao"><option value="unica">Única</option><option value="parcelada">Parcelada</option><option value="fixa">Fixa</option></select></div>` : `<div class="f"><label>Repetição</label><div style="padding:8px 2px;font-size:13px" class="muted">${serieInfo || 'Única'}</div></div>`}
    </div>
    ${novo || dup ? `<div class="fr" data-show="parcelada" style="display:none"><div class="f"><label for="fParc">Número de parcelas</label><input id="fParc" type="number" name="parcelas" min="2" max="72" value="2"></div>
      <div class="f s2"><label>O valor informado é</label><select name="valorParc"><option value="total">o total da compra (será dividido)</option><option value="parcela">o valor de cada parcela</option></select></div></div>` : ''}
    <div class="fr c2">
      <div class="f"><label for="fDesc">Descrição</label><input id="fDesc" name="descricao" list="dlDesc" maxlength="120" autocomplete="off" value="${esc(l?.descricao || preset.descricao || '')}"><datalist id="dlDesc">${descs.map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
      <div class="f" data-show="naoTransf"><label class="req" for="fOnde">Conta</label><select id="fOnde" name="onde">${optOnde(onde0)}</select></div>
      <div class="f" data-show="transf"><label class="req">De (conta de origem)</label><select name="de">${contasAtivas().map(c => `<option value="${c.id}" ${l?.conta_id === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
    </div>
    <div class="fr c2" data-show="transf"><div></div><div class="f"><label class="req">Para (conta de destino)</label><select name="para">${contasAtivas().map((c, i) => `<option value="${c.id}" ${(l ? l.conta_destino_id === c.id : i === 1) ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div></div>
    <div class="fr c2" data-show="cartao"><div class="f"><label>Titular do cartão</label><input name="titular" list="dlTit" value="${esc(l ? (l.criado_por || '') : (preset.titular ?? lsGet('nc_quem') ?? ''))}"><datalist id="dlTit"></datalist></div>
      <div class="f"><label>Fatura</label><select name="fatura" id="fFatura"></select></div></div>
    ${detalhado ? `<div class="f"><label>Categorias do lançamento detalhado</label><div id="detRows"></div><button type="button" class="btn sm" data-det-add style="align-self:flex-start">${ic('plus')}Adicionar categoria</button></div>`
      : `<div class="fr c2"><div class="f" data-show="naoTransf"><label class="req" for="fCat">Categoria</label><select id="fCat" name="categoria_id"></select></div>
        <div class="f" data-show="contaPessoa"><label for="fPessoa">Pessoa (opcional)</label><input id="fPessoa" name="pessoa" list="dlTit" placeholder="Quem gastou/recebeu" value="${esc(l && !l.cartao_id ? (l.criado_por || '') : '')}"></div></div>`}
    <div class="f"><label for="fObs">Observações</label><textarea id="fObs" name="observacao" rows="2" maxlength="2000">${esc(l?.observacao || '')}</textarea><div class="cnt"><span id="obsCnt">${(l?.observacao || '').length}</span> / 2000</div></div>
    ${tagsHTML}
    <div class="anx" id="anxList"></div><input type="file" id="fAnexo" multiple hidden>
    <div class="hint" id="fInfo"></div>`;
  const tituloHTML = novo || dup
    ? `<select class="tipo-sel" id="tipoSel" aria-label="Tipo">${[['despesa', 'Nova despesa'], ['receita', 'Nova receita'], ['transferencia', 'Nova transferência']].map(([t, n]) => `<option value="${t}" ${t === tipo0 ? 'selected' : ''}>${detalhado && t === 'despesa' ? 'Novo lançamento detalhado' : n}</option>`).join('')}</select>`
    : `<h2>Editar ${TIPO_NOME[tipo0]}</h2>`;
  const rodape = `<button type="button" class="ftog conf ${pago0 ? 'on' : ''}" data-tog="pago" title="Confirmado">${ic('checkc')}</button>
    <button type="button" class="ftog conc ${conc0 ? 'on' : ''}" data-tog="conciliado" title="Marcar como conciliado">${ic('dcheck')}</button>
    <button type="button" class="ftog" data-anexar title="Anexar documentos">${ic('clip')}</button>
    ${!novo && !dup ? `<button type="button" class="ftog" id="btnDup" title="Duplicar">${ic('copy')}</button><button type="button" class="ftog" id="btnDel" title="Excluir" style="color:var(--late)">${ic('trash')}</button>` : ''}
    <span class="sp"></span><span class="salvar-g"><button type="submit" class="btn pri" value="salvar">Salvar</button>${novo || dup ? `<button type="submit" class="btn pri" value="continuar" title="Salvar e continuar">${ic('plus')}</button>` : ''}</span>`;

  modal({
    tituloHTML, corpo, rodape,
    onOpen: form => {
      const E = form.elements;
      let ultimoTipoCat = null;
      const det = [];
      const sync = () => {
        const t = E.tipo.value, onde = E.onde.value;
        const transf = t === 'transferencia', cartao = !transf && onde.startsWith('cartao:');
        const rep = E.repeticao?.value || 'unica';
        form.querySelectorAll('[data-show]').forEach(el => {
          const s = el.dataset.show;
          const vis = s === 'transf' ? transf : s === 'naoTransf' ? !transf : s === 'cartao' ? cartao : s === 'parcelada' ? (rep === 'parcelada' && !transf) : s === 'contaPessoa' ? (!transf && !cartao) : true;
          el.style.display = vis ? '' : 'none';
        });
        if (E.categoria_id && ultimoTipoCat !== t && !transf) {
          const atual = E.categoria_id.value || l?.categoria_id || preset.categoria_id || '';
          E.categoria_id.innerHTML = optsCategoria(t, atual, 'Selecione…'); ultimoTipoCat = t;
        }
        // tag do botão "confirmado"
        $('[data-tog="pago"]', form.closest('.overlay')).style.display = cartao ? 'none' : '';
        if (cartao) {
          const c = byId('cartoes', onde.slice(7)), d = E.data.value || hoje();
          const calc = faturaYM(c, d), atual = E.fatura.dataset.v || (l?.fatura_mes ? fatMes(l) : calc);
          const opts = [-1, 0, 1, 2].map(i => addMeses(calc, i));
          if (!opts.includes(atual)) opts.push(atual);
          E.fatura.innerHTML = opts.sort().map(fy => `<option value="${fy}" ${fy === atual ? 'selected' : ''}>${nomeMes(fy)}${fy === calc ? ' (pela data)' : ''} · vence ${dataBR(dataNoMes(fy, c.dia_vencimento)).slice(0, 5)}</option>`).join('');
          $('#dlTit', form).innerHTML = [...new Set([...(c.titulares || []), ...pessoasConhecidas()])].map(p => `<option value="${esc(p)}">`).join('');
        } else $('#dlTit', form).innerHTML = pessoasConhecidas().map(p => `<option value="${esc(p)}">`).join('');
        // aviso de período fechado
        const f = bloqueado({ data: E.data.value, conta_id: transf ? E.de.value : onde.startsWith('conta:') ? onde.slice(6) : null, conta_destino_id: transf ? E.para.value : null, cartao_id: cartao ? onde.slice(7) : null });
        const info = $('#fInfo', form);
        info.className = 'hint' + (f ? ' err' : '');
        info.textContent = f ? `Período fechado até ${dataBR(f)} para esta conta. Reabra a posição em Cadastros → Fechamento posição.` : rep === 'fixa' && (novo || dup) ? 'Fixa: o lançamento se repete todo mês, sem data para terminar (são gerados 24 meses à frente e o sistema completa automaticamente).' : '';
        if (detalhado) atualizaDet();
      };
      const desenhaAnexos = () => {
        $('#anxList', form).innerHTML = anexos.map((a, i) => `<span class="chip" data-anx="${i}" title="Abrir">${ic('clip')}${esc(a.nome || nomeDoc(a.path.split('/').pop()))}<b data-anx-del="${i}" style="margin-left:4px;cursor:pointer" title="Remover">×</b></span>`).join('');
      };
      const novosArquivos = [];
      // lançamento detalhado (várias categorias)
      const atualizaDet = () => {
        const tot = det.reduce((a, d) => a + (parseValor(d.v) || 0), 0);
        E.valor.value = tot ? valorInput(r2(tot)) : '';
      };
      const desenhaDet = () => {
        $('#detRows', form).innerHTML = det.map((d, i) => `<div class="det-row"><div class="f" style="margin-bottom:8px"><select data-det-cat="${i}">${optsCategoria(E.tipo.value, d.c, 'Categoria…')}</select></div>
          <div class="f" style="margin-bottom:8px"><input class="num" inputmode="decimal" placeholder="0,00" data-det-v="${i}" value="${esc(d.v)}"></div><button type="button" class="icon-btn sm" data-det-del="${i}" title="Remover">${ic('x')}</button></div>`).join('');
        atualizaDet();
      };
      if (detalhado) { det.push({ c: '', v: '' }, { c: '', v: '' }); desenhaDet(); }
      form.addEventListener('click', e => {
        const tg = e.target.closest('[data-tog]');
        if (tg) { const n = tg.dataset.tog, on = !tg.classList.contains('on'); tg.classList.toggle('on', on); E[n].value = on ? 1 : 0; if (n === 'conciliado' && on) { E.pago.value = 1; $('[data-tog="pago"]', form).classList.add('on'); } if (n === 'pago' && !on) { E.conciliado.value = 0; $('[data-tog="conciliado"]', form).classList.remove('on'); } }
        if (e.target.closest('[data-calc]')) { const r = parseValor(E.valor.value); if (isNaN(r)) toast('Conta inválida', true); else E.valor.value = valorInput(r); }
        if (e.target.closest('[data-anexar]')) $('#fAnexo', form).click();
        const ad = e.target.closest('[data-anx-del]'); if (ad) { e.stopPropagation(); const a = anexos.splice(+ad.dataset.anxDel, 1)[0]; const k = novosArquivos.indexOf(a); if (k >= 0) novosArquivos.splice(k, 1); desenhaAnexos(); return; }
        const ao = e.target.closest('[data-anx]'); if (ao && anexos[+ao.dataset.anx]?.path) abrirDoc(anexos[+ao.dataset.anx].path);
        if (e.target.closest('[data-det-add]')) { det.push({ c: '', v: '' }); desenhaDet(); }
        const dd = e.target.closest('[data-det-del]'); if (dd) { det.splice(+dd.dataset.detDel, 1); desenhaDet(); }
      }, true);
      form.addEventListener('input', e => {
        if (e.target.name === 'observacao') $('#obsCnt', form).textContent = e.target.value.length;
        if (e.target.dataset.detV !== undefined) { det[+e.target.dataset.detV].v = e.target.value; atualizaDet(); }
      });
      form.addEventListener('change', e => {
        if (e.target.dataset.detCat !== undefined) det[+e.target.dataset.detCat].c = e.target.value;
        if (e.target.name === 'fatura') e.target.dataset.v = e.target.value;
        if (e.target.name === 'valor' && /[+\-*/]/.test(e.target.value.replace(/^-/, ''))) { const r = parseValor(e.target.value); if (!isNaN(r)) e.target.value = valorInput(r); }
        sync();
      });
      $('#fAnexo', form).addEventListener('change', e => { for (const f of e.target.files) { const a = { arquivo: f, nome: f.name }; anexos.push(a); novosArquivos.push(a); } e.target.value = ''; desenhaAnexos(); });
      $('#tipoSel')?.addEventListener('change', e => { E.tipo.value = e.target.value; if (detalhado) desenhaDet(); sync(); });
      // regras de preenchimento e sugestão pela última vez que a descrição foi usada
      E.descricao.addEventListener('change', () => {
        const d = E.descricao.value.trim(), t = E.tipo.value;
        if (!d || t === 'transferencia') return;
        const r = regraPara(d, t);
        if (r) {
          if (r.cartao_id && byId('cartoes', r.cartao_id)) E.onde.value = 'cartao:' + r.cartao_id;
          else if (r.conta_id && byId('contas', r.conta_id)) E.onde.value = 'conta:' + r.conta_id;
          sync();
          if (r.categoria_id && E.categoria_id) E.categoria_id.value = r.categoria_id;
          if (r.titular) E.titular.value = r.titular;
          (r.tags || []).forEach(tid => { const cb = form.querySelector(`input[name=tag][value="${tid}"]`); if (cb) cb.checked = true; });
          $('#fInfo', form).className = 'hint'; $('#fInfo', form).textContent = 'Preenchido pela regra “' + r.descricao + '”.';
        } else if (E.categoria_id && !E.categoria_id.value) {
          const ant = [...S.lancamentos].reverse().find(x => x.tipo === t && semAcento(x.descricao) === semAcento(d) && x.categoria_id);
          if (ant) E.categoria_id.value = ant.categoria_id;
        }
      });
      desenhaAnexos(); sync();
      $('#btnDel', form.closest('.overlay'))?.addEventListener('click', () => apagarLanc(l));
      $('#btnDup', form.closest('.overlay'))?.addEventListener('click', () => { fecharModal(); formLanc(null, { ...l, tipo: l.tipo, onde: l.cartao_id ? 'cartao:' + l.cartao_id : 'conta:' + l.conta_id, titular: l.criado_por, duplicar: true, data: hoje(), pago: lsGet('nc_padrao_pago') !== '0' }); });
      form._ctx = { det, anexos, novosArquivos };
    },
    onSubmit: async (form, sub) => {
      const E = form.elements, { det, anexos, novosArquivos } = form._ctx;
      const tipo = E.tipo.value, valor = parseValor(E.valor.value), data = E.data.value;
      let descricao = E.descricao.value.trim();
      if (!(valor > 0)) return 'Informe um valor maior que zero.';
      if (!data) return 'Informe a data.';
      const base = { tipo, valor, data, descricao, observacao: E.observacao.value.trim() || null, pago: E.pago.value === '1', conciliado: E.conciliado.value === '1',
        categoria_id: null, conta_id: null, conta_destino_id: null, cartao_id: null, fatura_mes: null, criado_por: null,
        tags: [...form.querySelectorAll('input[name=tag]:checked')].map(x => x.value) };
      if (tipo === 'transferencia') {
        base.conta_id = E.de.value; base.conta_destino_id = E.para.value;
        if (!base.conta_id || base.conta_id === base.conta_destino_id) return 'Escolha duas contas diferentes.';
        if (!descricao) base.descricao = descricao = 'Transferência';
      } else {
        const onde = E.onde.value; if (!onde) return 'Escolha a conta.';
        if (!detalhado) { base.categoria_id = E.categoria_id.value || null; if (!base.categoria_id) return 'Escolha a categoria.'; }
        if (onde.startsWith('cartao:')) { base.cartao_id = onde.slice(7); base.pago = true; base.fatura_mes = (E.fatura.value || faturaYM(byId('cartoes', base.cartao_id), data)) + '-01'; base.criado_por = E.titular.value.trim() || null; }
        else { base.conta_id = onde.slice(6); base.criado_por = E.pessoa?.value.trim() || null; }
        if (!descricao) base.descricao = descricao = nomeCat(base.categoria_id) !== 'Sem categoria' ? nomeCat(base.categoria_id).split('/').pop() : (tipo === 'receita' ? 'Receita' : 'Despesa');
        lsSet('nc_ultimaOnde', onde);
      }
      const f = bloqueado(base); if (f) return `Período fechado até ${dataBR(f)}. Reabra a posição para lançar nesta data.`;
      // anexos novos
      if (novosArquivos.length) { const env = await enviarArquivos(novosArquivos.map(a => a.arquivo)); _docs = null; base.anexos = anexos.filter(a => a.path).concat(env); }
      else base.anexos = anexos.filter(a => a.path);
      if (!novo && !dup) {
        const r = await salvarEdicao(l, base); if (r === null) return false;
        await recarregarERender(['lancamentos']); return;
      }
      const rep = E.repeticao?.value || 'unica';
      let linhas;
      if (detalhado) {
        const partes = det.map(d => ({ c: d.c, v: parseValor(d.v) })).filter(d => d.v > 0);
        if (partes.length < 1) return 'Informe ao menos uma categoria com valor.';
        if (partes.some(p => !p.c)) return 'Escolha a categoria de cada parte.';
        const g = uuid();
        linhas = partes.map(p => ({ ...base, valor: p.v, categoria_id: p.c, grupo_id: g, serie: 'detalhado' }));
      } else if (rep === 'parcelada' && tipo !== 'transferencia') {
        const n = Math.max(2, Math.min(72, parseInt(E.parcelas.value) || 2));
        const total = E.valorParc.value === 'parcela' ? r2(valor * n) : valor;
        const cents = Math.round(total * 100), parte = Math.floor(cents / n), g = uuid();
        const fy0 = base.fatura_mes ? fatMes(base) : null;
        linhas = [...Array(n)].map((_, i) => ({ ...base, grupo_id: g, serie: 'parcelada', parcela: i + 1, total_parcelas: n,
          valor: (i === 0 ? cents - parte * (n - 1) : parte) / 100, data: addMesesData(data, i), pago: base.cartao_id ? true : (i === 0 ? base.pago : false),
          conciliado: i === 0 ? base.conciliado : false, anexos: i === 0 ? base.anexos : [], fatura_mes: fy0 ? addMeses(fy0, i) + '-01' : null }));
      } else if (rep === 'fixa' && tipo !== 'transferencia') {
        const g = uuid(), fy0 = base.fatura_mes ? fatMes(base) : null;
        linhas = [...Array(25)].map((_, i) => ({ ...base, grupo_id: g, serie: 'fixa', data: addMesesData(data, i), pago: base.cartao_id ? true : (i === 0 ? base.pago : false),
          conciliado: i === 0 ? base.conciliado : false, anexos: i === 0 ? base.anexos : [], fatura_mes: fy0 ? addMeses(fy0, i) + '-01' : null }));
      } else linhas = [base];
      await inserirMuitos('lancamentos', linhas, linhas.length > 1 ? `${linhas.length} lançamentos criados` : 'Lançamento salvo');
      await recarregarERender(['lancamentos']);
      if (sub?.value === 'continuar') { setTimeout(() => formLanc(null, { tipo: detalhado ? 'detalhado' : tipo, onde: E.onde.value, data }), 50); }
    },
  });
}
// edição: pergunta se vale só para este ou para a série
async function salvarEdicao(l, base) {
  const grupo = l.grupo_id ? S.lancamentos.filter(x => x.grupo_id === l.grupo_id) : [];
  let alvo = 'este';
  if (grupo.length > 1 && l.serie !== 'detalhado') {
    alvo = await escolha('Alterar lançamento repetido', `“${esc(l.descricao)}” faz parte de uma série de ${grupo.length} lançamentos. Aplicar as alterações a quais?`, [
      { t: 'Cancelar', v: null }, { t: 'Somente este', v: 'este' }, { t: 'Este e os próximos', v: 'prox' }, { t: 'Todos', v: 'todos' }]);
    if (!alvo) return null;
  }
  await op(sb.from('lancamentos').update(base).eq('id', l.id));
  if (alvo !== 'este') {
    const outros = grupo.filter(x => x.id !== l.id && (alvo === 'todos' || x.data > l.data));
    const comum = { descricao: base.descricao, categoria_id: base.categoria_id, conta_id: base.conta_id, conta_destino_id: base.conta_destino_id, cartao_id: base.cartao_id, observacao: base.observacao, tags: base.tags, criado_por: base.criado_por, tipo: base.tipo };
    if (l.serie !== 'parcelada' || num(l.valor) !== base.valor) comum.valor = base.valor;
    const bloq = outros.filter(x => bloqueado({ ...x, ...comum }));
    for (const x of outros.filter(x => !bloq.includes(x))) {
      const upd = { ...comum };
      if (base.cartao_id) { const c = byId('cartoes', base.cartao_id); upd.fatura_mes = (x.cartao_id === base.cartao_id && x.fatura_mes ? x.fatura_mes : faturaYM(c, x.data) + '-01'); }
      else upd.fatura_mes = null;
      await op(sb.from('lancamentos').update(upd).eq('id', x.id));
    }
    toast(`${outros.length - bloq.length + 1} lançamento(s) atualizado(s)${bloq.length ? ` · ${bloq.length} em período fechado não foram alterados` : ''}`);
  } else toast('Lançamento atualizado');
  return true;
}
async function apagarLanc(l) {
  const f = bloqueado(l); if (f) return toast(`Período fechado até ${dataBR(f)}.`, true);
  let ids = [l.id], fimSerie = null;
  const grupo = l.grupo_id ? S.lancamentos.filter(x => x.grupo_id === l.grupo_id) : [];
  if (grupo.length > 1) {
    const prox = grupo.filter(x => x.data >= l.data);
    const r = await escolha('Excluir lançamento', `“${esc(l.descricao)}” faz parte de uma série de ${grupo.length} lançamentos. O que deseja excluir?`, [
      { t: 'Cancelar', v: null }, { t: 'Somente este', v: 'um' }, { t: `Este e os próximos (${prox.length})`, v: 'prox' }, { t: `Todos (${grupo.length})`, v: 'todos', cls: 'danger' }]);
    if (!r) return;
    if (r === 'prox') { ids = prox.map(x => x.id); fimSerie = grupo.filter(x => x.data < l.data).map(x => x.id); }
    if (r === 'todos') ids = grupo.map(x => x.id);
  } else if (!await confirmar('Excluir lançamento', `Excluir “${esc(l.descricao)}” de ${fmt(l.valor)}?`)) return;
  ids = ids.filter(id => !bloqueado(byId('lancamentos', id)));
  fecharModal();
  if (fimSerie?.length && (l.serie || '').startsWith('fixa')) await op(sb.from('lancamentos').update({ serie: 'fixa_fim' }).in('id', fimSerie));
  await excluir('lancamentos', ids, ids.length > 1 ? `${ids.length} lançamentos excluídos` : 'Lançamento excluído');
  await recarregarERender(['lancamentos']);
}
async function alternarPago(l, campo = 'pago') {
  const f = bloqueado(l); if (f) return toast(`Período fechado até ${dataBR(f)}.`, true);
  const upd = campo === 'pago' ? { pago: !l.pago, conciliado: l.pago ? false : l.conciliado } : { conciliado: !l.conciliado, pago: l.cartao_id ? true : (!l.conciliado ? true : l.pago) };
  if (campo === 'pago' && l.conciliado) { upd.pago = false; upd.conciliado = false; }
  await op(sb.from('lancamentos').update(upd).eq('id', l.id), campo === 'pago' ? (upd.pago ? (l.tipo === 'receita' ? 'Recebido' : 'Confirmado') : 'Voltou para pendente') : (upd.conciliado ? 'Conciliado' : 'Conciliação desfeita'));
  await recarregarERender(['lancamentos']);
}
function menuLanc(el, l) {
  const itens = [{ t: 'Editar', ic: 'edit', f: () => formLanc(l) }];
  if (!l.cartao_id || l.tipo === 'pagamento_fatura') itens.push({ t: l.pago ? 'Marcar como pendente' : (l.tipo === 'receita' ? 'Confirmar recebimento' : 'Confirmar pagamento'), ic: 'checkc', f: () => alternarPago(l) });
  itens.push({ t: l.conciliado ? 'Desfazer conciliação' : 'Marcar como conciliado', ic: 'dcheck', f: () => alternarPago(l, 'conciliado') });
  if (l.tipo !== 'pagamento_fatura') itens.push({ t: 'Duplicar', ic: 'copy', f: () => formLanc(null, { ...l, onde: l.cartao_id ? 'cartao:' + l.cartao_id : 'conta:' + l.conta_id, titular: l.criado_por, duplicar: true, data: hoje() }) });
  if (l.cartao_id && l.tipo !== 'pagamento_fatura') itens.push({ t: 'Ver fatura', ic: 'cartao', f: () => { S.cartaoSel = l.cartao_id; S.faturaSel[l.cartao_id] = fatMes(l); irPara('cartoes'); } });
  if (recurso('tags') || true) itens.push({ t: 'Criar regra com esta descrição', ic: 'magic', f: () => formRegra(null, l.tipo === 'receita' ? 'receita' : 'despesa', l) });
  itens.push('-', { t: 'Excluir', ic: 'trash', cls: 'danger', f: () => apagarLanc(l) });
  abrirCMenu(el, itens);
}

/* ---------- pagamento de fatura ---------- */
function formPagamento(c, fym, l = null) {
  if (!S.contas.length) return toast('Cadastre a conta que paga a fatura.', true);
  const f = faturaInfo(c, fym);
  modal({
    titulo: l ? 'Editar pagamento de fatura' : `Lançar pagamento · ${c.nome}`,
    corpo: `<p class="muted" style="margin-top:0">Fatura de <b style="text-transform:capitalize">${nomeMes(fym)}</b> · vence ${dataBR(f.vencimento)} · total ${fmt(f.saldoAnterior + f.total)}${f.pago ? ' · já pago ' + fmt(f.pago) : ''}</p>
      <div class="fr"><div class="f"><label class="req">Valor (R$)</label><input class="num" name="valor" inputmode="decimal" value="${valorInput(l ? l.valor : f.aPagar)}" required></div>
      <div class="f"><label class="req">Data</label><input type="date" name="data" value="${l?.data || (f.vencimento > hoje() ? f.vencimento : hoje())}" required></div>
      <div class="f"><label class="req">Pago com a conta</label><select name="conta">${S.contas.filter(x => !x.arquivada || x.id === l?.conta_id).map(x => `<option value="${x.id}" ${(l ? l.conta_id : c.conta_id) === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div></div>
      <label class="inline"><input type="checkbox" name="pago" ${l ? (l.pago ? 'checked' : '') : (f.vencimento <= hoje() ? 'checked' : '')}>Confirmado (já foi pago)</label>`,
    ok: l ? 'Salvar' : 'Lançar pagamento',
    extra: l ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => $('#btnDel', form.closest('.overlay'))?.addEventListener('click', () => apagarLanc(l)),
    onSubmit: async form => {
      const valor = parseValor(v(form, 'valor'));
      if (!(valor > 0)) return 'Informe um valor maior que zero.';
      const dados = { tipo: 'pagamento_fatura', descricao: `Pagamento cartão ${c.nome}`, valor, data: v(form, 'data'), pago: form.elements.pago.checked, conta_id: v(form, 'conta'), cartao_id: c.id, fatura_mes: fym + '-01' };
      const b = bloqueado(dados); if (b) return `Período fechado até ${dataBR(b)}.`;
      await salvar('lancamentos', dados, l?.id, 'Pagamento registrado');
      await recarregarERender(['lancamentos']);
    },
  });
}
/* ---------- ajuste de saldo ---------- */
function formAjuste(c) {
  modal({
    titulo: `Ajustar saldo · ${c.nome}`,
    corpo: `<p class="muted" style="margin-top:0">Informe o saldo real da conta (como aparece no banco) em uma data. A diferença é lançada como "Ajuste de saldo".</p>
      <div class="fr c2"><div class="f"><label class="req">Data</label><input type="date" name="data" value="${hoje()}"></div><div class="f"><label class="req">Saldo real (R$)</label><input class="num" name="saldo" inputmode="decimal" placeholder="0,00"></div></div><div class="hint" id="ajInfo"></div>`,
    ok: 'Ajustar',
    onOpen: form => form.addEventListener('input', () => { const s = parseValor(v(form, 'saldo')); const atual = saldoConta(c.id, { ate: v(form, 'data') }); $('#ajInfo', form).textContent = isNaN(s) ? `Saldo confirmado no sistema nesta data: ${fmt(atual)}` : `Saldo no sistema: ${fmt(atual)} · ajuste de ${fmt(s - atual)}`; }),
    onSubmit: async form => {
      const s = parseValor(v(form, 'saldo')), data = v(form, 'data');
      if (isNaN(s)) return 'Informe o saldo.';
      const dif = r2(s - saldoConta(c.id, { ate: data }));
      if (!dif) return toast('O saldo já está correto.');
      const dados = { tipo: dif > 0 ? 'receita' : 'despesa', descricao: 'Ajuste de saldo', valor: Math.abs(dif), data, pago: true, conta_id: c.id, criado_por: lsGet('nc_quem') || null };
      const b = bloqueado(dados); if (b) return `Período fechado até ${dataBR(b)}.`;
      await salvar('lancamentos', dados, null, 'Saldo ajustado');
      await recarregarERender(['lancamentos']);
    },
  });
}
/* ---------- antecipar parcelas ---------- */
function formAntecipar(c, fym) {
  const futuras = S.lancamentos.filter(l => l.cartao_id === c.id && l.serie === 'parcelada' && fatMes(l) > fym && l.tipo === 'despesa').sort((a, b) => fatMes(a) < fatMes(b) ? -1 : 1);
  modal({
    titulo: `Antecipar parcelas para a fatura de ${nomeMes(fym)}`, largo: true,
    corpo: `<p class="muted" style="margin-top:0">Selecione as parcelas futuras que serão cobradas nesta fatura.</p><div class="prev-t"><table><tr><th></th><th>Compra</th><th>Parcela</th><th>Fatura atual</th><th style="text-align:right">Valor</th></tr>
      ${futuras.map(l => `<tr><td><input type="checkbox" name="ant" value="${l.id}"></td><td>${esc(l.descricao)}</td><td>${l.parcela}/${l.total_parcelas}</td><td>${nomeMes(fatMes(l))}</td><td class="num" style="text-align:right">${fmtN(l.valor)}</td></tr>`).join('')}</table></div>`,
    ok: 'Antecipar',
    onSubmit: async form => {
      const ids = [...form.querySelectorAll('input[name=ant]:checked')].map(x => x.value);
      if (!ids.length) return 'Selecione ao menos uma parcela.';
      await op(sb.from('lancamentos').update({ fatura_mes: fym + '-01' }).in('id', ids), `${ids.length} parcela(s) antecipada(s)`);
      await recarregarERender(['lancamentos']);
    },
  });
}

/* =====================================================================
   FORMULÁRIOS DE CADASTRO
   ===================================================================== */
function formConta(c = null) {
  const n = c ? S.lancamentos.filter(l => l.conta_id === c.id || l.conta_destino_id === c.id).length : 0;
  modal({
    titulo: c ? 'Editar conta' : 'Nova conta',
    corpo: `<div class="fr c2"><div class="f"><label class="req">Nome</label><input name="nome" maxlength="60" value="${esc(c?.nome || '')}" placeholder="Ex.: Bradesco" required></div>
      <div class="f"><label>Tipo</label><select name="tipo">${Object.entries(TIPOS_CONTA).map(([k, t]) => `<option value="${k}" ${c?.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <div class="fr c2"><div class="f"><label>Saldo inicial (R$)</label><input class="num" name="saldo_inicial" inputmode="decimal" value="${valorInput(c?.saldo_inicial ?? 0)}"></div>${corInput(c?.cor || PALETA[S.contas.length % PALETA.length])}</div>
      <div class="opt-row" style="padding:10px 0"><div class="grow"><b>Considerar saldo</b><div class="s">Somar o saldo desta conta nos totais e no balanço.</div></div>${swHTML('considerar', c ? c.considerar_saldo !== false : true)}</div>
      <div class="opt-row" style="padding:10px 0"><div class="grow"><b>Conta ativa</b><div class="s">Contas inativas somem das listas, mas mantêm o histórico.</div></div>${swHTML('ativa', c ? !c.arquivada : true)}</div>
      <p class="muted" style="font-size:12px">O saldo inicial é o saldo da conta antes do primeiro lançamento registrado aqui.${c ? ` Esta conta tem ${n} lançamento(s).` : ''}</p>`,
    extra: c ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => {
      if (!await confirmar('Excluir conta', `Excluir a conta “${esc(c.nome)}”? ${n ? `<b>Os ${n} lançamentos dela também serão apagados.</b> Para manter o histórico, desative a conta.` : ''}`)) return;
      fecharModal(); await excluir('contas', c.id, 'Conta excluída'); await recarregarERender();
    }),
    onSubmit: async form => {
      const nome = v(form, 'nome').trim(); if (!nome) return 'Informe o nome.';
      const saldo = parseValor(v(form, 'saldo_inicial') || '0'); if (isNaN(saldo)) return 'Saldo inicial inválido.';
      await salvar('contas', { nome, tipo: v(form, 'tipo'), saldo_inicial: saldo, cor: v(form, 'cor'), considerar_saldo: form.elements.considerar.checked, arquivada: !form.elements.ativa.checked }, c?.id, c ? 'Conta atualizada' : 'Conta criada');
      await recarregarERender(['contas']);
    },
  });
}
function formCartao(c = null) {
  modal({
    titulo: c ? 'Editar cartão de crédito' : 'Novo cartão de crédito',
    corpo: `<div class="fr c2"><div class="f"><label class="req">Nome</label><input name="nome" maxlength="60" value="${esc(c?.nome || '')}" placeholder="Ex.: Visa" required></div>
      <div class="f"><label>Limite (R$)</label><input class="num" name="limite" inputmode="decimal" value="${valorInput(c?.limite ?? '')}" placeholder="0,00"></div></div>
      <div class="fr"><div class="f"><label class="req">Dia do fechamento</label><input type="number" name="dia_fechamento" min="1" max="31" value="${c?.dia_fechamento || ''}" required></div>
      <div class="f"><label class="req">Dia do vencimento</label><input type="number" name="dia_vencimento" min="1" max="31" value="${c?.dia_vencimento || ''}" required></div>${corInput(c?.cor || PALETA[(S.cartoes.length + 4) % PALETA.length])}</div>
      <div class="f"><label>Conta para pagamento da fatura</label><select name="conta_id"><option value="">—</option>${S.contas.map(x => `<option value="${x.id}" ${c?.conta_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="f"><label>Titulares (cartão principal e adicionais, separados por vírgula)</label><input name="titulares" value="${esc((c?.titulares || []).join(', ') || (c ? '' : (lsGet('nc_quem') || '')))}" placeholder="Ex.: Bruno Roberto Lopes Coelho, Rúbia Moreira Barbosa Coelho"></div>
      <div class="opt-row" style="padding:10px 0"><div class="grow"><b>Cartão ativo</b><div class="s">Cartões inativos somem das listas, mas mantêm o histórico.</div></div>${swHTML('ativo', c ? !c.arquivado : true)}</div>
      <p class="muted" style="font-size:12px">Compras feitas no dia do fechamento ou depois entram na fatura seguinte.</p>`,
    extra: c ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => {
      const n = S.lancamentos.filter(l => l.cartao_id === c.id).length;
      if (!await confirmar('Excluir cartão', `Excluir o cartão “${esc(c.nome)}”? ${n ? `<b>As ${n} compras e pagamentos dele também serão apagados.</b> Para manter o histórico, desative o cartão.` : ''}`)) return;
      fecharModal(); await excluir('cartoes', c.id, 'Cartão excluído'); S.cartaoSel = null; await recarregarERender();
    }),
    onSubmit: async form => {
      const nome = v(form, 'nome').trim(); if (!nome) return 'Informe o nome.';
      const fe = parseInt(v(form, 'dia_fechamento')), ve = parseInt(v(form, 'dia_vencimento'));
      if (!(fe >= 1 && fe <= 31) || !(ve >= 1 && ve <= 31)) return 'Dias de fechamento e vencimento devem estar entre 1 e 31.';
      const limite = parseValor(v(form, 'limite') || '0');
      const titulares = v(form, 'titulares').split(',').map(s => s.trim()).filter(Boolean);
      await salvar('cartoes', { nome, limite: isNaN(limite) ? 0 : limite, dia_fechamento: fe, dia_vencimento: ve, conta_id: v(form, 'conta_id') || null, cor: v(form, 'cor'), titulares, arquivado: !form.elements.ativo.checked }, c?.id, c ? 'Cartão atualizado' : 'Cartão criado');
      await recarregarERender(['cartoes']);
    },
  });
}
function formCat(c = null, tipo = 'despesa', parentId = null) {
  const t = c?.tipo || tipo;
  const temFilhas = c && S.categorias.some(x => x.parent_id === c.id);
  const pais = S.categorias.filter(x => x.tipo === t && !x.parent_id && x.id !== c?.id).sort(ordenaNome);
  modal({
    titulo: c ? 'Editar categoria' : (parentId ? 'Nova subcategoria' : 'Nova categoria'),
    corpo: `<div class="fr c2"><div class="f"><label class="req">Nome</label><input name="nome" maxlength="40" value="${esc(c?.nome || '')}" required></div>
      <div class="f"><label>Tipo</label><select name="tipo" ${c ? 'disabled' : ''}><option value="despesa" ${t === 'despesa' ? 'selected' : ''}>Despesa</option><option value="receita" ${t === 'receita' ? 'selected' : ''}>Receita</option></select></div></div>
      <div class="fr c2"><div class="f"><label>Subcategoria de</label><select name="parent_id" ${temFilhas ? 'disabled' : ''}><option value="">— (categoria principal)</option>${pais.map(p => `<option value="${p.id}" ${(c?.parent_id || parentId) === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>${corInput(c?.cor || (parentId ? catById(parentId)?.cor : null) || PALETA[S.categorias.length % PALETA.length])}</div>
      <div class="opt-row" style="padding:10px 0"><div class="grow"><b>Categoria ativa</b><div class="s">Categorias inativas não aparecem nos formulários, mas mantêm o histórico.</div></div>${swHTML('ativa', c ? c.ativa !== false : true)}</div>`,
    extra: c ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => {
      const n = S.lancamentos.filter(l => l.categoria_id === c.id).length;
      if (!await confirmar('Excluir categoria', `Excluir “${esc(c.nome)}”?${temFilhas ? ' As subcategorias também serão excluídas.' : ''} ${n ? `Os ${n} lançamentos ficarão “sem categoria”. Para manter, desative a categoria.` : ''}`)) return;
      fecharModal(); await excluir('categorias', c.id, 'Categoria excluída'); await recarregarERender(['categorias', 'lancamentos', 'orcamentos', 'regras']);
    }),
    onSubmit: async form => {
      const nome = v(form, 'nome').trim(); if (!nome) return 'Informe o nome.';
      const dados = { nome, cor: v(form, 'cor'), ativa: form.elements.ativa.checked };
      if (!temFilhas) dados.parent_id = v(form, 'parent_id') || null;
      if (!c) dados.tipo = v(form, 'tipo');
      await salvar('categorias', dados, c?.id, 'Categoria salva');
      await recarregarERender(['categorias']);
    },
  });
}
function formTag(t = null) {
  modal({
    titulo: t ? 'Editar tag' : 'Criar tag',
    corpo: `<div class="fr c2"><div class="f"><label class="req">Nome</label><input name="nome" maxlength="30" value="${esc(t?.nome || '')}" required></div>${corInput(t?.cor || PALETA[(S.tags.length + 2) % PALETA.length])}</div>`,
    extra: t ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => {
      if (!await confirmar('Excluir tag', `Excluir a tag “${esc(t.nome)}”? Ela será retirada dos lançamentos.`)) return;
      fecharModal();
      for (const l of S.lancamentos.filter(l => (l.tags || []).includes(t.id))) await sb.from('lancamentos').update({ tags: l.tags.filter(x => x !== t.id) }).eq('id', l.id);
      await excluir('tags', t.id, 'Tag excluída'); await recarregarERender(['tags', 'lancamentos']);
    }),
    onSubmit: async form => {
      const nome = v(form, 'nome').trim(); if (!nome) return 'Informe o nome.';
      await salvar('tags', { nome, cor: v(form, 'cor') }, t?.id, 'Tag salva');
      await recarregarERender(['tags']);
    },
  });
}
function formRegra(r = null, tipo = 'despesa', base = null) {
  const t = r?.tipo || tipo;
  const ondeSel = r ? (r.cartao_id ? 'cartao:' + r.cartao_id : r.conta_id ? 'conta:' + r.conta_id : '') : base ? (base.cartao_id ? 'cartao:' + base.cartao_id : base.conta_id ? 'conta:' + base.conta_id : '') : '';
  modal({
    titulo: r ? 'Editar regra de preenchimento' : 'Nova regra de preenchimento',
    corpo: `<div class="fr c2"><div class="f"><label class="req">Descrição</label><input name="descricao" maxlength="120" value="${esc(r?.descricao || base?.descricao || '')}" required></div>
      <div class="f"><label>Tipo</label><select name="tipo" ${r ? 'disabled' : ''}><option value="despesa" ${t === 'despesa' ? 'selected' : ''}>Despesa</option><option value="receita" ${t === 'receita' ? 'selected' : ''}>Receita</option></select></div></div>
      <div class="f"><label>Palavras alternativas (separadas por vírgula)</label><input name="palavras" value="${esc(r?.palavras || '')}" placeholder="Ex.: carrefour, supermercado bh, epa"><div class="cnt" style="text-align:left">Se a descrição digitada contiver uma destas palavras, a regra também é aplicada.</div></div>
      <div class="fr c2"><div class="f"><label>Conta ou cartão</label><select name="onde"><option value="">— não alterar —</option><optgroup label="Contas">${contasAtivas().map(c => `<option value="conta:${c.id}" ${ondeSel === 'conta:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup><optgroup label="Cartões">${cartoesAtivos().map(c => `<option value="cartao:${c.id}" ${ondeSel === 'cartao:' + c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup></select></div>
        <div class="f"><label>Titular do cartão</label><input name="titular" list="dlTitR" value="${esc(r?.titular || (base?.cartao_id ? base.criado_por || '' : ''))}"><datalist id="dlTitR">${pessoasConhecidas().map(p => `<option value="${esc(p)}">`).join('')}</datalist></div></div>
      <div class="f"><label>Categoria</label><select name="categoria_id">${optsCategoria(t, r?.categoria_id || base?.categoria_id || '', '— não alterar —')}</select></div>
      ${S.tags.length ? `<div class="f"><label>Tags</label><div class="tagsel">${S.tags.map(tg => `<label><input type="checkbox" name="tag" value="${tg.id}" ${(r?.tags || base?.tags || []).includes(tg.id) ? 'checked' : ''}><span class="dot" style="background:${esc(tg.cor)}"></span><span>${esc(tg.nome)}</span></label>`).join('')}</div></div>` : ''}`,
    extra: r ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => {
      $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => { if (!await confirmar('Excluir regra', `Excluir a regra “${esc(r.descricao)}”?`)) return; fecharModal(); await excluir('regras', r.id, 'Regra excluída'); await recarregarERender(['regras']); });
      form.elements.tipo.addEventListener('change', () => { form.elements.categoria_id.innerHTML = optsCategoria(form.elements.tipo.value, '', '— não alterar —'); });
    },
    onSubmit: async form => {
      const descricao = v(form, 'descricao').trim(); if (!descricao) return 'Informe a descrição.';
      const onde = v(form, 'onde');
      const dados = { descricao, palavras: v(form, 'palavras').trim() || null, conta_id: onde.startsWith('conta:') ? onde.slice(6) : null, cartao_id: onde.startsWith('cartao:') ? onde.slice(7) : null,
        titular: v(form, 'titular').trim() || null, categoria_id: v(form, 'categoria_id') || null, tags: [...form.querySelectorAll('input[name=tag]:checked')].map(x => x.value) };
      if (!r) dados.tipo = v(form, 'tipo');
      await salvar('regras', dados, r?.id, 'Regra salva');
      await recarregarERender(['regras']);
    },
  });
}
function formMeta(m = null) {
  modal({
    titulo: m ? 'Editar meta de economia' : 'Nova meta de economia',
    corpo: `<div class="fr c2"><div class="f"><label class="req">Nome</label><input name="nome" maxlength="60" value="${esc(m?.nome || '')}" placeholder="Ex.: Fundo de reserva" required></div>${corInput(m?.cor || PALETA[(S.metas.length + 1) % PALETA.length])}</div>
      <div class="fr c2"><div class="f"><label class="req">Objetivo (R$)</label><input class="num" name="valor_alvo" inputmode="decimal" value="${valorInput(m?.valor_alvo ?? '')}" required></div>
        <div class="f"><label>Até (prazo)</label><input type="month" name="data_alvo" value="${m?.data_alvo ? m.data_alvo.slice(0, 7) : ''}"></div></div>
      <div class="f"><label>Acompanhar pelo saldo da conta</label><select name="conta_id"><option value="">— informar manualmente —</option>${S.contas.map(c => `<option value="${c.id}" ${m?.conta_id === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="f" id="fManual"><label>Valor já guardado (R$)</label><input class="num" name="valor_atual" inputmode="decimal" value="${valorInput(m?.valor_atual ?? 0)}"></div>`,
    extra: m ? `<button type="button" class="btn danger" id="btnDel">Excluir</button>` : '',
    onOpen: form => {
      const sync = () => { $('#fManual', form).style.display = form.elements.conta_id.value ? 'none' : ''; };
      form.elements.conta_id.addEventListener('change', sync); sync();
      $('#btnDel', form.closest('.overlay'))?.addEventListener('click', async () => { if (!await confirmar('Excluir meta', `Excluir a meta “${esc(m.nome)}”?`)) return; fecharModal(); await excluir('metas', m.id, 'Meta excluída'); await recarregarERender(['metas']); });
    },
    onSubmit: async form => {
      const nome = v(form, 'nome').trim(), alvo = parseValor(v(form, 'valor_alvo')), atual = parseValor(v(form, 'valor_atual') || '0');
      if (!nome) return 'Informe o nome.';
      if (!(alvo > 0)) return 'Informe o objetivo.';
      const da = v(form, 'data_alvo');
      await salvar('metas', { nome, valor_alvo: alvo, valor_atual: isNaN(atual) ? 0 : atual, data_alvo: da ? dataNoMes(da, 31) : null, cor: v(form, 'cor'), conta_id: v(form, 'conta_id') || null }, m?.id, 'Meta salva');
      await recarregarERender(['metas']);
    },
  });
}
function formAporte(m, sinal) {
  modal({
    titulo: sinal > 0 ? `Guardar em “${m.nome}”` : `Retirar de “${m.nome}”`, ok: sinal > 0 ? 'Guardar' : 'Retirar',
    corpo: `<div class="f"><label class="req">Valor (R$)</label><input class="num" name="valor" inputmode="decimal" placeholder="0,00" required></div>`,
    onSubmit: async form => {
      const val = parseValor(v(form, 'valor')); if (!(val > 0)) return 'Informe um valor maior que zero.';
      await salvar('metas', { valor_atual: Math.max(0, num(m.valor_atual) + sinal * val) }, m.id, 'Meta atualizada');
      await recarregarERender(['metas']);
    },
  });
}

/* =====================================================================
   BUSCA GLOBAL, CALCULADORA, PERSONALIZAÇÃO
   ===================================================================== */
function buscaGlobal() {
  modal({
    titulo: 'Buscar lançamentos', largo: true, rodape: '',
    corpo: `<div class="f"><input name="q" placeholder="Descrição, categoria, valor, observação, titular…" autofocus autocomplete="off"></div><div id="resBusca"></div>`,
    onOpen: form => {
      const go = () => {
        const q = semAcento(form.elements.q.value);
        if (q.length < 2) { $('#resBusca', form).innerHTML = '<p class="muted">Digite ao menos 2 letras.</p>'; return; }
        const ls = S.lancamentos.filter(l => semAcento(`${l.descricao} ${l.observacao || ''} ${nomeCat(l.categoria_id)} ${l.criado_por || ''} ${fmtN(l.valor)} ${ondeTexto(l)}`).includes(q))
          .sort((a, b) => a.data < b.data ? 1 : -1).slice(0, 80);
        $('#resBusca', form).innerHTML = ls.length ? ls.map(l => linhaL(l)).join('') : '<p class="muted">Nada encontrado.</p>';
      };
      form.elements.q.addEventListener('input', go); go();
    },
    onSubmit: () => false,
  });
}
function calculadora() {
  if ($('.calc')) return $('.calc').remove();
  const el = document.createElement('div');
  el.className = 'calc';
  let expr = '';
  const keys = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', ',', 'C', '+', '(', ')', '←', '='];
  el.innerHTML = `<div class="disp" id="cDisp">0</div><div class="ks">${keys.map(k => `<button data-k="${k}" class="${/[\/*\-+=]/.test(k) ? 'op' : ''}">${k}</button>`).join('')}</div>
    <div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" data-k="usar" style="flex:1">Lançar despesa</button><button class="btn sm" data-k="fechar">Fechar</button></div>`;
  document.body.appendChild(el);
  const disp = $('#cDisp', el);
  el.addEventListener('click', e => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'fechar') return el.remove();
    if (k === 'C') expr = ''; else if (k === '←') expr = expr.slice(0, -1);
    else if (k === '=') { const r = parseValor(expr); expr = isNaN(r) ? '' : String(r).replace('.', ','); }
    else if (k === 'usar') { const r = parseValor(expr); el.remove(); return formLanc(null, { tipo: 'despesa', valor: isNaN(r) ? '' : r }); }
    else expr += k;
    disp.textContent = expr || '0';
  });
}
function personalizar() {
  const oc = widgetsOcultos();
  modal({
    titulo: 'Personalizar visão geral',
    corpo: `<p class="muted" style="margin-top:0">Escolha os quadros exibidos (vale para este aparelho).</p>${WIDGETS.filter(w => !w[3] || recurso(w[3])).map(w => `<label class="inline"><input type="checkbox" name="w" value="${w[0]}" ${oc.includes(w[0]) ? '' : 'checked'}>${w[1]}</label>`).join('')}`,
    onSubmit: form => { const on = [...form.querySelectorAll('input[name=w]:checked')].map(x => x.value); lsSet('nc_widgets_ocultos', JSON.stringify(WIDGETS.map(w => w[0]).filter(k => !on.includes(k)))); render(); },
  });
}
