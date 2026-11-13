---
name: Vinicius Riudi, site
description: Site institucional de Vinicius Riudi. Preto, tipografia branca, janelas de dados em mono e um verde que só marca o que foi confirmado.
colors:
  accent: "#4b6156"
  accent-light: "#9fbcab"
  accent-soft: "#d3e3d8"
  bg: "#000000"
  depth: "#0a0a0a"
  surface: "#111111"
  charcoal: "#1f1f1f"
  line: "#1f1f1f"
  line-strong: "#2e2e2e"
  white: "#ffffff"
  cloud: "#d2d5d2"
  ash: "#8b918c"
  pewter: "#646a65"
  band-bg: "#f5f6f4"
  band-surface: "#eceeeb"
  band-line: "#d9ded9"
  band-line-strong: "#c3cac4"
  band-cloud: "#2a2f2b"
  band-ash: "#5f655f"
  band-pewter: "#7a807b"
typography:
  display:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.6vw, 5rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title-sm:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  lead:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "clamp(1rem, 1.3vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  mark: "2px"
  sm: "4px"
  pill: "9999px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  header: "68px"
  max: "1200px"
  section: "clamp(96px, 12vw, 128px)"
  heading-gap: "48px"
  split-gap: "64px"
components:
  button-primary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.cloud}"
  button-primary-large:
    backgroundColor: "{colors.white}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 20px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
  demo-window:
    backgroundColor: "{colors.depth}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
  demo-segment-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  closing-invite:
    backgroundColor: "{colors.depth}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "clamp(28px, 5vw, 64px)"
  light-band:
    backgroundColor: "{colors.band-bg}"
    textColor: "#000000"
    padding: "clamp(96px, 12vw, 128px) 0"
---

# Design System: Vinicius Riudi, site

## Overview

**Creative North Star: "A bancada de quem faz"**

O site é uma sala escura com instrumentos ligados. O fundo é preto puro, o texto é branco em Inter com espaçamento negativo, e tudo o que é prova (eventos, UTMs, métricas, etapas de um sistema) aparece dentro de janelas escuras com borda de 1px, barra de três pontos e texto em JetBrains Mono. A página explica com prática, não com adjetivo: cada serviço tem uma janela que funciona, marcada como EXEMPLO na própria barra.

A densidade é editorial nas seções e técnica dentro das janelas. Fora delas, a hierarquia vem de tamanho de tipo, linhas finas e espaço vertical generoso (seções a cerca de 96 a 128px uma da outra); dentro delas, de colunas, linhas tracejadas e mono pequena. Não há card dentro de card: a janela é a única superfície de uma área, e agrupamentos internos usam divisórias.

O verde da marca não decora. O verde escuro marca o que foi confirmado ou atribuído (a venda atribuída, o pagamento aprovado, a etapa ativa); o verde claro é o sinal ao vivo (pulsos, marcadores, números de etapa, destino que recebeu o evento). Cada página tem no máximo uma faixa clara, papel quase branco, onde as janelas escuras das demonstrações se destacam.

**Key Characteristics:**
- Preto puro com uma única superfície elevada por tom (#0a0a0a), nunca por sombra.
- Inter branca em display com tracking apertado; mono só para dados e rótulos técnicos.
- Janelas de demonstração com barra de três pontos e marca EXEMPLO como assinatura.
- Verde escuro para confirmado, verde claro para ao vivo; nada mais é verde.
- Linhas de 1px, contínuas entre blocos e tracejadas entre registros de dados.
- Botões em pílula branca; tudo o mais em cantos de 4px ou menos.

## Colors

Monocromático escuro com um único matiz, verde-cinza, dividido em dois papéis.

### Primary
- **Verde Identidade** (accent): estado confirmado ou atribuído. Fundo da linha "Venda atribuída" na janela de eventos, da confirmação de pagamento, das barras de gráfico, do sublinhado da categoria ativa, da seleção de texto. Em texto, só sobre a faixa clara.
- **Verde Sinal** (accent-light): o que está vivo ou em foco. Pulsos das linhas, marcadores quadrados de 6px, numeração de etapas em mono, destino que recebeu um evento, contorno de foco (2px). É o verde legível sobre o preto para texto pequeno.
- **Verde Névoa** (accent-soft): fundo do cabeçalho do serviço escolhido na faixa clara e de selos "ok" no documento claro. Nunca sobre o preto.

### Neutral
- **Preto** (bg): fundo de todas as páginas.
- **Profundidade** (depth): a única superfície elevada: janelas de demonstração, console da abertura, convite final.
- **Superfície** (surface): estado selecionado ou hover dentro de janelas e fundo do ghost em hover; também a cor do texto do botão branco.
- **Grafite** (charcoal / line): divisórias comuns e desenho de fundo (linhas da abertura, contorno do logo no convite final).
- **Linha Forte** (line-strong): borda de janelas, botões ghost, marcadores vazios e topo de listas estruturais.
- **Branco** (white): títulos, texto principal, botão primário.
- **Nuvem** (cloud): texto de itens de lista e hover do botão branco.
- **Cinza** (ash): parágrafos de apoio, links de navegação, rótulos.
- **Estanho** (pewter): numeração e metadados de menor peso.

### Faixa clara
Dentro da faixa clara os mesmos nomes de token são redefinidos para o papel #f5f6f4 (band-bg, band-surface, band-line, band-line-strong, band-cloud, band-ash, band-pewter; o branco vira preto e o verde sinal passa a ser o verde identidade). As janelas de demonstração dentro dela voltam aos valores escuros.

### Named Rules
**The Two Greens Rule.** Verde escuro significa confirmado; verde claro significa ao vivo. Uma terceira função para o verde (decoração, fundo de seção, ícone ilustrativo) é proibida.

**The One Light Band Rule.** Cada página tem no máximo uma faixa clara, e ela existe para receber demonstrações ou o catálogo de serviços. Ela redefine os tokens no próprio escopo; não cria cores novas.

## Typography

**Display Font:** Inter Variable (com Inter, system-ui, sans-serif)
**Body Font:** Inter Variable
**Label/Mono Font:** JetBrains Mono (com ui-monospace, monospace), pesos 400 e 500

**Character:** Uma grotesca neutra em peso 500 com tracking negativo carrega toda a voz; a mono é a voz da máquina e aparece só onde há dado de verdade ou rótulo técnico.

### Hierarchy
- **Display** (500, clamp 2.5 a 5rem, 1.02, -0.04em): o título de abertura de cada página, com `text-wrap: balance`. O nome no portfólio é a exceção assinada (600, até 12.5rem, -0.055em, 0.84).
- **Headline** (500, clamp 2 a 3rem, 1.1, -0.025em): título de seção e do convite final.
- **Title** (500, clamp 1.5 a 2rem, 1.15, -0.02em): título de bloco dentro de uma seção (cabeçalho do serviço, grupos do portfólio).
- **Title pequeno** (500, 18 a 20px, -0.015em): etapas, itens de acompanhamento, perguntas.
- **Lead** (400, clamp 1 a 1.125rem, 1.6, cor cinza): parágrafo que acompanha um título, com até 560 a 620px de largura e `text-wrap: pretty`.
- **Body** (400, 16px, 1.5 a 1.6, -0.01em): texto corrido; listas em 15 a 16px na cor nuvem.
- **Data** (mono 400, 13px, -0.02em): conteúdo das janelas; nomes de evento em 15px peso 500 sobre ele; horários com algarismos tabulares.
- **Label** (mono 500, 11 a 12px, +0.08 a 0.14em): barra das janelas, cabeçalho de colunas de dados (em caixa alta), numeração de etapas, rodapé.

### Named Rules
**The Mono Means Data Rule.** JetBrains Mono só aparece em dado, código, número de etapa, rótulo de coluna ou barra de janela. Nunca em título nem em frase de marketing.

**The 500 Ceiling Rule.** Títulos são peso 500. Peso 600 é reservado ao nome no portfólio e à marca no cabeçalho.

## Layout

Coluna central com largura máxima de 1200px mais as calhas (`gutter` de 16 a 40px). Seções separadas só por espaço (`section`, 96 a 128px), sem divisórias entre elas. O cabeçalho de seção é uma pilha alinhada à esquerda de até 720px, com 48px até o conteúdo; a home ainda centraliza alguns.

Composições recorrentes:
- **Título fixo e conteúdo rolando:** duas colunas (cerca de 0.8fr e 1.2fr, 64px de vão) com o título `sticky` abaixo do cabeçalho; vira uma coluna abaixo de 960px. Usado em área do cliente e perguntas.
- **Listas por linha:** grupos são linhas com borda superior forte e borda inferior comum por item, nunca grades de cards.
- **Janela em largura total:** a janela de demonstração ocupa toda a coluna abaixo do texto de abertura.

Pontos de quebra observados: 1180px (aperta o menu), 1080px (some a navegação), 960px (tudo vira uma coluna), 640px (menu móvel, cabeçalho 64px, botões de abertura esticam), 360px (ajustes finais de tabela e seletores). Nada pode rolar na horizontal entre 320px e desktop amplo.

## Elevation & Depth

Sem sombras de elevação. A profundidade é tonal: preto puro no fundo, #0a0a0a nas janelas, #111 no estado selecionado, sempre com borda de 1px. O cabeçalho ganha fundo preto a 88% com desfoque de 12px depois de rolar. Os únicos `box-shadow` do código são anéis de estado (anel de 4px no status "ok", anel interno no marcador da categoria ativa, brilho momentâneo do quadrado que acende na janela de eventos), não elevação.

### Named Rules
**The Tone Not Shadow Rule.** Uma superfície se separa do fundo por tom e borda de 1px. Sombra projetada não existe neste sistema.

## Shapes

Cantos discretos: 4px em janelas, convite final, cabeçalho do serviço e botões quadrados internos; 2px no documento claro e nos marcadores de estado; 1px nos marcadores quadrados de 6px. A pílula é exclusiva de botões, seletores segmentados e selos de status. Círculos aparecem só nos três pontos da barra, no status e no marcador de categoria. Bordas de 1px; contínuas entre blocos, tracejadas entre registros de dados dentro de janelas e listas de eventos.

O marcador quadrado (6px, canto 1px, verde sinal) é o glifo de lista do site: itens incluídos, recursos, faixa de segmentos.

## Components

### Buttons
Pílulas firmes e silenciosas.
- **Shape:** pílula (9999px), borda de 1px, texto 15px peso 500, seta que anda 3px no hover.
- **Primary:** fundo branco, texto #111, 44px de altura (50px na variante grande).
- **Hover / Focus:** fundo e borda vão para nuvem em 0.2s; foco com contorno verde sinal de 2px a 3px de distância.
- **Ghost:** transparente, borda linha forte, texto branco; hover com fundo superfície e borda cinza.
- **Na faixa clara:** o primário inverte para fundo preto e texto branco; dentro das janelas volta ao branco.

### Chips
- **Seletor segmentado:** contêiner em pílula com borda linha forte e 3px de respiro; opção ativa em fundo branco e texto #111; inativas em cinza.
- **Selos de status:** pílulas de 1px em mono 10 a 11px; o selo ativo usa borda verde sinal sobre fundo verde identidade.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** profundidade (#0a0a0a) com borda linha forte.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** 1px; divisórias internas de 1px, tracejadas entre registros.
- **Internal Padding:** 24px (16px no celular).
O sistema não tem cards de conteúdo; a janela de demonstração e o convite final são as únicas superfícies.

### Navigation
Cabeçalho fixo de 68px, transparente no topo e com fundo e linha depois de 160px de rolagem. Marca VR com nome e título em mono 11px; links em cinza 14px que vão ao branco no hover; página atual em branco. Abaixo de 640px, botão circular de 40px abre um painel com itens que entram em sequência; no portfólio, o cabeçalho mínimo abre uma barra lateral à direita.

### Janela de demonstração (assinatura)
Barra de 40px com três pontos de 9px, título central em mono 12px cinza e a marca EXEMPLO em mono 11px estanho à direita. Corpo em mono 13px. Toda janela com dados fictícios carrega EXEMPLO na barra.

### Convite final
Superfície profundidade com borda comum, contorno do logo VR em grafite ao fundo, título headline à esquerda e ações empilhadas à direita (WhatsApp primário, e-mail ghost, copiar e-mail).

### Perguntas
Acordeão de linhas com sinal de mais desenhado em círculo de 28px que gira 45 graus ao abrir, altura animada quando suportado. A home numera as perguntas em mono.

## Do's and Don'ts

### Do:
- **Do** colocar toda prova em uma janela de demonstração com barra de três pontos e EXEMPLO quando os dados forem ilustrativos.
- **Do** usar verde identidade (#4b6156) só para estado confirmado e verde sinal (#9fbcab) só para o que está ao vivo ou em foco.
- **Do** separar superfícies por tom (#000, #0a0a0a, #111) e borda de 1px.
- **Do** agrupar conteúdo em linhas com divisórias de 1px, tracejadas entre registros de dados.
- **Do** manter títulos em Inter 500 com tracking negativo e reservar a mono para dados e rótulos técnicos.
- **Do** desligar animações contínuas e mostrar o estado final quando `prefers-reduced-motion: reduce`.

### Don't:
- **Don't** usar sombra projetada para elevar superfícies.
- **Don't** colocar card dentro de card nem transformar listas em grades de cards.
- **Don't** usar mais de uma faixa clara por página.
- **Don't** usar o verde como decoração, fundo de seção ou cor de título.
- **Don't** escrever títulos ou frases de marketing em mono.
- **Don't** usar pílula fora de botões, seletores e selos.
- **Don't** usar emojis; indicadores são quadrados, círculos e linhas desenhados em CSS.

## Exceção: a página de tráfego (/trafego)

A /trafego é uma landing com mundo próprio, definido pelo responsável a partir de uma referência em HTML entregue por ele (`landing-trafego.html`, guardada fora do repositório), e não segue as regras escuras acima. Fundo branco com textura de pontos, verde-oliva (#3e4d22, #2f3a1b, #4b5e2a, #9db36a, #c9d6a3) e texto #1e2414; uma família só, Bricolage Grotesque (pacote local `@fontsource-variable/bricolage-grotesque`, com tamanho óptico): títulos em 800 e texto corrido nos tamanhos pequenos da mesma fonte. Tem cabeçalho e rodapé próprios, rótulos em caixa alta acima dos títulos, cartões arredondados (6 a 14px) com sombras suaves e botões retangulares de canto 8px. Os tokens e componentes ficam todos em `src/app/trafego/trafego.css`, dentro de `.tf-page`; mudanças nessa página seguem a referência, não este documento.
