# VR Gestão

Base do sistema pessoal de Vinicius Riudi para operação de clientes, finanças, documentos e monitoramento.

## Módulos preparados

- Clientes, projetos e cobranças com PostgreSQL/Prisma.
- Integração Asaas: criação de cliente, cobrança PIX/cartão/boleto e webhook de atualização.
- Estrutura de orçamentos e contratos, pronta para geração de PDF.
- Estrutura de sistemas monitorados, eventos de uptime, logs e segurança.
- Calculadora de orçamento funcional; a análise de escopo por IA será conectada neste módulo.

## Variáveis no EasyPanel

Cadastre as variáveis de `.env.example`. Gere uma senha forte para `POSTGRES_PASSWORD` e uma chave aleatória longa (32+ caracteres) para `INTEGRATION_ENCRYPTION_KEY`.

As migrações iniciais já estão versionadas e são aplicadas automaticamente ao iniciar o container. A URL de saúde é `/api/health` e o webhook do Asaas é `/api/webhooks/asaas`.
