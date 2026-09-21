# Construção em fases

## Fase 1 — primeira implementação local

Código de autenticação/segurança, schema privado e migrações; produtos/variações/lotes; CRM protegido; vendas diretas e recebimentos; resultado gerencial/despesas/pró-labore; permissões e auditoria; demonstração e testes locais. A versão é 0.1.0 para distinguir a primeira entrega da meta 1.0.0 do PRD.

## Fase 2 — configuração e homologação

Depende da escolha de um projeto Supabase e configuração de segredos. Aplicar migrações, provisionar os dois sócios, validar login/MFA e revogação, conferir acesso do operador, exercitar concorrência e reversão de vendas no banco real, executar Advisors e testar recuperação de backup. Nenhuma dessas etapas foi marcada como concluída apenas por o código existir.

## Fase 3 — continuação do PRD

Incorporar as seções posteriores a 3.1 quando fornecidas. Confirmar regras de kits/peças avulsas, cadastro dedicado de fornecedores, importação XML/PDF e contas a pagar, devoluções parciais, parcelas/fiado, taxas, retiradas de lucro, fechamento financeiro, retenção/anonimização e recuperação de acesso. São questões a resolver, não funcionalidades prometidas pelo documento parcial.

## Fase 4 — implantação privada

Escolher hospedagem Node.js compatível com Next.js e Prisma, configurar domínio/HTTPS, separar segredos de runtime e migração, aplicar política de backup e alertas técnicos sem dados pessoais. Publicação não foi executada nesta entrega local.

## Compras e notas fiscais de entrada

Implementado o registro manual de pedidos e notas, vínculo entre documentos, recebimento de estoque e cancelamento auditado. Consulte o [guia de compras](COMPRAS.md) para regras e limites.
