# AGENTS.md · regras para agentes de IA (Claude, Codex e outros)

Leia isto antes de mexer em qualquer coisa. Atualizado em 17/11/2026.

## O que é

O Nosso Caixa é o controle financeiro de um casal: um site estático (GitHub Pages) que fala com um projeto Supabase, com Open Finance pela Pluggy e um resumo pelo Telegram às 8h e às 18h. Os usuários falam português do Brasil: responda e documente em português.

- Site: https://brunnocoe-cloud.github.io/nosso-caixa/
- Repositório (**cópia oficial**): `brunnocoe-cloud/nosso-caixa`, **público**.
- Supabase: projeto `cuhrhtkwfuwgsvsdrkng` (banco, RLS, pg_cron, Edge Function `pluggy-sync`).

**Não existe outro projeto relacionado.** O antigo "Fôlego" (React, Render, Neon, banco local em `localhost:5432/folego`) foi abandonado em 21/09/2026 e apagado em 17/11/2026, com repositórios e backups. Se encontrar algum resto dele, ignore e avise.

Cópias que **não** são a oficial e podem estar velhas: a pasta `Documents\Nosso Caixa` no computador do dono e clones em ambientes de IA. Antes de editar, compare com o GitHub (`git fetch && git status`).

## Onde está cada coisa

| Caminho | O que é |
|---|---|
| `index.html` (raiz) | Site publicado. **Gerado**; não edite à mão. |
| `codigo-fonte/src/` | Código do site, em partes numeradas, juntadas na ordem da lista `ordem` do `build.py`. |
| `codigo-fonte/build.py` | Monta o `index.html` e o `schema.sql`. Rode dentro de `codigo-fonte/`. |
| `codigo-fonte/schema_base.sql`, `sql_v4_openfinance.sql` | SQL do banco. `schema.sql` é gerado. |
| `codigo-fonte/supabase/functions/pluggy-sync/index.ts` | Edge Function: sincronização, previsão de faturas, Telegram. |
| `codigo-fonte/supabase/config.toml` | Mantém o **Verificar JWT** desligado. |
| `codigo-fonte/ARQUITETURA.md` | Como o sistema funciona por dentro, **defeitos conhecidos** (§6.1) e riscos. Leia antes de mudar a sincronização. |
| `codigo-fonte/COMO-USAR.md` | Passos de build e publicação. |
| `codigo-fonte/LEIA-ME.md` | Manual para quem usa o site. |
| `testes/` | Testes de navegador (Playwright + Supabase simulado). Ver `testes/LEIA-ME.md`. |

Configuração que **só existe no Supabase** (não está no repositório): o conteúdo de `privado.config` (chaves da Pluggy, token do bot, segredos), os agendamentos já criados no pg_cron, a linha de `preferencias` (inclui `limpeza_regras` e `limpeza_2026`) e os dados.

## Como publicar

1. Edite em `codigo-fonte/`. Arquivo novo em `src/` entra na lista `ordem` do `build.py`.
2. `cd codigo-fonte && python3 build.py`.
3. Rode os testes (`testes/LEIA-ME.md`).
4. Commit e push para `main`; o GitHub Pages publica sozinho. **Só faça push quando o dono do repositório pedir.**
5. Se mudou a função: publique com `supabase functions deploy pluggy-sync --no-verify-jwt`, ou cole o `index.ts` no editor da função no painel do Supabase. Sem `--no-verify-jwt`, a sincronização agendada e o bot param.
6. Se mudou o banco: rode o SQL novo no SQL Editor do Supabase. Mudança que não pode rodar duas vezes vai num arquivo de migração separado, não no `sql_v4_openfinance.sql` (que roda quantas vezes quiser e vai embutido no site).
7. Ordem quando muda mais de uma parte: função → SQL → site, conferindo cada passo.

## Regras obrigatórias

1. **Nada pessoal no repositório público.** Nada de nomes de pessoas, valores, extratos, levantamentos, planilhas, prints com dados ou regras com nomes de lojas e pessoas. Isso fica no banco (`preferencias`) ou na pasta privada `Documents\Nosso Caixa\privado` do computador do dono. Antes de cada commit: `git diff --cached` e procure nomes e valores. Em 16/11/2026 um commit vazou dados e o histórico teve de ser reescrito.
2. **Nenhuma senha, chave ou token** no código, em commits ou em mensagens. A chave do Supabase no site é a pública; as secretas ficam em `privado.config`. Agente não digita senha: o dono faz login.
3. **Não remova o gatilho `limitar_um_usuario`.** A chave da Pluggy e o bot valem para o banco inteiro.
4. **Não revogue nem recrie as conexões da Pluggy / Meu Pluggy** sem pedido explícito: a sincronização depende delas.
5. **Mudanças em dados reais:** primeiro simule (`"simular": true` na função, prévia no site), mostre os números e espere a confirmação do dono. Totais em reais não podem mudar numa recategorização.
6. **Período fechado:** não altere lançamentos com data até a data de fechamento.
7. **Preferências:** grave sempre por `salvarPrefs`/`gravarPrefs` (relê o banco e junta por chave). Nunca faça `update({ dados: S.prefs })` direto.
8. Siga o `ARQUITETURA.md` quando ele e o código concordarem; quando discordarem, vale o código, e corrija o documento no mesmo commit.

## Trabalho pendente (17/11/2026)

Ver ARQUITETURA §6.1. Já feito em 17/11: texto do banco guardado, regra mais segura da fatura pelo valor, `unificar_faturas` removida, índice único `lanc_user_ext_pluggy`, preferências sem perda. Falta: conferir o pagamento da Visa de 20/11/2026; arquivar os cartões antigos (o dono confirma quais); ordem fixa das regras e histórico sem previsões futuras; remover o módulo de limpeza depois da revisão de dezembro.

Migrações SQL de uso único ficam em `codigo-fonte/migracoes/`, com data no nome, e são rodadas à mão no SQL Editor.
