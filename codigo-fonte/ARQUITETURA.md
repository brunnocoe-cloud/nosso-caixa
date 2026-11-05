# Nosso Caixa · Arquitetura e funcionamento interno

Para quem precisar manter o site sem conhecer o histórico. O uso do dia a dia está no `LEIA-ME.md`, e os passos de atualização estão no `COMO-USAR.md`.

## 1. Problema

O casal controlava as finanças no Meu Dinheiro Web, um serviço de terceiros. Os lançamentos do banco e dos cartões eram digitados ou importados à mão, e não havia um resumo diário automático.

## 2. Objetivos

- Ter as mesmas telas, relatórios e categorias do Meu Dinheiro, num site próprio.
- Trazer sozinhos os lançamentos da conta e dos cartões (Open Finance), sem duplicar o que já foi lançado.
- Mandar um resumo no Telegram às 8h e às 18h, e também quando alguém escreve "resumo" para o bot.
- Não ter custo mensal.
- Dois usuários (o casal), num login só, em qualquer aparelho.

**Fora do escopo:** investimentos, Carnê Leão, vários usuários com permissões diferentes e aplicativo de loja (o site funciona no navegador do celular).

## 3. Alternativas consideradas

| Alternativa | Decisão | Motivo |
|---|---|---|
| Continuar no Meu Dinheiro | Descartada | Sem controle sobre o serviço, sem resumo automático e sem acesso direto aos dados. |
| Fôlego (app React com servidor no Render e banco no Neon) | Abandonada em 21/09/2026 | Mais peças para manter. O Render foi apagado. As conexões da Pluggy foram reaproveitadas no Nosso Caixa. |
| Importar OFX à mão | Mantida como reserva | Continua disponível em **Importar lançamentos**, mas exige ação manual. |
| Open Finance pela Pluggy (Meu Pluggy) | Escolhida | Gratuita para uso pessoal e já conectada ao Bradesco e aos cartões. |
| Resumo pelo WhatsApp | Descartada | A API oficial do WhatsApp é paga e exige conta comercial. |
| Resumo pelo Telegram | Escolhida | API de bots gratuita, com envio e recebimento de mensagens. |

## 4. Arquitetura

```
Navegador (index.html, GitHub Pages)
   │  login e dados (chave pública + RLS)
   ▼
Supabase
   ├─ Banco PostgreSQL: tabelas do site, privado.config (cofre), pg_cron e pg_net
   └─ Função pluggy-sync (Edge Function)
         ├─ Pluggy (api.pluggy.ai): contas, transações, faturas
         └─ Telegram (api.telegram.org): envio do resumo e webhook do bot
```

- **Site:** um único `index.html`, montado pelo `build.py` a partir de `src/`. Não tem servidor próprio: fala direto com o Supabase usando a chave pública.
- **Segurança dos dados:** todas as tabelas têm RLS (cada linha pertence a um `user_id`). O gatilho `limitar_um_usuario` impede a criação de um segundo login.
- **Função `pluggy-sync`:** é a única parte que usa a chave de serviço. Ela confere quem chama de três formas:
  - login do site (o JWT é conferido por dentro);
  - cabeçalho `x-nc-cron`, com o segredo guardado no cofre (agendamentos);
  - cabeçalho `x-telegram-bot-api-secret-token` (webhook do Telegram).

  Por isso o **Verificar JWT** do Supabase fica desligado (`supabase/config.toml`).

## 5. Funcionamento interno

### 5.1 Cofre (`privado.config`)

Tabela de chave e valor num esquema fechado ao site (`revoke` para `anon` e `authenticated`). Só a função a lê, por funções `security definer` liberadas apenas para o `service_role`. Os valores não são criptografados.

| Chave | Conteúdo |
|---|---|
| `cron` | Segredo que os agendamentos mandam no cabeçalho `x-nc-cron`. |
| `pluggy_id`, `pluggy_secret` | Client ID e Client Secret da Pluggy (cadastrados na tela **Open Finance**). |
| `telegram_token` | Token do bot, dado pelo BotFather. |
| `telegram_webhook_secret` | Segredo que o Telegram manda em cada mensagem recebida. |
| `telegram_chats` | Conversas que recebem o resumo (lista separada por vírgulas). |
| `telegram_nomes` | Nome e usuário de cada conversa liberada. |
| `telegram_pendentes` | Quem escreveu para o bot e ainda não foi liberado nem recusado. |

Funções do banco usadas pela função: `nc_cron_ok`, `nc_pluggy_cred`, `nc_pluggy_cred_salvar`, `nc_cfg_get`, `nc_cfg_set`, `nc_disparar` e `nc_disparar_pluggy`.

### 5.2 Agendamentos (pg_cron + pg_net)

O pg_cron roda no banco, em horário UTC, e chama a função por HTTP (pg_net) com o cabeçalho `x-nc-cron`.

| Tarefa | UTC | Brasília | O que faz |
|---|---|---|---|
| `nosso-caixa-pluggy` | 3h15, 9h15, 15h15, 21h15 | 0h15, 6h15, 12h15, 18h15 | Sincroniza |
| `nosso-caixa-presync` | 10h50 | 7h50 | Sincroniza antes do resumo da manhã |
| `nosso-caixa-resumo` | 11h00 | 8h00 | Envia o resumo |
| `nosso-caixa-presync-18` | 20h50 | 17h50 | Sincroniza antes do resumo da tarde |
| `nosso-caixa-resumo-18` | 21h00 | 18h00 | Envia o resumo |

Para conferir: `select jobname, schedule from cron.job;` no SQL Editor.

### 5.3 Sincronização

1. **Janela de busca:** a partir da data **Importar lançamentos a partir de** da tela **Open Finance**, limitada aos últimos 120 dias. Nos cartões, o limite é de 85 dias, porque a Pluggy recusa janelas maiores. A busca vai até 45 dias à frente, para pegar parcelas futuras.
2. **Transações:** vêm de `/v2/transactions`, com cursor. A rota antiga `/transactions` foi desativada pela Pluggy.
3. **Lançamento já trazido:** cada lançamento guarda `ext_id = pluggy:<id>`. Se o `ext_id` já existe, não entra de novo.
4. **Conta bancária:**
   - só entram transações confirmadas;
   - um débito com "fatura" ou "cartão" na descrição vira pagamento de fatura do cartão ligado à conta.
5. **Cartão:**
   - compras pendentes entram com a observação "Open Finance (em aberto)", para a fatura atual ficar certa;
   - quando a Pluggy confirma, a observação muda;
   - se a compra some da Pluggy (cancelada), o lançamento em aberto é apagado.
6. **Fatura de cada compra:** usa a data de vencimento da fatura informada pela Pluggy, quando existe. Sem ela, usa o dia de fechamento do cartão (`faturaYM`), pulando as faturas já fechadas.
7. **Conciliação** (ligar a um lançamento já existente em vez de criar outro):
   - **Conta:** mesma conta, mesmo tipo e mesmo valor, até 5 dias de diferença. Prefere o lançamento ainda não pago e o de data mais próxima.
   - **Cartão:** mesmo cartão e mesmo valor, na mesma fatura ou até 4 dias de diferença. Isso cobre parcelas e despesas fixas trazidas do Meu Dinheiro.
   - **Pagamento de fatura:** liga à previsão daquela fatura.
8. **Categoria**, nesta ordem: regra de preenchimento; categoria usada antes na mesma descrição; tradução da categoria da Pluggy.
9. **Fechamento:** nada com data até o fechamento (geral, da conta ou do cartão) é criado, alterado ou apagado. O que for barrado aparece no histórico da sincronização.
10. Cada execução grava uma linha em `pluggy_execucoes`, mostrada em **Histórico de sincronizações**.

### 5.4 Previsão das faturas no extrato

Roda depois de cada sincronização, antes de cada resumo e 2,5 segundos depois de qualquer lançamento salvo ou excluído no site.

- **Quais faturas:** de cada cartão com conta de débito, da fatura anterior até 12 meses à frente.
- **Valor:** soma das despesas menos os estornos daquela fatura, menos o que já foi pago. O lançamento previsto fica na conta de débito, no dia do vencimento, com a observação "Previsão automática da fatura".
- **Fatura zerada ou paga:** a previsão é apagada.
- **Previsão vinda do Meu Dinheiro ou lançada à mão:** só o valor é ajustado.
- **Fatura vencida sem previsão:** não é recriada.
- **Fechamento:** previsões em período fechado não mudam.

### 5.5 Telegram

- **Webhook:** cada mensagem ao bot chega à função com o segredo no cabeçalho.
  - Conversa liberada: "resumo" envia o resumo na hora, e qualquer outro texto recebe uma ajuda curta.
  - Conversa não liberada: entra na lista de pedidos e recebe só "🔒 Este bot é privado."
- **Liberação:** só pela tela **Open Finance**, com login. Marca-se quem vai receber e clica-se em **Liberar marcados**. Cada pessoa pode ser removida em separado.
- **Conteúdo do resumo:**
  - alerta de saldo;
  - saldo das contas;
  - gastos nos cartões e faturas;
  - Pix enviados e recebidos;
  - valores recebidos;
  - contas pagas, em atraso e a pagar;
  - uso do orçamento do mês.

  Valores negativos aparecem com 🔴.

## 6. Riscos e limites conhecidos

- **Pluggy:** o plano gratuito (Meu Pluggy) pode mudar de regra. O consentimento do Open Finance vence e precisa ser renovado: o banco deixa de sincronizar até alguém reconectar a conexão no Meu Pluggy.
- **Supabase gratuito:** o projeto pode ser pausado depois de um período sem uso. O uso diário deve evitar isso. Se acontecer, reative o projeto no painel do Supabase.
- **Cofre sem criptografia:** quem tiver acesso ao painel do Supabase vê as chaves da Pluggy e do Telegram.
- **Um único login:** a chave da Pluggy e o bot valem para o banco inteiro. Não remova o gatilho `limitar_um_usuario`.
- **OFX + Open Finance na mesma conta:** gera duplicados, porque o OFX não tem o `ext_id` da Pluggy.
- **Cópia de segurança:** baixa um arquivo, mas não há restauração automática.
- **Publicação da função pela linha de comando:** sem `--no-verify-jwt` (ou sem o `config.toml`), o **Verificar JWT** volta a ligar, e a sincronização agendada e o bot param.
