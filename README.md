# Gestão Íntima — Segredo da Maria

Backoffice privado para uma operação de lingerie, moda praia e bem-estar íntimo. Implementação inicial do PRD recebido até a seção 3.1, em módulos, com Next.js 15 App Router, TypeScript estrito, Prisma, Supabase Auth/PostgreSQL, Zod, Tailwind e componentes Shadcn/Radix.

## Executar localmente

Requer Node.js 22.14+ e npm. Nesta entrega, `.env.local` contém apenas `DEMO_MODE=true` e é ignorado pelo Git. A demonstração usa registros fictícios, não conecta ao banco e bloqueia todas as gravações. A flag só tem efeito quando `NODE_ENV=development`.

```powershell
npm ci
npm run db:generate
npm run dev
```

Abra http://127.0.0.1:3000. Em uma cópia nova, crie `.env.local` com `DEMO_MODE=true` para visualizar a demonstração. Sem configuração nem demonstração, o sistema permanece na tela de login, sem conceder acesso.

## Módulos implementados

- Visão geral com mês selecionável, vendas, resultado gerencial, ticket médio, pendências e estoque por categoria.
- Produtos e variações por SKU, cor, tamanho, tórax/taça, peça inferior e alimentação de eletrônicos.
- Estoque por lote: entradas, custos, validade, ajuste com motivo, consumo FEFO e devolução nos cancelamentos. Cosméticos exigem validade.
- CRM: cadastro e edição, nome de atendimento, contato, medidas e preferências com autorização, arquivamento e consulta auditada do perfil.
- Vendas diretas: itens, desconto, pagamento manual, valores a receber, confirmação de recebimento e cancelamento. Preços e custos são calculados pelo servidor.
- Finanças exclusivas dos sócios: DRE gerencial simplificada, despesas, pró-labore e anulação de lançamentos.
- Acessos: sócios/operadores, ativação e desativação, MFA TOTP obrigatório e trilha de auditoria.

Não há catálogo público, carrinho externo, gateway ou link de pagamento. O formulário de itens é um registro interno de venda.

## Conectar um Supabase dedicado

Nenhum projeto remoto foi alterado nesta entrega. Os projetos encontrados na conta não identificavam esta operação. A configuração exige um destino e credenciais definidos pelo responsável.

1. Crie ou selecione o projeto Supabase exclusivo deste sistema. Mantenha o schema `private` fora da lista de schemas expostos pelo Data API. Desative o Data API se não precisar dele.
2. Desative novos cadastros públicos em **Authentication → Providers → Email / Allow new users to sign up**. Mantenha os limites de tentativas de autenticação do Supabase configurados. Cadastre os sócios no painel Auth e confirme seus e-mails. Nenhum formulário público cria usuários.
3. Copie `.env.example` para `.env` e preencha as variáveis. Remova `DEMO_MODE=true` de `.env.local` ou altere para `false`, pois `.env.local` tem precedência no Next. Nunca envie senhas ou chaves privadas ao chat ou ao repositório.
4. `DIRECT_URL`: conexão direta ou pooler **Session Mode**, porta 5432, com usuário de migração. `DATABASE_URL`: **Transaction Mode**, porta 6543, com o usuário restrito `gestao_app`, `pgbouncer=true`, `connection_limit=3` e `schema=private`. Use os hosts exatos do painel Connect; codifique caracteres especiais das senhas na URL.
5. Gere `DATA_ENCRYPTION_KEY` e guarde a chave em um gerenciador de segredos com cópia de recuperação:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

6. Aplique as migrações pelo Prisma com `npm run db:deploy`. Elas criam o domínio, constraints, índices e RLS, revogam acesso de `anon`/`authenticated` e criam a role `gestao_app` inicialmente sem login. Use a conexão administrativa `postgres` do projeto: ela precisa criar a role e ser proprietária da função privada que verifica sessões sem conceder leitura de `auth.sessions` ao runtime.
7. No SQL Editor administrativo do Supabase, atribua uma senha forte e habilite login para a role. Substitua o marcador **localmente**, sem versionar a senha:

   ```sql
   ALTER ROLE gestao_app LOGIN PASSWORD '<SENHA_GERADA_EM_GERENCIADOR>';
   ```

   Configure essa senha apenas em `DATABASE_URL`. A role não possui permissão de DDL, DELETE ou alteração dos registros de auditoria. Nunca use `postgres` ou `service_role` para as operações da aplicação.

8. Autorize cada usuário já confirmado no Auth pelo UUID:

   ```powershell
   npm run db:bootstrap -- --id "UUID_DO_USUARIO_AUTH" --name "Nome do sócio" --role ADMIN
   ```

   Para vendedor, use `--role OPERATOR`. O script usa `DIRECT_URL`, não cria nem convida usuários por e-mail e não modifica membros existentes.

9. Entre com e-mail/senha. No primeiro acesso, configure um autenticador TOTP; dados privados só abrem após a confirmação. Planeje recuperação de MFA com o administrador do projeto Supabase.
10. Valide autenticação, expiração/revogação de sessão, dois perfis e vendas simultâneas no projeto escolhido antes de inserir dados reais. Execute também os Security Advisors do Supabase.

Em produção, use HTTPS e um runtime Node.js compatível com Next.js/Prisma. Não exponha o servidor de desenvolvimento. `DIRECT_URL` só é necessária no processo de migração/provisionamento; não a forneça ao processo web em produção. O servidor local se liga apenas a `127.0.0.1`.

## Verificação

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Os testes usam Vitest e PostgreSQL embarcado (PGlite). Executam as migrações reais, RLS/privilegios, constraints, rollback e baixa condicional; verificam FEFO, datas brasileiras, consentimento, criptografia, regras monetárias e guardas de autenticação. Eles não substituem validação de Supabase Auth, MFA e concorrência com conexões reais no projeto de destino.

Versões estão fixadas no `package.json` e `package-lock.json`. Overrides de PostCSS e deepmerge-ts corrigem avisos de segurança das dependências transitivas preservando a linha Next.js 15/Prisma 6. Reavalie esses overrides ao atualizar os pacotes pais.

## Organização

```text
src/app/(private)/     telas privadas e layout
src/app/actions.ts     comandos de negócio com autorização
src/app/auth-actions.ts autenticação e MFA
src/components/       interface e formulários
src/lib/server/       banco, sessão, criptografia, consultas e transações
src/lib/domain.ts     validação Zod e regras comuns
prisma/               modelo e migrações SQL
scripts/              provisionamento administrativo
tests/                integridade, acesso e PostgreSQL
docs/                 arquitetura, premissas e sequência de evolução
```

Veja [arquitetura e premissas](docs/ARQUITETURA.md) e [entrega por fases](docs/FASES.md).

Referências técnicas consultadas: [SSR no Supabase](https://supabase.com/docs/guides/auth/server-side/nextjs), [sessões e cache](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [Prisma com Supabase](https://supabase.com/docs/guides/database/prisma), [correções Next.js 15](https://nextjs.org/blog/august-2026-security-release).
