# VR Gestão

Base do sistema pessoal de Vinicius Riudi para operação de clientes, finanças, documentos e monitoramento.

## Padrões do projeto

As regras visuais e técnicas são permanentes: sem emojis, sem cards aninhados, linhas de 1px, responsividade completa e implementação preparada para grandes volumes de dados. Consulte [AGENTS.md](AGENTS.md) e [docs/standards.md](docs/standards.md) antes de criar ou alterar funcionalidades.

## Módulos preparados

- Clientes, projetos e cobranças com PostgreSQL/Prisma.
- Integração Asaas, configurada em Integrações na gestão (sem variáveis de ambiente): chave de API criptografada, webhook criado automaticamente, cobranças pelo portal do cliente e sincronização a cada 30 minutos.
- Estrutura de orçamentos e contratos, pronta para geração de PDF.
- Estrutura de sistemas monitorados, eventos de uptime, logs e segurança.
- Calculadora de orçamento funcional; a análise de escopo por IA será conectada neste módulo.

## Variáveis no EasyPanel

Cadastre as variáveis de `.env.example`. Gere uma senha forte para `POSTGRES_PASSWORD` e uma chave aleatória longa (32+ caracteres) para `INTEGRATION_ENCRYPTION_KEY`.

### Acesso e domínios

O app reconhece três superfícies pelo host configurado:

- `gestao.viniciusriudi.com`: operação interna para profissional, comercial, marketing, afiliado e contador.
- `clientes.viniciusriudi.com`: portal do cliente, já preparado para pagamentos, serviços e documentos.
- `viniciusriudi.com`: landing pública (depois: `portfolio.` e `links.`).

Defina `MANAGEMENT_HOST` e `CLIENT_PORTAL_HOST` de acordo com os domínios configurados no EasyPanel. `AUTH_SECRET` deve ser uma chave aleatória de pelo menos 32 caracteres; ela assina as sessões e não pode ser trocada sem invalidar os acessos atuais.

Em produção, as contas da gestão são cadastradas diretamente no banco de dados. O acesso de cada cliente ao portal é criado pela gestão, no perfil do cliente (seção "Acesso ao portal do cliente"): uma senha provisória é gerada para enviar ao cliente, que a troca em "Sua conta" no portal. No ambiente local, o primeiro login cria ou atualiza a conta de teste `teste@vinitakeuti.com` com a senha `Teste@Gestao2026`; essa conta não é criada em produção.

### E-mail (SMTP)

O envio de e-mails usa SMTP. Defina no serviço do Easypanel: `SMTP_HOST`, `SMTP_PORT` (465 ou 587), `SMTP_SECURE` (`true` para a porta 465), `SMTP_USER`, `SMTP_PASSWORD` e `EMAIL_FROM` (por exemplo, `Vinicius Riudi <contato@viniciusriudi.com>`). Em Configurações > E-mail dá para testar a conexão, enviar um e-mail de teste e ver o registro de cada envio.

### Monitoramento automático

Ao subir o servidor de produção, o monitoramento passa a rodar sozinho:
- verifica cada sistema a cada 5 minutos, confirmando a queda numa segunda tentativa;
- confere o certificado HTTPS a cada 12 horas e o vencimento do domínio (pelo RDAP) a cada 24 horas;
- envia e-mails de "fora do ar", "voltou", lembretes a cada 6 horas e avisos de vencimento aos 30, 7 e 1 dia;
- envia um resumo diário às 8h.

Os alertas vão para `MONITORING_ALERT_EMAIL` ou, se ela não estiver definida, para o e-mail do Perfil profissional, e dependem do SMTP configurado. `MONITORING_SCHEDULER=off` desliga o ciclo em produção; no ambiente local ele só roda com `MONITORING_SCHEDULER=on`.

### Logs do sistema

Logins, trocas de senha, acessos ao portal, envios de e-mail e erros do servidor ficam em Configurações > Logs do sistema, separados por origem (gestão, portal do cliente, sistema) e nível, por 90 dias.

As migrações iniciais já estão versionadas e são aplicadas automaticamente ao iniciar o container. A URL de saúde é `/api/health` e o webhook do Asaas é `/api/webhooks/asaas`.

## Deploy com Docker no EasyPanel

O deploy usa o `Dockerfile` da raiz, com a porta `3000` exposta. Configure o serviço para construir a imagem a partir do repositório e defina `DATABASE_URL` apontando para o PostgreSQL acessível pelo container.

Cada novo container executa `prisma migrate deploy` antes de iniciar o servidor Next.js. Assim, as migrations versionadas são aplicadas automaticamente a cada novo deploy, sem tentar acessar o banco durante a etapa de `docker build`.

## PDFs

O projeto usa `@react-pdf/renderer` para gerar documentos A4 no servidor. O modelo inicial de orçamento fica em `src/features/quotes/services/quote-pdf.tsx`; ele aplica margens, quebra de páginas, rodapé e tabela de entregas antes de o arquivo ser enviado ou armazenado.
