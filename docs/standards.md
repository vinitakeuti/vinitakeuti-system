# Padrão de produto e engenharia

## Princípios de interface

O VR Gestão é uma superfície de trabalho para uma operação que irá crescer. A interface deve tornar decisões e estados claros com pouca ornamentação.

1. Sem emojis em conteúdo, interface, dados de exemplo ou documentação.
2. Uma superfície visual por contexto. Um painel pode conter listas, formulários e tabelas delimitados por espaço e linhas de 1px, mas não outro card decorativo.
3. A borda padrão é `1px`; cantos e sombras são sutis. Cor e contraste indicam status somente quando agregam informação.
4. A responsividade parte do menor viewport. Tabelas grandes devem oferecer colunas prioritárias no celular, busca e uma visão de detalhe, não apenas encolher.
5. Listas extensas usam densidade adequada e não usam grade de cartões. O usuário deve conseguir filtrar, ordenar e abrir detalhes sem baixar registros desnecessários.

## Dados e APIs em escala

- Toda rota de coleção define `limit`, cursor, filtros permitidos e ordenação em whitelist. Limites têm teto no servidor.
- Respostas de lista usam `{ data, nextCursor, total? }`; `total` só é calculado quando realmente necessário.
- Índices são criados em conjunto com os padrões de consulta. Verifique plano de execução em consultas críticas.
- Webhooks precisam ser idempotentes, autenticados e persistidos antes do processamento assíncrono.
- Monitores HTTP e leitores de log produzem eventos pequenos e normalizados. O histórico tem política de retenção e arquivamento.
- PDFs e análises de IA são tarefas assíncronas com estado de execução e resultado referenciado, não payloads grandes em uma requisição.

## Estrutura recomendada

```
src/
  app/                  # rotas e composição de página
  components/           # componentes compartilhados e sem regra de domínio
  features/
    billing/             # domínio: interface, validações, queries e serviços
    monitoring/
    projects/
  lib/
    integrations/       # clientes de serviços externos
    prisma.ts
```

Ao crescer, cada domínio mantém seus contratos de entrada, consultas e regras de negócio próximos. Componentes não acessam Prisma nem chamam fornecedores externos diretamente.
