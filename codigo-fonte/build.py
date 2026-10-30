#!/usr/bin/env python3
"""Monta o index.html do Nosso Caixa a partir de src/."""
import pathlib
R = pathlib.Path(__file__).parent
src = R / 'src'
ordem = ['00-config.js', '01-core.js', '02-ui.js', '03-caixa.js', '04-cartoes-metas.js', '05-relatorios.js',
         '06-cadastros.js', '07-importar.js', '08-forms.js', '10-acesso.js', '09-eventos.js', '11-openfinance.js']
js = '\n'.join((src / f).read_text() for f in ordem)
sql = (R / 'schema.sql').read_text()
sqlof = (R / 'sql_v4_openfinance.sql').read_text()
assert '</script' not in sql and '</script' not in js
html = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1cc7a0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Nosso Caixa">
<title>Nosso Caixa</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231cc7a0'/%3E%3Ctext x='32' y='42' font-family='Arial' font-weight='700' font-size='26' fill='white' text-anchor='middle'%3ENC%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
{(src / 'style.css').read_text()}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="sqlSchema">
{sql}</script>
<script type="text/plain" id="sqlOF">
{sqlof}</script>
<script>
{js}
</script>
</body>
</html>
'''
(R / 'index.html').write_text(html)
print('index.html', len(html) // 1024, 'KB')
