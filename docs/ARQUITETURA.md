# Arquitetura e decisões

## Limite do PRD recebido

O documento recebido termina em 3.1. As regras abaixo completam a primeira implementação e são premissas, não requisitos alegadamente fornecidos pelo usuário. A marca usa o nome da pasta, Segredo da Maria; o sistema mantém o nome Gestão Íntima.

## Modelo de confiança

O browser recebe apenas DTOs autorizados. Prisma é importado somente por módulos `server-only`. Cada página, consulta e Server Action chama a guarda de acesso. O middleware renova cookies e define cabeçalhos, mas não é a única barreira de autorização. O framework valida origem das Server Actions.

Identidade é conferida com `getUser` e claims assinadas; a sessão também precisa existir em `auth.sessions` e estar dentro de `not_after`. A autorização vem de `private.Member`, nunca de `user_metadata`. Não há cadastro público. O perfil é relido em cada operação, portanto desativar um membro não depende de atualizar claims de papel.

MFA TOTP (AAL2) é obrigatório para os dados. AAL1 permite somente iniciar/verificar MFA e sair, sempre para membro ativo com sessão válida. Cookies são HttpOnly, SameSite=Lax e Secure em produção; não há cliente Supabase no browser. Respostas privadas não são cacheáveis. CSP usa nonce por requisição, `frame-ancestors 'none'` e `object-src 'none'`.

RLS em `private` é defesa adicional. Somente a role de backend `gestao_app` tem políticas e privilégios do domínio. `anon` e `authenticated` não têm uso do schema. O backend implementa os papéis sócio/operador; JWT do cliente não vira uma conexão Prisma. A role runtime não é proprietária, não tem bypass RLS e não pode apagar registros nem modificar auditoria, alocações, itens vendidos ou movimentos. Acesso à tabela de migrações não é concedido. Migrações usam outra credencial. A role também não lê `auth.sessions`: uma função `SECURITY DEFINER` no schema privado retorna apenas a validade da sessão, exige a correspondência com `auth.uid()` e só pode ser executada pelo backend.

## Dados íntimos

Telefone, medidas e observações são um documento criptografado com AES-256-GCM; o UUID do cliente é AAD, impedindo trocar documentos entre clientes. Há nonce aleatório a cada gravação e versão no envelope. A chave de 256 bits vem apenas do ambiente do servidor. A aplicação não oferece rotação automática; não substitua a chave sem migração que descriptografe com a antiga e recriptografe com a nova.

Nome de atendimento, vínculo de compra e dados comerciais permanecem legíveis no banco privado. Criptografia de campos não elimina a sensibilidade do histórico de compras. Evite descrições excessivas e faça backup de banco e chave separadamente. Auditoria registra usuário, ação, entidade e data sem copiar os campos sensíveis. A consulta do perfil também gera evento. Não há analytics ou serviços de telemetria de terceiros incorporados à interface.

O controle de autorização da cliente serve ao atendimento; desmarcá-lo e salvar limpa medidas e preferências. Arquivamento preserva o histórico; não equivale a anonimização nem exclusão. Políticas de retenção, exportação, anonimização e recuperação de backup precisam ser definidas com a continuação do PRD.

## Estoque e vendas

Produto agrupa variações. Cada SKU possui cor/tamanho e atributos opcionais de tórax, taça, tamanho inferior e alimentação. Conjuntos são SKUs próprios: desmontagem de um conjunto em peças e kits com composição não foram especificados, portanto não são automatizados.

Estoque é o saldo dos lotes. Cosméticos exigem validade; unidades vencidas continuam no saldo físico, mas não entram no disponível. A validade inclui o dia indicado no fuso America/Sao_Paulo. A venda usa FEFO, depois data de recebimento e UUID como desempate. Ajustes negativos não excedem o saldo. A aplicação permite lançar a destinação de vencidos como ajuste motivado.

Vendas usam transação SERIALIZABLE e até duas repetições em conflito P2034. O servidor busca preço corrente, calcula os totais em centavos inteiros e obtém custos dos lotes. A baixa é condicional (`quantity >= retirada`), e uma constraint impede saldo negativo. A chave UUID e hash de payload evitam duplicar o mesmo comando; uma chave reutilizada por outro ator ou com outro conteúdo é recusada.

Cancelamento é exclusivo dos sócios, idempotente pelo estado, restaura os lotes originais e preserva itens e auditoria. Deve corresponder à devolução física. Reembolsos são feitos fora do sistema. Venda pendente exige cliente identificado. Não há parcelamento, pagamento parcial, comissão, conciliação bancária ou emissão fiscal nesta primeira versão.

## Finanças

DRE gerencial simples por competência: vendas concluídas líquidas de desconto menos custo dos lotes vendidos, despesas operacionais e pró-labore. Cancelar remove o valor do mês de origem, mesmo quando o cancelamento acontece posteriormente. Não há fechamento contábil imutável. Anular despesa a exclui do resultado e preserva o registro.

Compras de estoque não devem ser duplicadas em despesas; o custo é apropriado quando vendido. A interface não é contabilidade fiscal e não apura tributos, taxas de cartão, encargos de pró-labore ou lucro líquido contábil. Recebido/a receber no painel refere-se às vendas do mês selecionado, não a entradas de caixa por data de liquidação nem ao saldo bancário. Retiradas de lucro distintas de pró-labore precisam de regra própria na próxima fase.

## Operação e escala

Listas de estoque/clientes/vendas têm busca/filtro e paginação de 50 registros; buscas de seleção retornam no máximo 50 e pedem refino. O painel agrega os lotes ativos e as vendas do mês no servidor: adequado à primeira operação, mas deve migrar para agregações SQL e paginação dos lotes quando o volume justificar. Não há armazenamento de dados reais em localStorage, caches de aplicação ou arquivos JSON.

## Validação pendente no serviço real

As migrações e regras são testadas localmente; projeto Supabase ainda não selecionado. Não foram executados login, MFA, entrega/recuperação de e-mail, pooler, Security Advisors, recuperação de backup ou disputa de vendas por múltiplas conexões no Supabase. O ambiente não deve ser tratado como produção homologada antes dessas verificações.
