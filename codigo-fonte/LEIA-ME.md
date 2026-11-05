# Nosso Caixa

Endereço: https://brunnocoe-cloud.github.io/nosso-caixa/

Site de finanças do casal, feito no formato do Meu Dinheiro (o app que usávamos antes): mesmo menu, mesmas telas e as mesmas categorias.

# Parte 1 · Como usar

## Primeiro acesso

O site guia três passos: ligar ao banco de dados, rodar o SQL que ele mostra e criar o login. O segundo aparelho entra pelo link que aparece em **Configurações**.

## Menu

- **Visão geral**: 13 quadros que dá para recolher e personalizar:
  - Saldos de caixa (Confirmado × Projetado, escolhendo quais contas somar)
  - Resultado do mês e Resultados de caixa
  - Despesas e Receitas por categoria
  - Balanço patrimonial
  - Orçamento
  - Contas a receber e Contas a pagar
  - Últimos lançamentos
  - Cartões de crédito
  - Fluxo de caixa
  - Metas de economia
- **Movimentações e caixa**
  - **Lançamentos**: painel de saldos e resultados, filtros (Pendentes, Agendados, Confirmados, Conciliados), busca, saldo dia a dia, exportar e imprimir.
  - **Fluxos**: saldo projetado por semana, nos próximos 30 dias ou no mês.
  - **A pagar e receber** e **Pagas e recebidas**.
- **Extrato de contas**: situação Confirmada × Projetada, lançamentos em blocos por dia com o saldo ao fim de cada dia, faturas de cartão previstas no dia do vencimento e **Ajustar saldo**.
- **Cartões de crédito**:
  - fatura do mês com fechamento, vencimento, saldo anterior, valor pago e valor a pagar;
  - **Fechar fatura** e **Lançar pagamento**;
  - despesas conciliadas e não conciliadas, despesas fixas, parcelas futuras e **Antecipar parcelas**;
  - totais por titular (cartões adicionais) e limite disponível;
  - lançamentos em blocos por dia, com filtro por titular, gráfico por categoria e ordenação.
- **Filtro "Ver por"** (Extrato e Cartões): **Fatura** (só em Cartões), **Mês**, **Semana**, **Dia**, **Período** (de/até, com atalhos de 7, 30 e 90 dias) ou **Ano**. O botão ao lado inverte a ordem das datas (mais antigas ou mais recentes primeiro).
- **Metas**
  - **Orçamento**: limite de gasto por categoria, com média dos últimos 3 meses e cópia do mês anterior.
  - **Economia**: objetivo acompanhado pelo saldo de uma conta, com a "aplicação mensal ideal".
- **Relatórios**: os mesmos 13 do Meu Dinheiro, com período, gráfico, exportação e impressão:
  - Balanço Patrimonial e Evolução do Balanço Patrimonial
  - Evolução das Metas de Categorias (gasto × orçamento)
  - Fluxo de Caixa e Lançamentos de Caixa
  - Contas a Pagar, a Receber, Pagas e Recebidas
  - Totais por Categoria e Evolução por Categoria
  - Comparação entre Períodos
  - Lançamentos por Categoria
- **Cadastros**
  - **Categorias**: com subcategorias (Pessoais/Alice, Investimentos/IR…) e opção de inativar.
  - **Contas**: por tipo, com "Considerar saldo" e contas inativas.
  - **Tags**.
  - **Documentos**: anexos guardados no Supabase, até 10 MB por arquivo.
  - **Regras de preenchimento**: pela descrição e por palavras alternativas, preenchem conta, cartão, titular, categoria e tags.
  - **Importar lançamentos**: extrato OFX ou CSV do banco ou do cartão. Detecta repetidos e sugere a categoria.
  - **Open Finance (banco)**: lançamentos automáticos do banco e dos cartões, 4 vezes por dia, e o resumo no Telegram às 8h e às 18h. A própria tela guia a configuração.
  - **Fechamento posição**: geral, por conta ou por cartão; bloqueia alterações até a data escolhida.
- **Configurações de utilização**: ligar e desligar recursos (Tags, Orçamento, Metas de economia, Cartões); nome de quem usa o aparelho; tema; cópia de segurança.

## Formulário de lançamento

- Tipo: despesa, receita ou transferência.
- Valor: aceita expressões, por exemplo `10,50+3*2`.
- Data.
- Repetição: **Única**, **Parcelada** (o valor pode ser o total ou o da parcela) ou **Fixa**, sem data para terminar.
- Descrição, conta ou cartão (com titular e fatura), categoria, observações (até 2000 caracteres) e tags.
- Rodapé:
  - ✔ Confirmado
  - ✔✔ Conciliado
  - 📎 Anexar
  - Duplicar e Excluir
  - **Salvar** e **+ (salvar e continuar)**
- Botão verde flutuante: Despesa, Receita, Transferência e **Lançamento detalhado** (um pagamento dividido em várias categorias).
- Ao alterar ou excluir um lançamento repetido, o site pergunta se a mudança vale para **Somente este**, **Este e os próximos** ou **Todos**.

## Cuidados

- Numa conta ligada ao Open Finance, não importe também o OFX do mesmo período: os lançamentos ficam duplicados.
- O fechamento vale também para a sincronização automática: nada em período fechado é criado, alterado ou apagado.
- A cópia de segurança (Configurações) só baixa um arquivo. Não há botão para restaurar a partir dele.

## Diferenças em relação ao Meu Dinheiro

- O nome e o logotipo são próprios (Nosso Caixa).
- Não há Investimentos nem Carnê Leão. Esses módulos também não estão contratados no seu plano do Meu Dinheiro.

# Parte 2 · Para quem mantém o site

Os arquivos e os passos de atualização estão em `codigo-fonte/COMO-USAR.md`. Em resumo:

1. Rode `python3 build.py` dentro de `codigo-fonte`. Ele gera o `index.html` da raiz e o `schema.sql`.
2. Envie as mudanças ao repositório `brunnocoe-cloud/nosso-caixa` (o GitHub Pages publica em 1 a 2 minutos).
3. Se a função mudou: `supabase functions deploy pluggy-sync --no-verify-jwt`.
4. Se o banco de dados mudou: rode o `schema.sql` no SQL Editor do Supabase. Ele pode ser executado de novo sem apagar dados.
