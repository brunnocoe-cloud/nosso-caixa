# Nosso Caixa · Arquitetura e funcionamento interno

Para quem precisar manter o site sem conhecer o histórico. O uso do dia a dia está no `LEIA-ME.md`, e os passos de atualização estão no `COMO-USAR.md`. As regras para agentes de IA estão no `AGENTS.md`, na raiz do repositório.

* **Atualizado em:** 17/11/2026, conferido contra o código do commit desta versão.
* **Cópia oficial:** o repositório `brunnocoe-cloud/nosso-caixa` no GitHub. Qualquer outra cópia (no computador ou num ambiente de IA) é cópia e pode estar velha.

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
| Fôlego (app React com servidor no Render e banco no Neon) | Abandonada em 21/09/2026; repositórios e cópias apagados em 17/11/2026 | Mais peças para manter. Não existe mais e não deve ser usado como referência. As conexões da Pluggy foram reaproveitadas no Nosso Caixa. |
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

Tabela de chave e valor num esquema fechado ao site (`revoke` para `anon` e `authenticated`). O site não a lê. Quem lê: a função `pluggy-sync`, por funções `security definer` liberadas apenas para o `service_role`, e as duas funções de agendamento (`nc_disparar`, `nc_disparar_pluggy`), que o pg_cron chama e que leem a chave `cron` direto da tabela. Os valores não são criptografados.

| Chave | Conteúdo |
|---|---|
| `cron` | Segredo que os agendamentos mandam no cabeçalho `x-nc-cron`. |
| `pluggy_id`, `pluggy_secret` | Client ID e Client Secret da Pluggy (cadastrados na tela **Open Finance**). |
| `telegram_token` | Token do bot, dado pelo BotFather. |
| `telegram_webhook_secret` | Segredo que o Telegram manda em cada mensagem recebida. |
| `telegram_chats` | Conversas que recebem o resumo (lista separada por vírgulas). |
| `telegram_nomes` | Nome e usuário de cada conversa liberada. |
| `telegram_pendentes` | Quem escreveu para o bot e ainda não foi liberado nem recusado. |

Funções SQL do cofre:

- chamadas pela Edge Function: `nc_cron_ok`, `nc_pluggy_cred`, `nc_pluggy_cred_salvar`, `nc_cfg_get` e `nc_cfg_set`;
- chamadas pelo pg_cron (não pela Edge Function): `nc_disparar` e `nc_disparar_pluggy`. O endereço do projeto Supabase está fixo dentro delas (`sql_v4_openfinance.sql`).

Neste documento, "função" sem outro nome quer dizer a Edge Function `pluggy-sync`.

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
3. **Lançamento já trazido:** cada lançamento guarda `ext_id = pluggy:<id>`. Se o `ext_id` já existe entre os lançamentos carregados, não entra de novo. A conferência é feita só na memória da execução: o índice `lanc_user_ext` não é único, então duas sincronizações ao mesmo tempo (manual e agendada) podem duplicar (ver §6.1).
4. **Conta bancária:**
   - só entram transações confirmadas;
   - **pagamento de fatura**, reconhecido de duas formas:
     - **pelo valor:** um débito com valor até 1% (mínimo R$ 0,01) diferente de qualquer `pagamento_fatura` de um cartão ligado à conta que ainda não tenha `ext_id` da Pluggy, a até 7 dias da data desse lançamento, vira o pagamento dessa fatura. Não importa se a previsão está paga nem o mês, e a descrição do débito não é olhada. Pega boleto ("PAGTO ELETRON COBRANCA - BRADESCARD") e Pix para a operadora, que não dizem "fatura", mas também pode pegar um Pix ou boleto comum de valor parecido (ver §6.1);
     - **pelo texto:** "fatura", "cartão", "card" (palavra inteira, para não pegar "Ricardo"), "Bradescard" ou "Itaucard", com o nome do cartão quando há mais de um ligado à conta;
   - o pagamento reconhecido ocupa o lugar da previsão da fatura, mesmo que ela já tenha sido marcada como paga à mão. A descrição passa a ser "Pagamento cartão <nome>" e a observação de uma previsão automática vira "Open Finance": o texto original do banco se perde.
5. **Cartão:**
   - compras pendentes entram com a observação "Open Finance (em aberto)", para a fatura atual ficar certa;
   - quando a Pluggy confirma, a observação muda;
   - se a compra some da Pluggy (cancelada), o lançamento em aberto é apagado.
6. **Fatura de cada compra:** usa a data de vencimento da fatura informada pela Pluggy, quando existe. Sem ela, usa o dia de fechamento do cartão (`faturaYM`), pulando as faturas já fechadas.
7. **Conciliação** (ligar a um lançamento já existente em vez de criar outro):
   - **Conta:** mesma conta, mesmo tipo e mesmo valor, até 5 dias de diferença. Prefere o lançamento ainda não pago e o de data mais próxima.
   - **Cartão:** mesmo cartão e mesmo valor, na mesma fatura ou até 4 dias de diferença. Isso cobre parcelas e despesas fixas trazidas do Meu Dinheiro.
   - **Pagamento de fatura:** liga à previsão daquela fatura.
8. **Categoria**, nesta ordem:
   1. regra de preenchimento, em três camadas: descrição exata; depois qualquer palavra-chave contida na descrição; depois a descrição da regra contida na descrição (só se tiver 4 letras ou mais). Dentro de cada camada vence a primeira regra encontrada, e a ordem não é definida (a função não ordena; o site ordena por `id`, que é aleatório). Os dois podem escolher regras diferentes;
   2. categoria usada antes na mesma descrição, entre os 3.000 lançamentos categorizados de data mais recente, inclusive previsões futuras;
   3. tradução da categoria da Pluggy (procura por nome, sem olhar se a categoria está ativa).

   A regra vence a correção manual: se alguém muda a categoria de um lançamento à mão, o próximo lançamento igual volta a seguir a regra.
9. **Período fechado:** nada com data até a data de fechamento do período (geral, da conta ou do cartão) é criado, alterado ou apagado. O que for barrado entra só na contagem de **ignorados**; o detalhe não é gravado em `pluggy_execucoes` nem aparece na tela. A regra está só no código (site e função), não no banco.
10. Cada execução grava uma linha em `pluggy_execucoes` (novos, conciliados, ignorados e erro), mostrada em **Histórico de sincronizações**. As gravações (inserir, atualizar, apagar) não são feitas numa transação: um erro no meio deixa a execução pela metade.

### 5.4 Previsão das faturas no extrato

Roda na função: depois de cada sincronização, antes de cada resumo e quando o site pede, 2,5 segundos depois de salvar ou excluir um lançamento, ou de salvar um cartão. A importação de arquivo, a antecipação de parcelas e a limpeza das categorias não disparam a previsão.

- **Quais faturas:** de cada cartão **não arquivado** com conta de débito, da fatura anterior até 12 meses à frente, só dos meses que têm compras e posteriores a `faturas_base` (preferência gravada pela importação). Cartão arquivado não tem previsão revista nem apagada.
- **Valor:** soma das despesas menos os estornos daquela fatura, menos o que já foi pago. O lançamento previsto fica na conta de débito, no dia do vencimento, com a observação "Previsão automática da fatura".
- **Fatura zerada ou paga:** a previsão **automática** é apagada. Uma previsão manual fica como está, com o valor antigo, e aparece "a pagar" ou "em atraso".
- **Previsão vinda do Meu Dinheiro ou lançada à mão:** enquanto falta pagar, só o valor é ajustado.
- **Fatura vencida sem previsão:** não é recriada.
- **Período fechado:** previsões em período fechado não mudam.

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
- O bot também aceita "saldo" e "relat" como pedido de resumo. A ação `telegram_salvar` apaga o segredo do webhook até o bot ser reativado.

### 5.6 Ações da função

Chamadas com `{ "acao": "<nome>" }` no corpo: `status`, `connect_token`, `contas`, `salvar_credenciais`, `faturas`, `diagnostico`, `relatorio`, `telegram_status`, `telegram_salvar`, `telegram_vincular`, `telegram_desvincular`, `telegram_recusar`, `telegram_webhook` e `unificar_faturas`. Sem ação, sincroniza; com `"simular": true`, devolve o que faria sem gravar.

`unificar_faturas` foi de uso único (10 e 13/11/2026), já foi usada e deve ser removida antes de criar um índice único em `ext_id`.

### 5.7 Preferências

Ficam numa única linha de `preferencias`, coluna `dados` (JSON). O site lê no login e a cada abertura, e grava o objeto **inteiro** (`salvarPrefs` em `01-core.js`, `limpPrefs` em `13-limpeza.js`). Um aparelho com uma cópia velha em memória que salve qualquer preferência apaga o que outro aparelho gravou depois (ver §6.1). Chaves usadas: `pluggy`, `recursos`, `faturas_base`, `fechamento_global`, `limpeza_regras`, `limpeza_2026`, entre outras.

### 5.8 Limpeza das categorias (2026)

Módulo temporário `src/13-limpeza.js`, aplicado em 16/11/2026 (1.142 lançamentos de 2026 recategorizados, total em reais igual antes e depois).

- **Regras:** ficam em `preferencias.dados.limpeza_regras`, no banco, e não no código, porque têm nomes de lojas e pessoas. O repositório é público.
- **Prévia:** envolve `carregar`, `render` e `sb.from` para mostrar o resultado sem gravar nada.
- **Aplicar:** grava as categorias, cria categorias e regras e inativa as subcategorias de pessoas. Guarda a situação anterior em `preferencias.dados.limpeza_2026`.
- **Desfazer:** botão em Configurações › Geral. Volta as categorias, apaga as regras e categorias criadas e reativa as pessoas. Também desfaz correções feitas depois da limpeza.
- **Fim:** depois da revisão de dezembro de 2026, remover `13-limpeza.js`, a entrada na lista `ordem` do `build.py`, a chamada `limpezaCartao()` em `06-cadastros.js` e as chaves `limpeza_2026` e `limpeza_regras` (`update preferencias set dados = dados - 'limpeza_2026' - 'limpeza_regras'`). Remover só o arquivo quebra o build e a tela.

## 6. Riscos e limites conhecidos

### 6.1 Defeitos conhecidos (abertos em 17/11/2026)

- **Fatura pelo valor pode engolir um pagamento real** (§5.3 item 4). Um Pix ou boleto de valor parecido com uma fatura vira pagamento de cartão, o gasto some e o texto do banco se perde.
- **Duplicados em sincronizações simultâneas** (§5.3 item 3). Falta índice único parcial em `(user_id, ext_id)` para `ext_id` iniciado por `pluggy:`. Não usar índice único em todos os `ext_id`: a importação OFX grava o FITID ali.
- **Desfazer da limpeza pode sumir** (§5.7). Qualquer aparelho com preferências velhas regrava o objeto inteiro.
- **Ordem das regras indefinida e diferente entre site e função** (§5.3 item 8).
- **Histórico aprende com previsões futuras** (§5.3 item 8).
- **A regra vence a correção manual** (§5.3 item 8).
- **Estornos de cartão entram como receita.** Não há reconhecimento de transferência entre contas próprias.
- **Sobra de até 1%:** quando o débito é um pouco menor que a previsão, a diferença vira nova previsão "a pagar".
- **Previsão manual não é apagada quando a fatura zera** (§5.4).

### 6.2 Limites

- **Pluggy:** o plano gratuito (Meu Pluggy) pode mudar de regra. O consentimento do Open Finance vence e precisa ser renovado: o banco deixa de sincronizar até alguém reconectar a conexão no Meu Pluggy.
- **Supabase gratuito:** o projeto pode ser pausado depois de um período sem uso. O uso diário deve evitar isso. Se acontecer, reative o projeto no painel do Supabase.
- **Cofre sem criptografia:** quem tiver acesso ao painel do Supabase vê as chaves da Pluggy e do Telegram.
- **Um único login:** a chave da Pluggy e o bot valem para o banco inteiro. Não remova o gatilho `limitar_um_usuario`.
- **OFX + Open Finance na mesma conta:** gera duplicados, porque o OFX não tem o `ext_id` da Pluggy.
- **Cópia de segurança:** baixa um arquivo (inclui `preferencias`), mas não há restauração automática.
- **Publicação da função pela linha de comando:** sem `--no-verify-jwt` (ou sem o `config.toml`), o **Verificar JWT** volta a ligar, e a sincronização agendada e o bot param.
