# categorização: regra mais específica vence, sem depender da ordem; histórico da importação ignora previsões futuras
import pathlib
exec(open(pathlib.Path(__file__).parent/'teste3.py').read().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900})
    ctx.add_init_script("localStorage.setItem('mock_usuario','casal@x.com')")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: erros.append('JS: ' + str(e)))
    pg.route('**/*', rota); pg.goto('https://site.local/nosso-caixa/'); pg.wait_for_selector('#fLogin')
    pg.fill('#lEmail', 'casal@x.com'); pg.fill('#lSenha', 'certa'); pg.click('#fLogin button[type=submit]'); pg.wait_for_selector('#view')
    R = """[{id:'r2',tipo:'despesa',descricao:'Uber',palavras:'uber',categoria_id:'T'},
            {id:'r1',tipo:'despesa',descricao:'Uber Eats',palavras:'uber eats',categoria_id:'C'},
            {id:'r4',tipo:'despesa',descricao:'Posto',palavras:'shell',categoria_id:'X'},
            {id:'r3',tipo:'despesa',descricao:'Combustivel',palavras:'shell',categoria_id:'Y'},
            {id:'r5',tipo:'despesa',descricao:'Netflix',palavras:'',categoria_id:'N'}]"""
    q = lambda d, rs=R: pg.evaluate(f"regraPara({d!r}, 'despesa', {rs})?.categoria_id || null")
    ok(q('UBER EATS PEDIDO') == 'C', 'palavra mais longa vence')
    ok(q('UBER EATS PEDIDO', R.replace("[{id:'r2'", "[{id:'r2'")[::1]) == 'C' and pg.evaluate(f"regraPara('UBER EATS PEDIDO','despesa',{R}.reverse())?.categoria_id") == 'C', 'a ordem das regras não muda o resultado')
    ok(q('POSTO SHELL BH') == 'Y' and pg.evaluate(f"regraPara('POSTO SHELL BH','despesa',{R}.reverse())?.categoria_id") == 'Y', 'empate decidido pelo menor id')
    ok(q('netflix') == 'N' and q('NETFLIX.COM  ASSINATURA') == 'N', 'descrição exata e trecho com espaços repetidos')
    ok(q('PADARIA') is None, 'sem regra: nada')
    # histórico da importação: o mais recente até hoje vale; previsão futura com outra categoria não
    pg.evaluate("""(async()=>{ await salvar('contas',{nome:'Banco',tipo:'corrente',saldo_inicial:0}); await carregar();
      const c=S.contas[0].id, cat=n=>S.categorias.find(x=>x.nome===n&&!x.parent_id).id;
      await salvar('lancamentos',{tipo:'despesa',descricao:'PADARIA DO ZE',valor:5,data:'2026-01-10',conta_id:c,categoria_id:cat('Lazer'),pago:true});
      await salvar('lancamentos',{tipo:'despesa',descricao:'PADARIA DO ZE',valor:5,data:'2026-02-10',conta_id:c,categoria_id:cat('Supermercado'),pago:true});
      await salvar('lancamentos',{tipo:'despesa',descricao:'PADARIA DO ZE',valor:5,data:'2099-01-10',conta_id:c,categoria_id:cat('Saúde'),pago:false});
      await carregar(); S.imp={destino:'conta:'+c,inverter:false}; prepararLinhas([{data:'2026-03-01',valor:-7,desc:'PADARIA DO ZE'}]); })()""")
    pg.wait_for_timeout(300)
    ok(pg.evaluate("S.categorias.find(x=>x.id===S.imp.linhas[0].cat)?.nome") == 'Supermercado', 'importação aprende com o mais recente até hoje, não com o futuro')
    print('ERROS:', erros or 'nenhum')
