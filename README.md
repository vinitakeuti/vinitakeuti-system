# Vinicius Riudi

Repositório com os serviços de viniciusriudi.com. Cada pasta em `apps/` é um app independente, com dependências, Dockerfile e deploy próprios.

| App | Domínio | O que é |
| --- | --- | --- |
| `apps/gestao` | gestao.viniciusriudi.com e clientes.viniciusriudi.com | Gestão (financeiro, documentos, monitoramento, integrações) e portal do cliente. Next.js, Prisma e PostgreSQL. |
| `apps/site` | viniciusriudi.com | Site institucional. Next.js estático, sem banco. |

## Rodar localmente

```bash
cd apps/gestao && npm install && npm run dev   # http://localhost:3000
cd apps/site && npm install && npm run dev     # http://localhost:3200
```

## Deploy (Easypanel)

Um serviço por app, todos apontando para este repositório, com o caminho de build igual à pasta do app (`/apps/gestao`, `/apps/site`). Detalhes de cada app no README da pasta.

Padrões de código e interface: `AGENTS.md` e `docs/standards.md`.
