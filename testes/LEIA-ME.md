# Testes do Nosso Caixa

Testes de navegador com Playwright (Python). Eles abrem o `index.html` da raiz com um Supabase simulado (`mock3.js`), sem tocar no banco real. Os dados são fictícios.

## Preparar (uma vez)

```
pip install playwright && python3 -m playwright install chromium
cd testes && npm install        # Chart.js local
```

## Rodar

Depois de `python3 build.py` em `codigo-fonte/`:

```
cd testes
python3 teste3.py      # telas, lançamentos, cartões, saldo, importação, celular e modo escuro
python3 teste_cp.py    # conta principal
python3 teste_of.py    # tela Open Finance e Telegram
python3 teste_per.py   # filtro Ver por
python3 teste_prefs.py # dois aparelhos salvando preferências ao mesmo tempo
python3 teste_regras.py # regra mais específica vence; histórico sem previsões futuras
```

Cada um imprime `OK` ou `FALHA` por item e termina com `ERROS: nenhum` quando tudo passa. As capturas de tela vão para `capturas/` e `v3/`, fora do Git.

O teste da limpeza das categorias não está aqui porque depende das regras privadas (`limpeza_regras`), que têm nomes reais.
