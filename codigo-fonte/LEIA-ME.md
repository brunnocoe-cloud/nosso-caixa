# Nosso Caixa · versão 3 (no formato do Meu Dinheiro)

Endereço: https://brunnocoe-cloud.github.io/nosso-caixa/

## Menu (igual ao Meu Dinheiro)

- **Visão geral**: 13 quadros que dá para recolher e personalizar:
  - Saldos de caixa (Confirmado × Projetado, escolhendo quais contas somar)
  - Resultado do mês e Resultados de caixa
  - Despesas e Receitas por categoria
  - Balanço patrimonial
  - Metas de despesas
  - Contas a receber e Contas a pagar
  - Últimos lançamentos
  - Cartões de crédito
  - Fluxo de caixa
  - Metas de economia
- **Movimentações e caixa**
  - **Lançamentos**: painel de saldos e resultados, filtros (Pendentes, Agendados, Confirmados, Conciliados), busca, saldo dia a dia, exportar e imprimir.
  - **Fluxos**: saldo projetado por dia, por semana, nos próximos 30 dias ou no mês.
  - **A pagar e receber** e **Pagas e recebidas**.
- **Extrato de contas**: situação Confirmada × Projetada, saldo ao fim de cada dia e **Ajustar saldo**.
- **Cartões de crédito**:
  - fatura do mês com fechamento, vencimento, saldo anterior, valor pago e valor a pagar;
  - **Fechar fatura** e **Lançar pagamento**;
  - despesas conciliadas e não conciliadas, despesas fixas, parcelas futuras e **Antecipar parcelas**;
  - totais por titular (cartões adicionais) e limite disponível;
  - lista agrupada "Total em dd/mm", com filtro por titular, gráfico por categoria e ordenação.
- **Metas**
  - **Orçamento**: limite de gasto por categoria, com média dos últimos 3 meses e cópia do mês anterior.
  - **Economia**: objetivo acompanhado pelo saldo de uma conta, com a "aplicação mensal ideal".
- **Relatórios**: os mesmos 13 do Meu Dinheiro, com período, gráfico, exportação e impressão:
  - Balanço Patrimonial e Evolução do Balanço Patrimonial
  - Evolução das Metas de Categorias
  - Fluxo de Caixa e Lançamentos de Caixa
  - Contas a Pagar, a Receber, Pagas e Recebidas
  - Totais por Categoria e Evolução por Categoria
  - Comparação entre Períodos
  - Lançamentos por Categoria
- **Cadastros**
  - **Categorias**: com subcategorias (Pessoais/Alice, Investimentos/IR…) e opção de inativar. Já vêm as mesmas categorias usadas hoje no Meu Dinheiro.
  - **Contas**: por tipo, com "Considerar saldo" e contas inativas.
  - **Tags**.
  - **Documentos**: anexos guardados no Supabase, até 10 MB por arquivo.
  - **Regras de preenchimento**: pela descrição e por palavras alternativas, preenchem conta, cartão, titular, categoria e tags.
  - **Importar lançamentos**: extrato OFX ou CSV do banco ou do cartão. Detecta repetidos e sugere a categoria.
  - **Fechamento posição**: por conta ou global; bloqueia alterações até a data escolhida.
- **Configurações de utilização**: ligar e desligar recursos (Tags, Metas de orçamento, Metas de economia, Cartões); nome de quem usa o aparelho; tema; cópia de segurança.

## Formulário de lançamento

- Tipo: despesa, receita ou transferência.
- Valor: aceita contas, por exemplo `10,50+3*2`.
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

## Diferenças em relação ao Meu Dinheiro

- O nome e o logotipo são próprios (Nosso Caixa).
- Não há Investimentos nem Carnê Leão. Esses módulos também não estão contratados no seu plano do Meu Dinheiro.
- Não há conexão automática com o banco (Open Finance). No lugar dela, use **Importar lançamentos** com o arquivo OFX do banco.

## Atualizar o site depois

1. Envie o novo `index.html` ao repositório `brunnocoe-cloud/nosso-caixa`.
2. Se mudar o banco, rode o `schema.sql` no SQL Editor do Supabase. Ele pode ser executado de novo sem apagar dados.
