# Redesign da interface — apps/gestao

Branch: `design/redesign-geral` (16 commits sobre a `main`, nada enviado ao remoto). Escopo: somente interface e experiência de `apps/gestao`. `apps/site` não foi tocado.

## Skill Impeccable

A skill Impeccable foi carregada no início do trabalho, antes de qualquer alteração, e guiou todas as decisões. Referências consultadas:

- `SKILL.md` e o script de contexto (`impeccable context`): modos (Operate para gestão e área do cliente), princípios e roteamento.
- `reference/init.md`: registro do produto. Resultado em `apps/gestao/PRODUCT.md`.
- `reference/new-work.md`: decisão entre estender, expandir ou substituir o mundo visual; estratégia de cor (§4); calibração contra os visuais padrão de IA.
- `reference/operate.md` e `reference/mode-operate.md`: **tipografia** (uma família, escala fixa em rem, razão 1,125 a 1,2), **cor** (estratégia contida, vocabulário de estados), **layout** (responsividade estrutural), **componentes** (todos os estados), **movimento** (150 a 250 ms, só para estado).
- `reference/craft-floor.md`: piso de qualidade (contraste, foco, seleção, barras de rolagem, algarismos tabulares) e proibições (kicker acima de título, filete lateral colorido, numeração decorativa, mono como fantasia, glifo Unicode no lugar de ícone).
- `reference/document.md`: formato do `apps/gestao/DESIGN.md`.
- Detector `impeccable detect`, rodado sobre o código e a tela de entrada ao final.

O comando `polish` não foi executado.

Substituições registradas, conforme a própria skill exige:

- **Entrevista de produto:** não houve, porque você avisou que ninguém estaria disponível. `PRODUCT.md` foi inferido do código e do seu pedido, com os itens inferidos marcados.
- **Rodada de conceitos visuais (`concept-seed`):** não executada. O brief fixa a identidade (logo, verde e nome), então o caso é o de "mundo estabelecido": evoluir, não substituir. A construção foi direta em código, como a skill indica para telas de trabalho.

## Como foi verificado

- Depois de cada commit: `npm run lint` (é o `tsc --noEmit`, a checagem de tipos do projeto; não há ESLint configurado) e `npm run build`. **Todos passaram em todos os commits.** Nada precisou ser revertido.
- Visual: o app depende de banco e sessão em quase todas as telas, e não havia banco nem permissão para criar um. Verifiquei de duas formas:
  - a tela real `/entrar`, pelo servidor de produção local, sem banco;
  - páginas de amostra com as classes reais dos componentes e o CSS compilado do build, no Chrome em 1440, 900 e 375 px. Foram amostradas: Clientes (lista, perfil e formulário), Visão geral, Financeiro, Documentos, Nova proposta, Vendas, Monitoramento, Integrações com logs e a área do cliente. Nenhuma teve rolagem horizontal.
- Telas que **não** foram verificadas visualmente (só build e tipos): Agenda, Eliza, Atendimentos, editor de PDF (barra e painéis), Pagamentos e Documentos do portal, landing mínima.

## O que mudou, por área

| Commit | Área | Resumo |
|---|---|---|
| `a7f6274` | Plano | Inventário, direção e plano (versão anterior deste arquivo) e `PRODUCT.md`. |
| `75f838b` | Preparação | `globals.css` e `financeiro.module.css` formatados com uma regra por linha. Mudança só de formato: comparei o CSS compilado antes e depois e ele é idêntico. |
| `7bfde73` | Base | `tokens.css` (cores, estados, tipografia, espaço, raios, sombras, movimento). Normalização por script: 844 tamanhos de fonte passados para a escala (mínimo de 12px), 248 cores fixas trocadas por tokens, caixa alta e espaçamento largo removidos dos rótulos. `system.css` com shell, navegação, cabeçalhos, botões, campos, tabelas, abas, superfícies, mensagens, foco, seleção e barras de rolagem. Ícones SVG próprios no lugar de 01 a 12. Barra de progresso entre rotas e páginas de erro e de não encontrado. |
| `61518c6` | Base | 867 textos digitados em caixa alta passados para caixa normal, preservando siglas e nomes próprios. Frases que citavam botões em maiúsculas passam a citá-los entre aspas. |
| `662ae27` | Base | Kickers decorativos removidos. Subpáginas ganharam trilha com link para a seção-mãe. Títulos sem ponto final. Blocos pretos viraram verde de ação. Filetes laterais viraram borda de 1px. |
| `32b8d18` | Acesso | Login com selo "Gestão" ou "Área do cliente", superfície e campos de 44px, versão de celular sem bordas. Landing mínima com título controlado. |
| `2bf721d` | Visão geral | Valor do mês sem quebra de linha, sinais com cor semântica. As linhas de monitoramento e de próximos pagamentos agora abrem o sistema ou o lançamento (antes mostravam › sem serem clicáveis). |
| `824ce28` | Clientes | Perfil, abas e fichas. Selos de situação de 8 classes diferentes unificados em um só desenho. |
| `03cbcdf` | Financeiro | Superfícies do módulo, botões, situação em pílula. Corrigida a barra lateral que encolhia em telas largas com tabela. |
| `e7250c9` | Documentos | Seletor de tipo como controle segmentado (rolável no celular), filtros, busca de cliente, etapas da proposta. |
| `4ca83a6` | Vendas e serviços | Resumo comercial, filtro de período, menus de ação, grupos do catálogo. |
| `90f73cd` | Agenda, atendimentos, Eliza | Eventos sem filete lateral, modal e conversa no padrão do sistema. Código volta para fonte mono. A prévia do PDF mantém a fonte mono original. |
| `aab12c6` | Monitoramento | Painel de situação, cartões de sistema, ação Verificar. |
| `f8edf2f` | Integrações e configurações | Lista sem a numeração 01, 02 e 03; modelos de e-mail; logs. |
| `121e771` | Área do cliente | Boas-vindas, pagamento em destaque (verde, ou vermelho quando atrasado), jornada, pendências, contato, cronograma de parcelas, documentos. |
| `50759a2` | Agenda | Filetes coloridos restantes, apontados pelo detector, removidos. |
| (este commit) | Relatório | `REDESIGN.md` final e `apps/gestao/DESIGN.md`. |

## Decisões de design e motivos

1. **Evoluir a identidade em vez de trocá-la.** Ficaram o logo, o verde `#4b6156` e o nome. O preto puro da barra lateral virou um verde muito escuro (`#141a17`): mantém o contraste e o logo invertido, mas liga a barra à cor da marca.
2. **O verde passou a ser a cor de ação.** Antes os botões primários eram pretos e o verde aparecia solto. Agora o verde marca ação, seleção e foco, e só isso. O visual fica mais calmo e o próximo passo fica mais óbvio.
3. **Inter em toda a interface; mono só para código.** O visual antigo usava JetBrains Mono em caixa alta em 321 lugares, como fantasia de "técnico". Isso cansa a leitura e é um padrão típico de interface gerada por IA. Mantive a Inter, que o projeto já carregava (sem dependência nova). O detector da skill sinaliza a Inter como fonte "batida". Mantive mesmo assim: em tela de trabalho a skill recomenda uma fonte de interface consolidada, e trocar a fonte é decisão de marca (está nos pontos para você decidir).
4. **Escala fixa com mínimo de 12px.** Havia mais de 50 tamanhos, vários entre 8 e 10px. Agora são 10 passos fixos.
5. **Caixa normal em todos os textos.** A caixa alta digitada foi convertida, com siglas preservadas. Nenhum texto com informação foi removido.
6. **Kickers e numeração.** Saíram as trilhas que só repetiam a área ("Gestão / Operação / 01", "Monitoramento / Live") e os números 01 a 12 e 01 a 03. As que carregam informação viraram trilha com link (subpáginas) ou ficaram como legenda discreta (por exemplo "Próximos 7 dias" e "Seu projeto · código"). A numeração de 01 a 05 das etapas da proposta ficou, porque a sequência importa.
7. **Selos de situação unificados.** Oito desenhos diferentes viraram uma pílula com quatro tons semânticos, sempre com texto.
8. **Raios discretos (6, 8 e 12px) e sombra mínima.** Os cantos retos combinavam com o visual editorial antigo. Raios pequenos deixam a interface mais acolhedora para o cliente sem perder a sobriedade.
9. **Prévias do PDF intactas.** O editor espelha o PDF em medidas próprias (`cqw`, pontos). Todas as normalizações excluíram essas regras, e a fonte mono foi restaurada nos rótulos da prévia que dependiam dela.
10. **Carregamento: barra de progresso no topo em vez de `loading.tsx`.** Cada página monta a própria barra lateral. Um `loading.tsx` trocaria a página inteira, barra lateral incluída, por um esqueleto a cada clique, e a navegação ia piscar. A barra no topo dá retorno imediato sem esse efeito. Os estilos de esqueleto (`.skeleton`, `.route-loading-*`) ficaram prontos em `system.css`, para uso futuro dentro das páginas.
11. **Cartões do monitoramento mantidos.** O padrão do repositório desaconselha cartões para listas grandes, mas a lista é paginada de 50 em 50 e a troca por tabela mudaria a estrutura da tela. Melhorei o visual e deixei a mudança de estrutura como ponto para você decidir.
12. **Nenhuma dependência nova.** Prettier e Playwright foram usados como ferramentas temporárias via `npx`, fora do projeto. O `package.json` não mudou.

## O que ficou de fora

- **Nada foi revertido.** Todos os commits passaram em build e tipos.
- Folhas e capas que espelham o PDF, e-mails (`features/notifications/templates`) e o widget de atendimento embutido no site (`attendance-widget.ts`) não foram alterados. São saídas com medidas próprias, fora da interface.
- Ainda há cores fixas pontuais fora das prévias do PDF: 161 ocorrências (138 valores) no `globals.css` e 37 (18 valores) no `financeiro.module.css`, quase todas tons muito próximos dos tokens, em regras específicas de Agenda, editor e IA. Não mudam a percepção, mas ficaram fora dos tokens.
- O `globals.css` continua sendo um arquivo grande com camadas de sobrescrita. O `system.css` vem por cima dele. A limpeza estrutural (separar por domínio e remover regras mortas, como `.nav-code` e `.profile`) ficou para depois, porque mexer na ordem da cascata sem ver as telas reais é arriscado.
- O detector ainda aponta "card dentro de card" na tela de entrada, que sem `AUTH_SECRET` local exibe o aviso de configuração dentro da superfície. A causa mais provável é esse aviso com borda e raio dentro do formulário, mas não confirmei qual elemento o detector apontou. Mantive, porque mensagem de erro com borda dentro do formulário é o padrão esperado.

## Pontos que precisam da sua decisão

1. **Fonte.** Manter a Inter (atual, segura e neutra) ou escolher uma fonte de interface com mais personalidade para a marca. É o único item em que o detector discorda da minha escolha.
2. **Monitoramento em tabela?** Os cartões funcionam até algumas dezenas de sistemas. Se a lista crescer, vale trocar por tabela, que é o padrão do repositório.
3. **Legendas acima de títulos de seção.** Várias seções ainda têm uma legenda curta acima do título (por exemplo "Fluxo realizado", "Próximos 7 dias", "Propostas em aberto"). Mantive por carregarem algum contexto. Eliminar todas deixaria a interface mais limpa, mas exige reescrever títulos.
4. **Cor dos tipos de evento da Agenda.** "Atendimento" usa quase preto (`#111`) e "Tarefa" um azul acinzentado. Hoje o tipo aparece como fundo tingido e marcador; talvez você queira uma paleta de tipos pensada junto com o verde.
5. **Selo "Gestão" ou "Área do cliente" no login.** É texto novo, adicionado para o cliente saber onde está. Confirme se deseja manter.
6. **Linhas clicáveis na Visão geral.** Agora abrem o sistema monitorado e o lançamento correspondentes. Confirme se esse é o destino desejado.

## Sugestões para a etapa final de polish

- Revisar com dados reais e logado: Agenda (semana, mês, arquivo, pop-up), Eliza, Atendimentos, editor de PDF e o fluxo de assinatura do portal, as telas que eu não pude ver renderizadas.
- Passar as cores fixas restantes para tokens: `grep -nE "#[0-9a-f]{6}" apps/gestao/src/app/globals.css`, excluindo as regras do PDF.
- Unificar os rótulos de campo restantes em uma classe utilitária (`.field-label`) e remover as variações por tela.
- Usar o esqueleto (`.skeleton`) nos trechos que carregam no cliente: busca de cliente, modelos de IA e propostas de referência.
- Conferir contraste das legendas de 12px sobre superfícies tingidas (pagamento atrasado, painel de atenção do monitoramento).
- Dividir o `globals.css` por domínio (shell, clientes, financeiro, documentos, agenda, IA, portal), mantendo a ordem da cascata.
- Avaliar uma variação de cor da barra lateral para a área do cliente (por exemplo, o mesmo verde mais claro). Hoje ela é idêntica à da gestão, o que reforça o "mesmo sistema", mas uma leve diferença ajudaria você a nunca confundir as duas abas abertas.
- Revisar as frases de estado vazio, para que cada uma ensine o próximo passo com um botão.

## Revisão após o primeiro teste local

Ajustes pedidos depois de rodar o app com dados reais:

1. **Botão de exibir a navegação encostava nos títulos.** Com a barra recolhida, a área de trabalho agora reserva espaço à esquerda para o botão fixo.
2. **Movimentações do Financeiro espremidas.** A tabela ganhou respiro vertical nas linhas e largura mínima (rola dentro da superfície em telas estreitas). Vencimento, valor e situação não quebram mais linha; o texto de pagamento parcial quebra só entre "Recebido ... ·" e "falta ...". "Parcial" e "Programado" passaram a usar os tons de informação e neutro.
3. **Ícone da Eliza deformado.** Era um bug do script de caixa de texto: ele passou para minúsculas os comandos do desenho SVG do logo VR (`H`/`L` viraram `h`/`l`, que têm outro significado no SVG). O desenho foi restaurado exatamente como estava na `main` e agora aparece numa placa escura com cantos suaves, igual à barra lateral. Conferi todos os outros SVGs e atributos técnicos alterados pela branch; nenhum outro foi afetado.

## Nova Visão geral

A estrutura saiu de uma rodada de decisão da Impeccable: três propostas sorteadas entre sete candidatas, e você escolheu **Indicadores e três colunas**.

- **Faixa de indicadores:** recebido no mês (com o percentual do previsto e um mini-histórico de 6 meses), a receber no mês, em atraso e saldo realizado.
- **Hoje:** a agenda do dia, cada item abrindo o evento, e o que vence hoje.
- **Próximos 7 dias:** o que entra e o que sai, com as atrasadas primeiro e o total de entradas e saídas.
- **Operação:** sistemas fora do ar ou lentos, atendimentos novos, propostas aguardando decisão e orçamentos por concluir, cada um com o atalho para resolver. Quando não há nada, aparece "Tudo em ordem".
- **Olho de ocultar valores:** botão pequeno, só ícone, no cabeçalho. Troca todos os valores em dinheiro por "R$ •••••" e esconde as barras do histórico. A escolha fica num cookie de preferência, então a tela já abre no estado escolhido, sem piscar os valores.
- **Dados:** só consultas já existentes nas telas de cada área (agenda, financeiro, atendimentos, orçamentos, monitoramento). Nenhuma mudança de banco ou API. O componente antigo de notificações descartáveis (`notification-list.tsx`) saiu, porque a coluna Operação cobre o que ele mostrava.
- **Ficou de fora:** "Via assinada para conferir". Contar isso pede uma consulta por `reviewStatus`, que não tem índice; criar o índice exige migration.
