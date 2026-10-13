# VR Gestão

Base do sistema pessoal de Vinicius Riudi para operação de clientes, finanças, documentos e monitoramento.

## Padrões do projeto

As regras visuais e técnicas são permanentes: sem emojis, sem cards aninhados, linhas de 1px, responsividade completa e implementação preparada para grandes volumes de dados. Consulte [AGENTS.md](AGENTS.md) e [docs/standards.md](docs/standards.md) antes de criar ou alterar funcionalidades.

## Módulos preparados

- Clientes, projetos e cobranças com PostgreSQL/Prisma.
- Integração Asaas: criação de cliente, cobrança PIX/cartão/boleto e webhook de atualização.
- Estrutura de orçamentos e contratos, pronta para geração de PDF.
- Estrutura de sistemas monitorados, eventos de uptime, logs e segurança.
- Calculadora de orçamento funcional; a análise de escopo por IA será conectada neste módulo.

## Variáveis no EasyPanel

Cadastre as variáveis de `.env.example`. Gere uma senha forte para `POSTGRES_PASSWORD` e uma chave aleatória longa (32+ caracteres) para `INTEGRATION_ENCRYPTION_KEY`.

### Acesso e domínios

O app reconhece três superfícies pelo host configurado:

- `gestao.vinitakeuti.com`: operação interna para profissional, comercial, marketing, afiliado e contador.
- `clientes.vinitakeuti.com`: portal do cliente, já preparado para pagamentos, serviços e documentos.
- `vinitakeuti.com`: landing pública.

Defina `MANAGEMENT_HOST` e `CLIENT_PORTAL_HOST` de acordo com os domínios configurados no EasyPanel. `AUTH_SECRET` deve ser uma chave aleatória de pelo menos 32 caracteres; ela assina as sessões e não pode ser trocada sem invalidar os acessos atuais.

Em produção, os usuários são cadastrados diretamente no banco de dados. No ambiente local, o primeiro login cria ou atualiza a conta de teste `teste@vinitakeuti.com` com a senha `Teste@Gestao2026`; essa conta não é criada em produção.

As migrações iniciais já estão versionadas e são aplicadas automaticamente ao iniciar o container. A URL de saúde é `/api/health` e o webhook do Asaas é `/api/webhooks/asaas`.

## Deploy com Docker no EasyPanel

O deploy usa o `Dockerfile` da raiz, com a porta `3000` exposta. Configure o serviço para construir a imagem a partir do repositório e defina `DATABASE_URL` apontando para o PostgreSQL acessível pelo container.

Cada novo container executa `prisma migrate deploy` antes de iniciar o servidor Next.js. Assim, as migrations versionadas são aplicadas automaticamente a cada novo deploy, sem tentar acessar o banco durante a etapa de `docker build`.

## PDFs

O projeto usa `@react-pdf/renderer` para gerar documentos A4 no servidor. O modelo inicial de orçamento fica em `src/features/quotes/services/quote-pdf.tsx`; ele aplica margens, quebra de páginas, rodapé e tabela de entregas antes de o arquivo ser enviado ou armazenado.
