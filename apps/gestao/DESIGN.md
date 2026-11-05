---
name: VR Gestão
description: Sistema de gestão e área do cliente de Vinicius Riudi. Sóbrio, legível e rápido de operar.
colors:
  brand-green: "#4b6156"
  brand-green-hover: "#3f5249"
  brand-green-active: "#33433b"
  brand-green-soft: "#edf2ef"
  brand-green-soft-strong: "#dfe8e2"
  brand-green-border: "#c4d3c9"
  shell: "#141a17"
  shell-raised: "#1d2521"
  shell-active: "#26312b"
  shell-border: "#2a332e"
  shell-text: "#c9d0cb"
  shell-text-muted: "#8f9a93"
  bg: "#f3f5f3"
  surface: "#ffffff"
  surface-subtle: "#fafbfa"
  surface-sunken: "#ebeeeb"
  border: "#dde2de"
  border-strong: "#c6cec9"
  input-border: "#b9c2bc"
  text: "#171c19"
  text-secondary: "#525a55"
  text-muted: "#6b746e"
  success-ink: "#24603f"
  success-bg: "#ebf4ee"
  success-border: "#bcd8c6"
  success-mark: "#2f7a55"
  warning-ink: "#7a5122"
  warning-bg: "#fbf3e6"
  warning-border: "#ead5b4"
  warning-mark: "#c18a2c"
  danger-ink: "#8c3a22"
  danger-bg: "#fbefea"
  danger-border: "#ebc6b8"
  danger-mark: "#b2492c"
  danger-solid: "#9c3f25"
typography:
  page-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.92em"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-green-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.sm}"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  badge:
    rounded: "{rounded.full}"
    padding: "1px 9px"
    typography: "{typography.caption}"
  nav-item-active:
    backgroundColor: "{colors.shell-active}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: "38px"
---

# VR Gestão

Fonte de verdade em código: `src/app/tokens.css` (tokens), `src/app/system.css` (componentes compartilhados e ajustes por área), `src/app/globals.css` (layout das telas, normalizado para os tokens).

## Overview

Superfície de trabalho (modo Operate) para duas audiências do mesmo sistema: o dono da operação na Gestão e os clientes na Área do cliente. A identidade parte do logo VR e do verde `#4b6156`. O visual é contido: neutros levemente esverdeados, uma cor de ação, estados semânticos explícitos e tipografia de interface única. A marca aparece nos detalhes: a barra lateral escura puxada para o verde, o verde nas ações e na seleção, os selos em pílula.

## Colors

Estratégia contida. O verde de marca é reservado a ações primárias, seleção (aba ativa, filtro ativo, etapa atual) e indicadores de foco. Nunca é decoração.

- Fundo da aplicação em `bg`; superfícies de trabalho em `surface`; cabeçalhos de tabela, filtros e rodapés em `surface-subtle`.
- Texto principal em `text`; descrições em `text-secondary`; metadados e rótulos de apoio em `text-muted` (contraste AA garantido sobre branco).
- Estados sempre em trinca (texto, fundo, traço) e com rótulo escrito: sucesso, atenção, crítico, informação (o próprio verde) e neutro. Cor nunca é o único sinal.
- Barra lateral em `shell`, com texto `shell-text` e item ativo em `shell-active`.

## Typography

Uma família só: Inter Variable para toda a interface, com algarismos tabulares em tabelas, datas e valores. JetBrains Mono apenas para código, URLs técnicas, chaves e identificadores (e para os elementos que espelham o PDF).

Escala fixa em rem (sem tipografia fluida): 12, 13, 14, 15, 16, 18, 20, 24, 28 e 34px. Nada abaixo de 12px. Rótulos em caixa normal, peso 500, sem espaçamento largo. Títulos sem ponto final.

## Layout

- Shell: barra lateral de 248px (trilho de 72px entre 641 e 980px; gaveta de largura total no celular) e área de trabalho de até 1440px com 40px de respiro lateral (16px no celular).
- Cabeçalho de página: trilha discreta (só em subpáginas), título, descrição de até 64 caracteres por linha e ações à direita; linha de 1px abaixo.
- Uma superfície principal por área de trabalho; agrupamentos internos por linha divisória e espaço, nunca card dentro de card.
- Listas longas em tabela com paginação por cursor e versão em lista no celular.

## Elevation & Depth

Profundidade mínima. Superfícies em repouso usam traço de 1px e sombra `0 1px 2px rgba(18,23,20,.05)`. Sobreposições (menus, resultados de busca, pop-ups) usam `shadow-md`/`shadow-lg`. Foco: anel de 3px em verde a 28% além do traço verde. Movimento de 120 a 260ms, sempre de estado, com `prefers-reduced-motion` respeitado.

## Shapes

Raio de 6px em controles, 8px em superfícies, 12px em pop-ups, na tela de entrada e no pagamento em destaque do portal. Selos, contadores e marcas de iniciais são pílulas ou círculos. Traço sempre de 1px; filetes laterais coloridos não existem no sistema.

## Components

- Botões: primário verde, secundário branco com traço forte, perigo com texto vermelho que preenche ao passar o mouse, link de texto em verde. 40px de altura (44px no celular).
- Campos: 40px, traço `input-border`, foco em verde com anel.
- Tabelas: cabeçalho em `surface-subtle`, linhas de 56px, primeira coluna em tinta principal.
- Abas: sublinhado verde de 2px na ativa, contador em pílula.
- Selos de situação: pílula de 22px com o tom do estado (classes `.doc-pill`, `.settings-badge`, `.portal-tag`, `.documents-status`, `.sale-status`, `.client-finance-status`, `.settings-level`, `.agenda-status`).
- Navegação: ícones SVG próprios em `src/components/nav-icon.tsx`, traço de 1,6px.
- Estados de rota: barra de progresso no topo (`RouteProgress`), `error.tsx` e `not-found.tsx` com a marca.

## Do's and Don'ts

- Faça: escreva rótulos e botões em caixa normal; mantenha siglas (PDF, CPF, CNPJ, Pix).
- Faça: use os tokens de estado para qualquer situação; acompanhe a cor com texto.
- Faça: alinhe valores monetários com algarismos tabulares.
- Não faça: kicker em caixa alta acima de título, numeração decorativa (01, 02...), mono como fantasia de "técnico".
- Não faça: filete colorido em um lado de card, item de lista ou alerta.
- Não faça: alterar as prévias do editor que espelham o PDF com tokens da interface; elas seguem as medidas do PDF.
