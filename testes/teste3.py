import pathlib, re, datetime
from playwright.sync_api import sync_playwright

T = pathlib.Path(__file__).parent
HTML = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').read_text()
MOCK = (T / 'mock3.js').read_text()
CHART = (T / 'node_modules/chart.js/dist/chart.umd.js').read_text()
SHOT = T / 'capturas'
SHOT.mkdir(exist_ok=True)
erros = []
hoje = datetime.date.today()
def d(delta): return (hoje + datetime.timedelta(days=delta)).isoformat()
def mes(n):
    y, m = hoje.year, hoje.month + n
    while m > 12: m -= 12; y += 1
    while m < 1: m += 12; y -= 1
    return f'{y}-{m:02d}'

def rota(route):
    u = route.request.url
    if u.startswith('https://site.local'): return route.fulfill(body=HTML, content_type='text/html')
    if 'supabase-js' in u: return route.fulfill(body=MOCK, content_type='application/javascript')
    if 'Chart.js' in u or 'chart.umd' in u: return route.fulfill(body=CHART, content_type='application/javascript')
    return route.abort()

def ok(c, m):
    print(('OK   ' if c else 'FALHA') + ' ' + m)
    if not c: erros.append(m)

OFX = f"""OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>{d(-3).replace('-','')}120000<TRNAMT>-45.90<FITID>A1<MEMO>PADARIA PAO QUENTE
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>{d(-2).replace('-','')}<TRNAMT>300.00<FITID>A2<MEMO>PIX RECEBIDO JOAO
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>{d(-1).replace('-','')}<TRNAMT>-120,00<FITID>A3<MEMO>SUPERMERCADO EPA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"""
(T / 'extrato.ofx').write_text(OFX)
CSV = "Data;Lançamento;Valor\n" + f"{hoje.strftime('%d/%m/%Y')};POSTO SHELL;-200,50\n{hoje.strftime('%d/%m/%Y')};NETFLIX;-55,90\n"
(T / 'fatura.csv').write_text(CSV, encoding='utf-8')

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1400, 'height': 900})
    ctx.add_init_script("localStorage.setItem('mock_usuario','casal@x.com')")
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: erros.append('JS: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and erros.append('console: ' + m.text))
    pg.route('**/*', rota)
    pg.goto('https://site.local/nosso-caixa/')
    pg.wait_for_selector('#fLogin')
    pg.fill('#lEmail', 'casal@x.com'); pg.fill('#lSenha', 'certa'); pg.click('#fLogin button[type=submit]')
    pg.wait_for_selector('#view')
    ok(pg.evaluate('S.categorias.length') == 46, 'categorias iniciais criadas (%d)' % pg.evaluate('S.categorias.length'))
    ok(pg.evaluate("S.categorias.filter(c=>c.parent_id).length") == 12, 'subcategorias criadas')
    ok(pg.evaluate("nomeCat(S.categorias.find(c=>c.nome==='IOF'&&c.parent_id).id)") == 'Investimentos/IOF', 'nome hierárquico Investimentos/IOF')
    M = '.overlay form '
    def salvar(): pg.click(M + 'button[type=submit]'); pg.wait_for_selector('.overlay', state='detached', timeout=5000)
    def acao(js): pg.evaluate(js); pg.wait_for_timeout(150)

    # cadastros: contas e cartão
    acao("formConta()"); pg.fill(M + '[name=nome]', 'Bradesco'); pg.fill(M + '[name=saldo_inicial]', '1.000,00'); salvar()
    acao("formConta()"); pg.fill(M + '[name=nome]', 'Fundo de Emergência'); pg.select_option(M + '[name=tipo]', 'poupanca'); salvar()
    brad = pg.evaluate("S.contas.find(c=>c.nome==='Bradesco').id"); fundo = pg.evaluate("S.contas.find(c=>c.nome!=='Bradesco').id")
    acao("formCartao()"); pg.fill(M + '[name=nome]', 'Visa'); pg.fill(M + '[name=limite]', '33.580'); pg.fill(M + '[name=dia_fechamento]', '10'); pg.fill(M + '[name=dia_vencimento]', '20')
    pg.select_option(M + '[name=conta_id]', brad); pg.fill(M + '[name=titulares]', 'Ana Exemplo, Beto Exemplo'); salvar()
    visa = pg.evaluate("S.cartoes[0].id")
    ok(pg.evaluate("S.cartoes[0].titulares.length") == 2, 'titulares do cartão')
    acao("formTag()"); pg.fill(M + '[name=nome]', 'Viagem'); salvar()
    # regra de preenchimento
    acao("formRegra(null,'despesa')"); pg.fill(M + '[name=descricao]', 'Supermercado'); pg.fill(M + '[name=palavras]', 'epa, carrefour')
    pg.select_option(M + '[name=categoria_id]', label='Supermercado'); salvar()
    ok(pg.evaluate("S.regras.length") == 1, 'regra criada')

    def novo(tipo='despesa', valor='10', desc='x', data=None, onde=None, cat=None, rep=None, parc=None, pago=True, titular=None):
        acao(f"formLanc(null,{{tipo:'{tipo}'}})")
        pg.fill(M + '[name=valor]', valor); pg.fill(M + '[name=data]', data or d(0)); pg.dispatch_event(M + '[name=data]', 'change')
        if onde: pg.select_option(M + '[name=onde]', onde)
        pg.fill(M + '[name=descricao]', desc); pg.dispatch_event(M + '[name=descricao]', 'change')
        if cat: pg.select_option(M + '[name=categoria_id]', label=cat)
        if titular is not None: pg.fill(M + '[name=titular]', titular)
        if rep: pg.select_option(M + '[name=repeticao]', rep)
        if parc: pg.fill(M + '[name=parcelas]', str(parc))
        if not pago: pg.click('.overlay [data-tog=pago]')
        salvar()

    novo(valor='150,50', desc='Feira', onde='conta:' + brad, cat='Supermercado')
    novo('receita', '5.000,00', 'Salário Ana', onde='conta:' + brad, cat='Pró-labore', rep='fixa')
    ok(pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Salário Ana').length") == 25, 'receita fixa gera 25 meses')
    novo(valor='240', desc='Aulas Clarisse', data=d(-3), onde='conta:' + brad, cat='Educação', pago=False)
    novo(valor='300', desc='Bolo', data=d(5), onde='conta:' + brad, cat='Festas', pago=False)
    novo(valor='1.200', desc='Celular', onde='cartao:' + visa, cat='Telefonia', rep='parcelada', parc=12, titular='Beto Exemplo')
    cel = pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Celular').sort((a,b)=>a.parcela-b.parcela)")
    ok(len(cel) == 12 and cel[0]['valor'] == 100 and cel[0]['criado_por'].startswith('Beto'), 'compra parcelada 12x no cartão com titular')
    ok(cel[1]['fatura_mes'][:7] > cel[0]['fatura_mes'][:7], 'parcelas em faturas seguidas')
    # regra preenche categoria por palavra alternativa
    acao("formLanc(null,{tipo:'despesa'})"); pg.fill(M + '[name=valor]', '80'); pg.fill(M + '[name=descricao]', 'EPA Savassi'); pg.dispatch_event(M + '[name=descricao]', 'change')
    ok(pg.eval_on_selector(M + '[name=categoria_id]', 'e=>e.options[e.selectedIndex].text').strip().endswith('Supermercado'), 'regra preencheu categoria')
    salvar()
    # transferência
    acao("formLanc(null,{tipo:'transferencia'})"); pg.fill(M + '[name=valor]', '200'); pg.select_option(M + '[name=de]', brad); pg.select_option(M + '[name=para]', fundo); salvar()
    # valor com conta (calculadora)
    acao("formLanc(null,{tipo:'despesa'})"); pg.fill(M + '[name=valor]', '10,50+4,50'); pg.dispatch_event(M + '[name=valor]', 'change')
    ok(pg.input_value(M + '[name=valor]') == '15,00', 'valor aceita conta 10,50+4,50')
    pg.fill(M + '[name=descricao]', 'Padaria'); pg.select_option(M + '[name=categoria_id]', label='Restaurantes/Lanches')
    pg.click('.overlay form .tagsel label'); salvar()
    ok(len(pg.evaluate("S.lancamentos.find(l=>l.descricao==='Padaria').tags")) == 1, 'tag no lançamento')
    # lançamento detalhado
    acao("formLanc(null,{tipo:'detalhado'})")
    pg.fill(M + '[data-det-v="0"]', '50'); pg.dispatch_event(M + '[data-det-v="0"]', 'input'); pg.select_option(M + '[data-det-cat="0"]', label='Supermercado'); pg.dispatch_event(M + '[data-det-cat="0"]', 'change')
    pg.fill(M + '[data-det-v="1"]', '30'); pg.dispatch_event(M + '[data-det-v="1"]', 'input'); pg.select_option(M + '[data-det-cat="1"]', label='    ↳ IOF'); pg.dispatch_event(M + '[data-det-cat="1"]', 'change')
    ok(pg.input_value(M + '[name=valor]') == '80,00', 'detalhado soma 80,00')
    pg.fill(M + '[name=descricao]', 'Compras Carrefour'); salvar()
    ok(pg.evaluate("S.lancamentos.filter(l=>l.serie==='detalhado').length") == 2, 'detalhado gera 2 lançamentos')
    # anexo
    acao("formLanc(S.lancamentos.find(l=>l.descricao==='Feira'))")
    pg.set_input_files('.overlay #fAnexo', files=[{'name': 'nota fiscal.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 teste'}])
    salvar()
    ok(len(pg.evaluate("S.lancamentos.find(l=>l.descricao==='Feira').anexos")) == 1, 'anexo salvo no lançamento')

    # telas
    for v in ['visao', 'lancamentos', 'fluxo', 'pagar', 'pagas', 'extrato', 'cartoes', 'orcamento', 'economia', 'relatorios', 'categorias', 'contas', 'tags', 'documentos', 'regras', 'importar', 'fechamento', 'config']:
        pg.evaluate(f"irPara('{v}')"); pg.wait_for_timeout(350)
        ok(len(pg.inner_text('#view')) > 30, 'tela ' + v)
        pg.screenshot(path=str(SHOT / f'{v}.png'), full_page=True)
    pg.evaluate("irPara('visao')"); pg.wait_for_timeout(300)
    txt = pg.inner_text('#view')
    for w in ['Saldos de caixa', 'Resultado do mês', 'Resultados de caixa', 'Despesas por categoria', 'Receitas por categoria', 'Balanço patrimonial', 'Contas a receber', 'Contas a pagar', 'Últimos lançamentos', 'Cartões de crédito', 'Fluxo de caixa']:
        ok(w in txt, 'visão geral tem ' + w)
    ok('Aulas Clarisse' in txt, 'pendência atrasada em contas a pagar')
    # saldo confirmado e projetado
    conf = pg.evaluate(f"saldoConta('{brad}', {{ate: fimMes(S.mes)}})")
    ok(abs(conf - (1000 - 150.5 + 5000 - 200)) < 0.01, f'saldo confirmado Bradesco {conf}')
    # status: confirmar pendente
    lid = pg.evaluate("S.lancamentos.find(l=>l.descricao==='Aulas Clarisse').id")
    pg.click(f'#w_pagar [data-act=togglePago][data-id="{lid}"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate(f"S.lancamentos.find(l=>l.id==='{lid}').pago") is True, 'confirmar pagamento pelo ícone')
    # filtro de status na lista
    pg.evaluate("irPara('lancamentos')"); pg.click('[data-act=status][data-s=agendado]'); pg.wait_for_timeout(200)
    ok(pg.locator('#view .lrow').count() >= 1 and 'Bolo' in pg.inner_text('#view'), 'filtro Agendados')
    pg.click('[data-act=status][data-s=agendado]')
    # menu de contexto -> conciliar
    pg.click(f'#view [data-act=lancMenu]'); pg.click('.cmenu button:has-text("conciliado")'); pg.wait_for_timeout(300)
    ok(pg.evaluate("S.lancamentos.some(l=>l.conciliado)"), 'conciliar pelo menu')

    # cartões: fatura, pagamento, antecipar, fechar
    pg.evaluate(f"S.cartaoSel='{visa}'; irPara('cartoes')"); pg.wait_for_timeout(200)
    fy = pg.evaluate(f"fatMes(S.lancamentos.find(l=>l.descricao==='Celular'&&l.parcela===1))")
    pg.evaluate(f"S.faturaSel['{visa}']='{fy}'; render()")
    ok('Beto Exemplo' in pg.inner_text('#view'), 'totais por titular')
    pg.click('[data-act=antecipar]'); pg.click('.overlay input[name=ant]'); salvar()
    ok(pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Celular'&&fatMes(l)==='"+fy+"').length") == 2, 'antecipar parcela traz para a fatura')
    pg.click('[data-act=pagarFatura]'); salvar()
    ok(pg.evaluate(f"faturaInfo(S.cartoes[0], '{fy}').pagamentos.length") == 1, 'pagamento da fatura lançado')
    pg.click('[data-act=fecharFatura]'); pg.wait_for_timeout(300)
    ok(fy in pg.evaluate("S.cartoes[0].faturas_fechadas"), 'fechar fatura')
    pg.screenshot(path=str(SHOT / 'cartoes2.png'), full_page=True)

    # orçamento
    pg.evaluate("S.mes=ymHoje(); irPara('orcamento')"); pg.click('#view [data-act=definirMetas] >> nth=0')
    sup = pg.evaluate("S.categorias.find(c=>c.nome==='Supermercado').id")
    pg.fill(f'.overlay input[name="m_{sup}"]', '1.500'); pg.select_option('.overlay select[name=rep]', '2'); salvar()
    ok(pg.evaluate("S.orcamentos.length") == 3, 'metas de despesa em 3 meses')
    ok('Supermercado' in pg.inner_text('#view'), 'tela de orçamento mostra meta')
    pg.screenshot(path=str(SHOT / 'orcamento2.png'), full_page=True)
    # economia ligada à conta
    acao("formMeta()"); pg.fill(M + '[name=nome]', 'Fundo de reserva'); pg.fill(M + '[name=valor_alvo]', '20.000'); pg.fill(M + '[name=data_alvo]', mes(10)); pg.select_option(M + '[name=conta_id]', fundo); salvar()
    st = pg.evaluate("statusMeta(S.metas[0])")
    ok(st['atual'] == 200 and st['ideal'] == round((20000 - 200) / 10, 2), f'meta de economia pelo saldo da conta ({st})')
    pg.evaluate("irPara('economia')"); pg.screenshot(path=str(SHOT / 'economia2.png'), full_page=True)

    # relatórios
    for k in ['balanco', 'evobalanco', 'evometas', 'fluxo', 'lanccaixa', 'apagar', 'areceber', 'pagas', 'recebidas', 'totaiscat', 'evocat', 'comparacao', 'lanccat']:
        pg.evaluate(f"S.relatorio='{k}'; irPara('relatorios')"); pg.wait_for_timeout(250)
        ok(len(pg.inner_text('#view')) > 80, 'relatório ' + k)
    pg.evaluate("S.relatorio='totaiscat'; render()"); pg.screenshot(path=str(SHOT / 'rel-totaiscat.png'), full_page=True)
    pg.evaluate("S.relatorio=null")

    # importar OFX (e detectar repetidos)
    pg.evaluate("irPara('importar')"); pg.select_option('[data-imp=destino]', 'conta:' + brad); pg.wait_for_timeout(200)
    pg.set_input_files('[data-act=impArquivo]', str(T / 'extrato.ofx')); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.imp.linhas.length") == 3, 'OFX lido (3 lançamentos)')
    ok(pg.evaluate("S.categorias.find(c=>c.id===S.imp.linhas[2].cat)?.nome") == 'Supermercado', 'regra sugere categoria na importação')
    pg.screenshot(path=str(SHOT / 'importar2.png'), full_page=True)
    pg.click('[data-act=impConfirmar]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.lancamentos.filter(l=>l.ext_id).length") == 3, 'importação gravou 3 lançamentos')
    pg.set_input_files('[data-act=impArquivo]', str(T / 'extrato.ofx')); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.imp.linhas.every(x=>x.dup && !x.sel)"), 'reimportação detecta repetidos')
    pg.click('[data-act=impLimpar]')
    pg.select_option('[data-imp=destino]', 'cartao:' + visa); pg.wait_for_timeout(200)
    pg.set_input_files('[data-act=impArquivo]', str(T / 'fatura.csv')); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.imp.linhas.length") == 2 and pg.evaluate("S.imp.linhas[0].valor") == -200.5, 'CSV lido com colunas detectadas')
    pg.click('[data-act=impConfirmar]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.lancamentos.filter(l=>l.descricao==='NETFLIX'&&l.cartao_id).length") == 1, 'CSV importado no cartão')

    # fechamento de posição
    pg.evaluate("irPara('fechamento')"); pg.fill('#dataFech', d(-1)); pg.check(f'[data-fech="conta:{brad}"]'); pg.click('[data-act=fecharPos]'); pg.wait_for_timeout(400)
    ok(pg.evaluate(f"byId('contas','{brad}').fechado_ate") == d(-1), 'fechar posição da conta')
    old = pg.evaluate("S.lancamentos.find(l=>l.descricao==='Aulas Clarisse')")
    pg.evaluate(f"alternarPago(byId('lancamentos','{old['id']}'))"); pg.wait_for_timeout(300)
    ok(pg.evaluate(f"byId('lancamentos','{old['id']}').pago") is True, 'lançamento em período fechado fica bloqueado')
    acao("formLanc(null,{tipo:'despesa'})"); pg.fill(M + '[name=valor]', '5'); pg.fill(M + '[name=data]', d(-2)); pg.dispatch_event(M + '[name=data]', 'change'); pg.select_option(M + '[name=onde]', 'conta:' + brad)
    pg.select_option(M + '[name=categoria_id]', label='Lazer'); pg.click(M + 'button[type=submit]'); pg.wait_for_timeout(300)
    ok('Período fechado' in pg.inner_text('#mErr'), 'formulário recusa data fechada')
    pg.keyboard.press('Escape')

    # documentos e configurações
    pg.evaluate("irPara('documentos')"); pg.wait_for_timeout(500)
    ok('nota' in pg.inner_text('#view'), 'documento listado')
    pg.evaluate("irPara('config')"); pg.click('label.sw:has([data-recurso=tags]) span'); pg.wait_for_timeout(400)
    ok(pg.locator('#nav [data-nav=tags]').count() == 0, 'desligar recurso Tags esconde o menu')
    pg.click('label.sw:has([data-recurso=tags]) span'); pg.wait_for_timeout(300)
    # busca global e calculadora
    pg.click('[data-act=buscaGlobal]'); pg.fill('.overlay input[name=q]', 'celular'); pg.wait_for_timeout(200)
    ok(pg.locator('.overlay .lrow').count() == 12, 'busca global encontra as 12 parcelas')
    pg.keyboard.press('Escape')
    # excluir série "este e os próximos" em fixa
    sal = pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Salário Ana').sort((a,b)=>a.data<b.data?-1:1)[3].id")
    pg.evaluate(f"setTimeout(()=>apagarLanc(byId('lancamentos','{sal}')))"); pg.wait_for_selector('.overlay button:has-text("Este e os próximos")'); pg.click('.overlay button:has-text("Este e os próximos")'); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Salário Ana').length") == 3, 'excluir este e os próximos encerra a série fixa')
    pg.evaluate("estenderFixas()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("S.lancamentos.filter(l=>l.descricao==='Salário Ana').length") == 3, 'série encerrada não é recriada')

    # celular
    st = ctx.storage_state()
    m = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, storage_state=st).new_page()
    m.on('pageerror', lambda e: erros.append('JS mobile: ' + str(e)))
    m.route('**/*', rota)
    m.goto('https://site.local/nosso-caixa/#visao'); m.wait_for_selector('#view .card'); m.wait_for_timeout(500)
    for v in ['visao', 'lancamentos', 'cartoes', 'extrato']:
        m.evaluate(f"irPara('{v}')"); m.wait_for_timeout(300)
        sw = m.evaluate('document.documentElement.scrollWidth'); ok(sw <= 392, f'celular sem rolagem lateral em {v} ({sw})')
        m.screenshot(path=str(SHOT / f'm-{v}.png'), full_page=False)
    m.click('.fab.main'); m.wait_for_timeout(300); m.screenshot(path=str(SHOT / 'm-fab.png'))
    m.click('.fab.main'); m.wait_for_selector('.overlay'); m.wait_for_timeout(300); m.screenshot(path=str(SHOT / 'm-form.png'))
    dk = br.new_context(viewport={'width': 1400, 'height': 900}, storage_state=st, color_scheme='dark').new_page(); dk.route('**/*', rota)
    dk.goto('https://site.local/nosso-caixa/#visao'); dk.wait_for_selector('#view .card'); dk.wait_for_timeout(600); dk.screenshot(path=str(SHOT / 'escuro.png'), full_page=True)
    br.close()
print('\nERROS:', erros or 'nenhum')
