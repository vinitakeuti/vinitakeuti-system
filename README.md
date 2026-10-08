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

As migrações iniciais já estão versionadas e são aplicadas automaticamente ao iniciar o container. A URL de saúde é `/api/health` e o webhook do Asaas é `/api/webhooks/asaas`.

## Deploy com Docker no EasyPanel

O deploy usa o `Dockerfile` da raiz, com a porta `3000` exposta. Configure o serviço para construir a imagem a partir do repositório e defina `DATABASE_URL` apontando para o PostgreSQL acessível pelo container.

Cada novo container executa `prisma migrate deploy` antes de iniciar o servidor Next.js. Assim, as migrations versionadas são aplicadas automaticamente a cada novo deploy, sem tentar acessar o banco durante a etapa de `docker build`.

## PDFs

O projeto usa `@react-pdf/renderer` para gerar documentos A4 no servidor. O modelo inicial de orçamento fica em `src/features/quotes/services/quote-pdf.tsx`; ele aplica margens, quebra de páginas, rodapé e tabela de entregas antes de o arquivo ser enviado ou armazenado.
