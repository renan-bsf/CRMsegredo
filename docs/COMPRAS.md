# Compras e notas fiscais de entrada

O menu **Compras e notas fiscais** está disponível aos sócios administradores, em `/compras`. Operadores não acessam documentos nem custos de fornecedores. As páginas, consultas e ações verificam a sessão, o perfil e o MFA no servidor.

## Utilização

1. Cadastre as variações dos produtos em **Produtos e estoque**.
2. Em **Novo registro**, escolha pedido de compra ou nota fiscal de entrada.
3. Informe fornecedor, CNPJ, número, série opcional, emissão e previsão de entrega. Notas podem incluir a chave de 44 dígitos da NF-e como referência.
4. Busque os produtos por nome ou SKU e informe quantidade e custo unitário. Notas exigem lote; cosméticos também exigem validade.
5. Salve o documento. O registro permanece disponível para consulta, sem alterar o estoque.
6. No detalhe de uma nota, use **Confirmar recebimento** após conferir as mercadorias. Todos os itens entram juntos no estoque.
7. Para vincular um faturamento a um pedido, abra o pedido e escolha **Registrar nota deste pedido**. Revise itens e quantidades faturados antes de salvar.

A listagem tem busca por fornecedor, CNPJ, número ou chave, filtros por tipo e situação, e paginação de 50 documentos. Cada detalhe apresenta itens, valores, lotes, validade, observações e vínculos com pedidos/notas.

## Regras

- Custos são informados em reais e armazenados em centavos. O servidor calcula os totais. Informe o custo final por unidade, incluindo rateios de frete, tributos e descontos.
- Documento limitado a 50 linhas; quantidade inteira de 1 a 10.000 por linha; total máximo de R$ 1.000.000,00.
- Um envio repetido usa a mesma chave de idempotência. Tipo + CNPJ + número + série e chave da NF-e não podem duplicar documentos.
- O recebimento usa uma transação serializável com retentativas para conflitos de concorrência. Status, lotes, movimentos e auditoria são gravados juntos; qualquer falha reverte o conjunto.
- Receber novamente uma nota já recebida não adiciona estoque. Notas canceladas e pedidos não podem movimentá-lo.
- Um lote já existente só recebe novas quantidades quando custo e validade coincidem. Cosméticos exigem validade e lotes vencidos são bloqueados no recebimento.
- Cancelamento interno exige motivo e mantém o histórico. Só documentos ainda não recebidos podem ser cancelados. Pedidos com notas ativas vinculadas precisam ter essas notas resolvidas antes.
- É possível registrar várias notas para um pedido. O vínculo é documental: não calcula automaticamente saldo a faturar nem encerra o pedido.
- Compras não geram uma despesa automática na DRE: o custo é apropriado nas vendas pelo lote, conforme o modelo gerencial existente.

## Limites desta versão

Registro manual de dados e itens. Não inclui upload de XML/PDF, importação, emissão fiscal, validação na SEFAZ ou contas a pagar. O cancelamento deste registro interno não cancela uma NF-e na SEFAZ. Para corrigir um documento ainda não recebido, cancele o registro e mantenha uma referência distinta para o substituto; o número original fica preservado no histórico.

## Banco e implantação

Migração: `prisma/migrations/20260921132900_purchasing/migration.sql`. Adiciona as tabelas `private.PurchaseDocument` e `private.PurchaseItem`, enums, índices, chaves estrangeiras e constraints. Ambas têm RLS obrigatório, acesso somente pela role restrita do backend e nenhuma permissão pública. Auditoria permanece na tabela existente.

No projeto já provisionado, aplique apenas esta migração antes de publicar o código. A base foi provisionada por SQL; não execute novamente as migrações iniciais via Prisma sem primeiro reconciliar o histórico com `prisma migrate resolve`. Nunca use reset em produção.

Os testes cobrem validações, permissões, duplicidade, regras de recebimento/cancelamento, constraints e rollback no PostgreSQL embarcado. Registros de teste não são inseridos em produção.
