# Código-fonte do Nosso Caixa

O site publicado é o `index.html` da raiz do repositório (GitHub Pages).
Ele é gerado a partir desta pasta:

- `src/` — partes do site (regras em `01-core.js`, telas, `11-openfinance.js`, `style.css`).
- `build.py` — junta `src/` + `schema.sql` no `index.html`. Rode `python3 build.py`
  dentro desta pasta e copie o `index.html` gerado para a raiz do repositório.
- `schema.sql` — estrutura completa do banco (Supabase), inclui o Open Finance.
- `sql_v4_openfinance.sql` — só a parte do Open Finance (cofre da chave e agendamento).
- `supabase/functions/pluggy-sync/index.ts` — função de sincronização com a Pluggy.
  A versão em uso fica no Supabase (Edge Functions → pluggy-sync), com "Verify JWT" desligado.

Nenhuma senha ou chave secreta está neste código: a chave da Pluggy fica só no
cofre do banco de dados, e a chave do Supabase embutida no site é a pública (publishable).
