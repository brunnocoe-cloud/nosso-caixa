# Código-fonte do Nosso Caixa

O site publicado é o `index.html` da raiz do repositório (GitHub Pages).
Ele é gerado a partir desta pasta:

- `src/` — partes do site: `00-config.js` (endereço do Supabase e a chave pública),
  `01-core.js` (regras), as telas, `11-openfinance.js`, `12-periodo.js` (filtro **Ver por**) e `style.css`.
- `build.py` — junta `src/`, `schema_base.sql` e `sql_v4_openfinance.sql` no `index.html`
  da raiz do repositório e gera o `schema.sql`. Rode `python3 build.py` dentro desta pasta.
  Arquivo novo em `src/` precisa entrar na lista `ordem`; se faltar, o build para e avisa.
- `schema_base.sql` — tabelas e regras do site (contas, cartões, lançamentos…).
- `sql_v4_openfinance.sql` — a parte do Open Finance e do Telegram (tabela `privado.config` e agendamentos).
- `schema.sql` — gerado pelo `build.py` (base + Open Finance). Não edite à mão.
  O próprio site mostra qual SQL rodar: o completo no primeiro acesso e o do Open Finance na tela **Open Finance**.
- `ARQUITETURA.md` — decisões, funcionamento interno (sincronização, previsão de faturas, agendamentos, cofre, Telegram) e riscos.
- `supabase/functions/pluggy-sync/index.ts` — função de sincronização com a Pluggy e do resumo no Telegram.
- `supabase/config.toml` — deixa o **Verificar JWT** da função desligado. A sincronização agendada e o
  Telegram não mandam login, por isso a função confere por dentro quem está chamando
  (login do site, cabeçalho do agendamento ou segredo do webhook do Telegram).

## Atualizar

1. `python3 build.py` (nesta pasta).
2. Envie as mudanças ao GitHub.
3. Se a função mudou: `supabase functions deploy pluggy-sync --no-verify-jwt`
   (ou cole o `index.ts` no editor da função, no painel do Supabase, e clique em **Implantar atualizações**).
4. Se o banco de dados mudou: rode o `schema.sql` no SQL Editor do Supabase.

## Segurança

- O banco aceita um único login (gatilho `limitar_um_usuario`). Não remova: a chave da Pluggy e o bot do
  Telegram valem para o banco inteiro.
- A chave da Pluggy e o token do Telegram ficam na tabela `privado.config`, que o site não consegue ler
  (só a função, pelo servidor). Ela não é criptografada.
- A chave do Supabase embutida no site é a pública (publishable). Nenhuma senha ou chave secreta está neste código.
- No Telegram, só recebe o resumo quem for liberado na tela **Open Finance**.
