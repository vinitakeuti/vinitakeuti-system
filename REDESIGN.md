# Redesign da interface — apps/gestao

Branch: `design/redesign-geral`. Escopo: somente interface e experiência de `apps/gestao`. `apps/site` não é tocado.

> Status: plano (escrito antes de qualquer alteração de código). O relatório final substitui esta seção ao término.

## 1. Inventário

### Áreas

| Área | Domínio | Rotas | Shell |
|---|---|---|---|
| Acesso | gestão e clientes | `/entrar` | `auth-shell` próprio |
| Gestão | gestao.viniciusriudi.com | 50 páginas (abaixo) | `app-shell` + `AppSidebar` |
| Área do cliente | clientes.viniciusriudi.com | `/portal`, `/portal/servicos`, `/portal/pagamentos`, `/portal/documentos`, `/portal/configuracoes` | `app-shell` + `PortalSidebar` via `PortalShell` |
| Landing mínima (encontrada no código) | viniciusriudi.com quando servido por este app | `/` (host landing) | `landing-shell` |
| Widget de atendimento (encontrado no código) | embutido no site | `/widget/atendimento.js` | estilos próprios no script, fora do escopo visual desta etapa |
| E-mails e PDFs (encontrados no código) | saída, não tela | `features/notifications/templates`, `features/quotes/services/*pdf*` | fora do escopo: são documentos com medidas próprias |

### Telas da gestão

- Visão geral: `/`
- Eliza (assistente): `/assistente`
- Atendimentos: `/atendimentos`, `/atendimentos/[id]`
- Agenda: `/agenda` (semana, mês, arquivo, pop-up de evento)
- Clientes: `/clientes`, `/clientes/novo`, `/clientes/[id]` (abas), `/clientes/[id]/editar`, `/clientes/[id]/assinaturas/nova`
- Financeiro: `/financeiro`, `/financeiro/lancamentos/[id]`, `/financeiro/custos-fixos`, `/financeiro/custos-fixos/[id]`, `/financeiro/condicoes`
- Documentos: `/documentos`, `/documentos/novo`, `/documentos/[id]/editor`, `/documentos/texto-padrao`
- Orçamentos: `/orcamentos`, `/orcamentos/novo`, `/orcamentos/[id]`, `/orcamentos/[id]/editar`, `/orcamentos/[id]/editor`, `/orcamentos/parametros`, `/orcamentos/pendentes`, `/orcamentos/texto-padrao`
- Vendas: `/vendas`, `/vendas/nova`
- Serviços: `/servicos`, `/servicos/novo`, `/servicos/[id]`, `/servicos/categorias`
- Monitoramento: `/monitoramento`, `/monitoramento/novo`, `/monitoramento/[id]`, `/monitoramento/guia`
- Integrações: `/integracoes`, `/integracoes/asaas`, `/integracoes/ia`
- Configurações: `/configuracoes` (e-mail, senha, logs), `/configuracoes/profissional`

### Componentes compartilhados

`app-sidebar`, `sidebar-toggle`, `logo`, `notification-list`, `copy-text-button`, `document-input`, `rich-text-content`, `budget-calculator`, `client-picker`, `phone-input`, `confirm-submit-button`, `counterparty-field`, `portal-shell`, `portal-sidebar`, `portal-due-card`, `installment-picker`, abas (`client-tabs`, `settings-tabs`, `quote-tabs`, `monitor-tabs`), painéis (`settings-panel`, `directory-surface`, `client-panel`, `monitor-panel`), ações (`primary-action`, `secondary-action`, `danger-action`, `text-link`, `table-link`), mensagens (`form-error`, `form-success`, `directory-empty`, `settings-empty`, `list-empty`).

Estilos: um único `src/app/globals.css` (2.654 linhas compactadas, ~72 mil tokens) e `financeiro.module.css`. Não há Tailwind nem biblioteca de componentes.

### Diagnóstico do visual atual

- Mundo "editorial": barra lateral preta, verde `#4b6156`, cantos retos, rótulos em JetBrains Mono maiúsculo com espaçamento largo (321 usos de mono, 46 `uppercase`, ~1.000 textos digitados em caixa alta nos componentes).
- Kickers acima de todo título ("GESTÃO / OPERAÇÃO / 01", 97 ocorrências) e números de seção na navegação (01 a 12).
- Escala tipográfica sem sistema: mais de 50 tamanhos distintos, muitos entre 8px e 10px (`.5rem` a `.62rem`), abaixo do mínimo legível.
- ~200 cores fixas espalhadas, sem tokens semânticos de estado.
- Sem `loading.tsx`, `error.tsx` ou `not-found.tsx`: navegação lenta não mostra nada e erros caem na página padrão do Next.

## 2. Direção

Modo **Operate** (a skill Impeccable classifica as duas áreas como superfícies de trabalho). O brief fixa a identidade (logo, verde, nome), então o mundo é **evoluído, não substituído**; não há rodada de conceitos.

- **Cor (estratégia contida):** verde `#4b6156` como cor de ação, seleção e marca. Barra lateral escura puxada para o verde (em vez de preto puro), mantendo o logo invertido. Neutros levemente esverdeados. Tokens de estado: sucesso, atenção, crítico, informação, neutro, cada um com fundo, traço e texto.
- **Tipografia:** Inter para toda a interface, com algarismos tabulares em dados. JetBrains Mono só para código, URLs, chaves e identificadores. Escala fixa em rem (12, 13, 14, 15, 16, 18, 20, 24, 30), mínimo de 12px. Rótulos em caixa normal, peso 500.
- **Forma:** raio de 6px em controles e 8px em superfícies; traço de 1px; sombra discreta só em sobreposições e na superfície principal.
- **Navegação:** ícones desenhados (SVG próprio, traço único) no lugar dos números 01 a 12; item ativo com fundo tingido.
- **Cabeçalhos:** kicker vira trilha de navegação discreta quando indica caminho; kickers decorativos saem; título sem ponto final.
- **Estados:** foco visível em todos os controles, alvos de 44px no celular, esqueleto de carregamento, página de erro e de não encontrado.

## 3. Plano de execução

1. Documentos de contexto: `apps/gestao/PRODUCT.md` e este plano. Commit.
2. Formatação mecânica do `globals.css` (uma regra por linha, sem mudança de valor) para que os diffs seguintes sejam legíveis. Commit.
3. Base compartilhada: tokens (`tokens.css`), mapeamento das variáveis antigas para os tokens, normalização da escala tipográfica e das cores fixas, componentes base (shell, barra lateral com ícones, cabeçalhos, botões, campos, tabelas, abas, painéis, mensagens), estados globais (carregamento, erro, não encontrado). Commit.
4. Caixa de texto: textos digitados em maiúsculas viram caixa normal, preservando siglas. Commit.
5. Áreas, um commit cada, com build e checagem de tipos após cada um:
   - Acesso e landing mínima
   - Visão geral
   - Clientes
   - Financeiro
   - Documentos e orçamentos (sem alterar a prévia que espelha o PDF)
   - Vendas e serviços
   - Agenda, atendimentos e Eliza
   - Monitoramento
   - Integrações e configurações
   - Área do cliente
6. `apps/gestao/DESIGN.md` com o sistema entregue e relatório final neste arquivo. Commit.

## 4. Verificação

- Após cada commit: `npm run build` (inclui `prisma generate`, sem acesso a banco) e `npm run lint` (`tsc --noEmit`, que é a checagem de tipos do projeto; não há ESLint configurado).
- Visual: o app depende de banco e sessão para quase todas as telas, e não há banco disponível nem permissão para escrever em um. A verificação visual usa o `/entrar` real e páginas de amostra (HTML estático com as classes reais e o CSS compilado) renderizadas no Chromium em 1440px e 375px.
