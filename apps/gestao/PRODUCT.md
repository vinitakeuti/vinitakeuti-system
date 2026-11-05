# Product

<!-- impeccable:product-schema 1 -->

> Registro inferido do código e do pedido de redesign de 2026-11-05, sem entrevista (o responsável estava indisponível).
> Itens marcados com (inferido) devem ser confirmados.

## Platform

web

## Users

- **Gestão (gestao.viniciusriudi.com):** Vinicius Riudi, desenvolvedor de software e dono da operação, no dia a dia de trabalho, em desktop e no celular. Papéis previstos no código: profissional, comercial, marketing, afiliado e contador. O trabalho é rápido e recorrente: conferir o caixa, abrir um cliente, montar uma proposta, reagir a um sistema fora do ar.
- **Área do cliente (clientes.viniciusriudi.com):** pessoas que já são clientes. Entram para acompanhar o projeto, pagar parcelas, assinar e baixar documentos e falar com o responsável. Uso esporádico, frequentemente no celular (inferido).

## Product Purpose

Sistema de gestão da empresa de Vinicius Riudi: clientes, financeiro, documentos (propostas, contratos, cessões, memoriais), vendas, catálogo de serviços, agenda, atendimentos, monitoramento de sistemas, integrações (Asaas, IA) e a assistente Eliza. A área do cliente expõe ao cliente o que é dele: serviços, pagamentos, documentos e contato. Sucesso é o dono trabalhar rápido e o cliente sentir organização e cuidado.

## Positioning

Não é um produto de marketing. Ninguém chega aqui para ser convencido; chega para acompanhar, consultar e resolver. Gestão e área do cliente são partes do mesmo sistema.

## Operating Context

- Valores monetários em centavos; datas em UTC exibidas no fuso America/Maceio.
- Listas paginadas por cursor ("Carregar próximos 50").
- Documentos têm editor que espelha o PDF gerado (as medidas da prévia seguem o PDF e não fazem parte do visual da interface).
- Uma landing mínima é servida no domínio raiz por este app; o site institucional fica em `apps/site`.

## Capabilities and Constraints

- Regras permanentes do repositório (AGENTS.md, docs/standards.md): sem emojis, sem card dentro de card, traço de 1px, 320px até desktop amplo sem rolagem horizontal, primeiro viewport com a tarefa principal, dados densos em tabela/lista com filtros.
- Mudanças de interface não podem alterar lógica de negócio, rotas, APIs, autenticação, permissões ou validação.

## Brand Commitments

- Nome: Vinicius Riudi. Título de marca: "Desenvolvedor" (`BRAND_TITLE`).
- Logo: marca VR em `public/assets/images/logo-vr.svg` (preto; invertido sobre fundo escuro).
- Cor principal: verde `#4b6156`.
- Tom: profissional, sóbrio e confiável. Clareza, legibilidade e eficiência acima de efeitos.

## Evidence on Hand

Sem depoimentos, números de clientes ou casos publicados neste app. Não inventar.

## Product Principles

1. A tarefa vem antes da marca: cada tela abre no que o usuário veio fazer.
2. Estado sempre explícito: situação, vencimento e atraso são lidos sem interpretação.
3. Um só sistema: gestão e área do cliente usam o mesmo vocabulário visual.
4. Densidade com respiro: muitos dados, mas com hierarquia clara.

## Accessibility & Inclusion

WCAG 2.1 AA como piso (inferido): contraste de texto 4,5:1, foco visível, alvos de toque de 44px no celular, sem texto abaixo de 12px.
