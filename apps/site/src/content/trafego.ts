/**
 * Texto e dados da página /trafego (gestão de tráfego). Para mudar uma frase, um resultado ou uma pergunta, edite aqui.
 * Os resultados vêm dos relatórios enviados aos clientes, sem o nome de quem anunciou.
 * Logos das plataformas e do WhatsApp em public/trafego/.
 */
export type TrafficArea = "eventos" | "produtos" | "mkt";

export type TrafficCase = {
  area: TrafficArea; title: string; days: number; invested: number; revenue: number; roas: number;
  sales: number; costPerSale: number; impressions: number; reach: number; clicks: number; clicksLabel: string;
  ctr: string; cpc: number; cpm: number; followers: number;
};

export const trafego = {
  seo: {
    title: "Vinicius Riudi — Gestão de tráfego pago",
    description: "Gestão e acompanhamento de campanhas no Meta Ads, Google Ads, Taboola e MGID, com relatório diário, reuniões semanais e atendimento direto.",
  },
  brand: { name: "Vinicius Riudi", tagline: "Software • Tráfego" },
  nav: [
    { href: "#resultados", label: "Resultados" },
    { href: "#servicos", label: "Serviços" },
    { href: "#indicacao", label: "Comece por aqui" },
    { href: "#duvidas", label: "Dúvidas" },
  ],
  hero: {
    /** Trechos do título; os marcados com `true` saem em verde. */
    title: [["Gestão e acompanhamento de campanhas no "], ["Meta Ads", true], [" e no "], ["Google Ads", true], ["."]] as readonly (readonly [string, boolean?])[],
    text: "Criamos, acompanhamos e otimizamos seus anúncios no Instagram, Facebook e Google, com relatório diário, reuniões semanais e atendimento direto.",
    primary: "Solicitar diagnóstico",
    secondary: "Ver resultados",
    platformsLabel: "Plataformas que gerenciamos",
    includedLabel: "O que está incluso",
    included: [
      "Criação e gestão das campanhas",
      "Configuração de rastreamento",
      "Otimização contínua das campanhas",
      "Relatório diário de resultados",
      "Software dedicado para acompanhamento dos resultados",
      "Reuniões semanais de acompanhamento",
      "Atendimento direto",
    ],
  },
  /** Plataformas do topo: `label` aparece ao lado do ícone (Google Ads); as outras usam o logo completo. */
  platforms: [
    { name: "Meta", logo: "/trafego/meta.svg", height: 18 },
    { name: "Google Ads", logo: "/trafego/google-ads.svg", label: "Google Ads" },
    { name: "Taboola", logo: "/trafego/taboola.svg", height: 18 },
    { name: "MGID", logo: "/trafego/mgid.svg", height: 24 },
  ] as readonly { name: string; logo: string; height?: number; label?: string }[],
  marquee: ["Meta Ads", "Google Ads", "Relatório diário", "Rastreamento configurado", "Reuniões semanais", "Atendimento direto"],
  results: {
    label: "Resultados",
    /** Título palavra por palavra (cada uma entra em sequência); a última sai em verde. */
    title: ["Resultados", "que", "falam", "pelo", "trabalho."],
    text: "Dados extraídos dos relatórios enviados a cada cliente.",
    swipe: "Deslize para ver mais",
    areas: [
      { id: "eventos", label: "Eventos" },
      { id: "produtos", label: "Produtos (lojas)" },
      { id: "mkt", label: "Marketing Digital" },
    ] as readonly { id: TrafficArea; label: string }[],
    cases: [
      { area: "eventos", title: "Evento de Bilheteria", days: 25, invested: 2685.46, revenue: 21039.25, roas: 7.8, sales: 153, costPerSale: 17.78, impressions: 334182, reach: 28129, clicks: 1820, clicksLabel: "Cliques no link", ctr: "0,54%", cpc: 1.48, cpm: 8.04, followers: 5362 },
      { area: "eventos", title: "Evento de Bilheteria", days: 32, invested: 1572.03, revenue: 17389.67, roas: 11.06, sales: 124, costPerSale: 1572.03 / 124, impressions: 322239, reach: 97188, clicks: 1416, clicksLabel: "Cliques no anúncio", ctr: "1,12%", cpc: 1.11, cpm: 4.88, followers: 3726 },
    ] as readonly TrafficCase[],
    /** Números gerais, mostrados nas áreas sem caso detalhado; o da área escolhida vem primeiro e em destaque. */
    stats: [
      { id: "anos", value: "+5", label: "anos de atuação" },
      { id: "produtos", value: "+500 mil", label: "gerenciados em produtos (lojas)" },
      { id: "mkt", value: "+300 mil", label: "gerenciados em campanhas de produtos digitais" },
    ],
  },
  services: {
    label: "Serviços",
    title: "O que fazemos em cada plataforma",
    platforms: [
      { id: "meta", label: "Meta Ads", title: "Instagram e Facebook", text: "Campanhas para gerar contatos e vendas a partir do público com perfil do seu cliente.", items: ["Campanhas de vendas direto no site", "Campanhas de mensagem para WhatsApp e Direct", "Remarketing para quem já interagiu com a marca", "Testes e otimização de criativos"] },
      { id: "google", label: "Google Ads", title: "Pesquisa, Maps e YouTube", text: "Anúncios para quem já procura pelo seu produto ou serviço no Google.", items: ["Campanhas de vendas direto no site", "Campanhas na Rede de Pesquisa", "Anúncios no Maps para negócios locais", "Gestão de palavras-chave e palavras negativas"] },
    ],
  },
  steps: {
    label: "Como funciona",
    title: "Três etapas, do primeiro contato ao dia a dia",
    items: [
      { title: "Diagnóstico", text: "Análise do negócio, do público e das contas atuais." },
      { title: "Implementação", text: "Estratégia, configuração de rastreamento e criação das campanhas." },
      { title: "Acompanhamento", text: "Relatório diário de resultados e reuniões semanais de acompanhamento." },
    ],
  },
  quiz: {
    label: "Comece por aqui",
    title: "Responda 3 perguntas e envie no WhatsApp",
    text: "Suas respostas chegam direto no WhatsApp, e a análise do seu caso começa na hora.",
    badges: [{ icon: "clock", label: "Menos de 30 segundos" }, { icon: "check", label: "Sem fidelidade" }] as const,
    questions: [
      { question: "Qual é o seu negócio?", options: ["Eventos", "Loja / produtos", "Produto digital", "Outro"] },
      { question: "Você já anuncia hoje?", options: ["Ainda não", "Sim, sozinho", "Sim, com agência", "Já anunciei e parei"] },
      { question: "Quanto pretende investir por mês em anúncios?", options: ["Até R$ 1.500", "R$ 1.500 a 5.000", "R$ 5.000 a 15.000", "Acima de R$ 15.000"] },
    ],
    doneTitle: "Pronto. Agora é com a gente.",
    doneText: "Envie suas respostas e receba uma análise do seu caso.",
    send: "Enviar no WhatsApp",
    reset: "Refazer",
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      { question: "O investimento em anúncios está incluso?", answer: "Não. O investimento em anúncios é pago diretamente à Meta ou ao Google. O valor da gestão é cobrado à parte." },
      { question: "Em quanto tempo vejo resultado?", answer: "As primeiras semanas são de teste e ajuste. O prazo varia conforme o segmento, o orçamento e a oferta." },
      { question: "Tem fidelidade?", answer: "Não! Sem fidelidade." },
      { question: "De quem são as contas de anúncio?", answer: "As contas ficam no seu nome. Se o contrato for encerrado, todo o histórico permanece com você." },
    ],
  },
  contact: {
    label: "Contato",
    title: "Entre em contato agora",
    text: "Entendemos seu negócio e avaliamos se o tráfego faz sentido neste momento.",
    cta: "Chamar no WhatsApp",
    phone: "(82) 99346-0647",
  },
  footer: {
    software: { kicker: "Precisa de um software para o seu negócio?", title: "Conheça o desenvolvimento de software", domain: "viniciusriudi.com", href: "/" },
    about: "Gestão e acompanhamento de campanhas de tráfego pago.",
    contactLabel: "Contato",
    instagram: { href: "https://www.instagram.com/vinitakeuti/", label: "@vinitakeuti" },
    copyright: "© 2026 viniciusriudi.com",
    cnpj: "CNPJ 54.565.291/0001-94",
  },
} as const;

/** Mensagem do quiz enviada no WhatsApp: as três respostas, na ordem das perguntas. */
export const quizMessage = (business: string, advertises: string, budget: string) => `Olá! Vim pelo site. Meu negócio: ${business}. Já anuncio? ${advertises}. Investimento mensal em anúncios: ${budget}.`;
