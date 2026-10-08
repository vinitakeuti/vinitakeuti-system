# Padrões obrigatórios do VR Gestão

Estas regras valem para todo código, interface, texto, documentação e ativo adicionado ao projeto.

## Interface

- Não use emojis. Use texto claro, ícones funcionais consistentes ou indicadores geométricos simples quando forem necessários.
- Não use card dentro de card. Cada área de trabalho possui uma única superfície principal; agrupamentos internos usam linhas divisórias, espaçamento e hierarquia tipográfica.
- Bordas e separadores usam traço fino de `1px`. Sombras devem ser discretas e nunca substituir a hierarquia da interface.
- Toda tela deve funcionar entre 320px e desktop amplo, sem rolagem horizontal acidental. Ações e dados prioritários devem permanecer acessíveis em telas pequenas.
- O primeiro viewport deve exibir a tarefa principal, não conteúdo promocional.
- Interfaces com muitos dados devem priorizar tabela, lista virtualizada, filtros, busca e painéis de detalhe. Não reproduza milhares de registros como cartões.

## Escala e desempenho

- Toda listagem persistida deve nascer com paginação no servidor, ordenação determinística e filtros indexáveis. Prefira cursor a `offset` para grandes volumes.
- Consultas carregam apenas colunas necessárias (`select` explícito), evitam N+1 e sempre recebem limites máximos.
- Cada nova consulta deve ser acompanhada de índices no Prisma quando houver filtro, ordenação ou relacionamento frequente.
- Operações longas — monitoramento, ingestão de logs, geração de PDF, notificações e análise de IA — devem ser executadas por worker/fila, nunca dentro da resposta HTTP que atende o usuário.
- Logs são eventos append-only, com retenção, severidade, origem e paginação. Não armazenar payloads ilimitados no banco principal.
- APIs validam entrada, devolvem payloads pequenos, têm limites de tamanho e não expõem segredos.
- Use componentes de servidor por padrão. Adicione `"use client"` somente para interação real. Carregue módulos pesados sob demanda.

## Organização de código

- Organize funcionalidades em `src/features/<dominio>/` com `components`, `queries`, `services`, `schemas` e `types` quando o domínio crescer além de uma rota simples.
- Rotas em `src/app/api` devem ser finas: validam a requisição e delegam regra de negócio a serviços.
- Integrações externas ficam isoladas em `src/lib/integrations` ou no domínio correspondente; nunca misturadas a componentes visuais.
- Valores monetários são inteiros em centavos. Datas são armazenadas em UTC e formatadas com fuso explícito na interface.
- Migrações Prisma são versionadas junto com alterações de schema. Não aplicar `db push` em produção.

Consulte também `docs/standards.md` para as decisões de implementação.
