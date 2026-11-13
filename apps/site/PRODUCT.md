# Product

<!-- impeccable:product-schema 1 -->

> Registro de 2026-11-11, a partir do conteúdo do site e das respostas do responsável.

## Platform

web

## Users

- **Visitante do site (viniciusriudi.com):** donos de pequenos negócios e prestadores de serviço (educação física, fotografia, construtoras, imobiliárias, clínicas, advocacia, comércio local, restaurantes) e infoprodutores, procurando quem resolva a parte digital do negócio: site, sistema, automação ou tráfego. Muitas vezes no celular.
- **Página de tráfego (/trafego):** landing própria para quem quer anunciar: eventos, lojas e produtos digitais, negócios locais e de serviço. Pode receber visitas direto dos anúncios.
- **Portfólio (/portfolio):** quem quer conferir o trabalho entregue antes de conversar.

## Product Purpose

Site institucional de Vinicius Riudi, desenvolvedor de software e gestor de tráfego. Apresenta os serviços (software, tráfego e funis, ferramentas), mostra na prática como cada um funciona e leva o visitante a uma conversa pelo WhatsApp ou e-mail. Sucesso é o visitante entender o que precisa e chamar para conversar.

## Positioning

Uma só pessoa cuida dos anúncios, da página, do funil e da medição, e constrói o software em que o cliente acompanha os resultados direto, sem intermediário. Quem responde é quem faz o trabalho.

## Operating Context

- Valores não aparecem no site: o orçamento sai da conversa e vira proposta por escrito.
- Contrato assinado digitalmente; o cliente acompanha projeto, documentos e pagamentos na área do cliente (clientes.viniciusriudi.com).
- Tráfego: Meta Ads, Google Ads, Taboola e MGID. Inclui criação e gestão das campanhas, configuração de rastreamento, otimização contínua, relatório diário, software dedicado para acompanhar os resultados, reuniões semanais e atendimento direto. O investimento em anúncios é pago direto às plataformas; a gestão é cobrada à parte. Sem fidelidade; as contas de anúncio ficam no nome do cliente. Os criativos são produzidos pelo cliente, com orientação.
- A /trafego tem um quiz de 3 perguntas (negócio, se já anuncia, investimento mensal) que envia as respostas no WhatsApp. Investimento mínimo não aparece no site.
- Atendimento com IA: widget servido pela gestão, carregado em todas as páginas.

## Capabilities and Constraints

- Next.js estático, sem banco nem login. Todo o texto fica em `src/content/` (site.ts e portfolio.ts).
- Regras permanentes do repositório (AGENTS.md, docs/standards.md): sem emojis, sem card dentro de card, traço de 1px, 320px até desktop amplo sem rolagem horizontal, primeiro viewport com a tarefa principal.

## Brand Commitments

- Nome: Vinicius Riudi. Título: "Desenvolvedor de software".
- Logo: marca VR em `public/logo-vr.svg`.
- Tom: direto, em português simples, falando com "você", sem promessas exageradas.

## Evidence on Hand

- Projetos reais no portfólio: Pacelab e NutriPulse (`public/portfolio/`).
- Demonstrações interativas dos serviços, marcadas como exemplo (`src/components/service-demos.tsx`). Os números delas são ilustrativos.
- Resultados reais de tráfego, sem o nome do cliente, em `src/content/trafego.ts`: dois eventos de bilheteria (7,8x e 11,1x de retorno, com investido, faturado e métricas do relatório) e números gerais (+5 anos de atuação, +500 mil gerenciados em lojas, +300 mil em produtos digitais). Não inventar números, casos, depoimentos ou clientes além desses.

## Product Principles

1. Mostrar em vez de prometer: cada serviço é explicado com a prática, não com adjetivos.
2. Transparência de ponta a ponta: o cliente sabe o que está sendo feito, vê os resultados e é dono das contas.
3. Uma conversa como próximo passo: toda página termina num caminho claro para falar com quem faz.
4. Nada inventado: exemplo é marcado como exemplo; resultado real só com dado real.
