# dois aparelhos abertos ao mesmo tempo: um não pode apagar a preferência que o outro gravou
import pathlib
exec(open(pathlib.Path(__file__).parent/'teste3.py').read().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1400, 'height': 900})
    ctx.add_init_script("localStorage.setItem('mock_usuario','casal@x.com')")
    def abrir():
        pg = ctx.new_page(); pg.on('pageerror', lambda e: erros.append('JS: ' + str(e)))
        pg.route('**/*', rota); pg.goto('https://site.local/nosso-caixa/'); pg.wait_for_selector('#fLogin, #view')
        if pg.locator('#fLogin').count():
            pg.fill('#lEmail', 'casal@x.com'); pg.fill('#lSenha', 'certa'); pg.click('#fLogin button[type=submit]')
        pg.wait_for_selector('#view'); pg.wait_for_timeout(300); return pg
    banco = lambda pg: pg.evaluate("JSON.parse(localStorage.getItem('mockdb')).preferencias[0].dados")
    a = abrir()
    a.evaluate("(async()=>{ S.prefs.limpeza_2026={antes:{x:1}}; S.prefs.velha=1; await salvarPrefs(); })()"); a.wait_for_timeout(300)
    b = abrir()   # outro aparelho, aberto depois
    a.evaluate("(async()=>{ S.prefs.alerta_saldo=500; await salvarPrefs(); })()"); a.wait_for_timeout(300)        # A muda uma chave
    b.evaluate("(async()=>{ delete S.prefs.limpeza_2026; delete S.prefs.velha; S.prefs.conta_principal='c1'; await salvarPrefs(); })()"); b.wait_for_timeout(300)
    d = banco(b)
    ok(d.get('alerta_saldo') == 500, 'B (desatualizado) não desfaz o que A gravou')
    ok('limpeza_2026' not in d and 'velha' not in d and d.get('conta_principal') == 'c1', 'chaves apagadas em B somem e a nova entra')
    a.evaluate("(async()=>{ S.prefs.recursos={...(S.prefs.recursos||{}), tags:false}; await salvarPrefs(); })()"); a.wait_for_timeout(300)  # A ainda tem limpeza_2026 em memória
    d = banco(a)
    ok('limpeza_2026' not in d and 'velha' not in d, 'A (com cópia velha) não ressuscita as chaves apagadas')
    ok(d.get('conta_principal') == 'c1' and d.get('alerta_saldo') == 500 and d['recursos']['tags'] is False, 'as três mudanças convivem')
    ok(a.evaluate("S.prefs.conta_principal") == 'c1', 'A passa a enxergar o que B gravou')
    print('ERROS:', erros or 'nenhum')
