/**
 * Todo o texto do site num lugar só. Para mudar uma frase, um serviço ou o contato, edite aqui.
 * WhatsApp vazio esconde o botão (formato: só números, com DDI e DDD, ex.: 5582999990000).
 */
export const site = {
  name: "Vinicius Riudi",
  title: "Desenvolvedor de software",
  url: "https://viniciusriudi.com",
  clientAreaUrl: "https://clientes.viniciusriudi.com",
  contact: {
    email: "contato@viniciusriudi.com",
    whatsapp: "5582993460647",
  },
  seo: {
    title: "Vinicius Riudi · Tráfego pago e Desenvolvimento de software sob medida",
    description: "Sistemas web, sites, landing pages, gestão de tráfego, plataformas, integrações e automações sob medida, com acompanhamento para a estrutura digital do seu negócio.",
  },
  nav: [
    { href: "#servicos", label: "Serviços" },
    { href: "#processo", label: "Como funciona" },
    { href: "#area-do-cliente", label: "Área do cliente" },
    { href: "#perguntas", label: "Perguntas" },
  ],
  hero: {
    eyebrow: "ESTRATÉGIA · TECNOLOGIA · OPERAÇÃO",
    title: "Estruturas digitais que sustentam o crescimento do seu negócio.",
    text: "Sites, sistemas, apps, funis de venda e integrações sob medida, do planejamento à entrega. Cada etapa é acompanhada de perto para que o resultado apareça no seu negócio.",
    primary: "Conversar sobre um projeto",
    secondary: "Entenda os processos",
  },
  /** Faixa em movimento logo abaixo do diagnóstico: áreas de negócio atendidas. */
  segments: {
    label: "FEITO PARA NEGÓCIOS COMO",
    items: ["Educação física", "Fotografia", "Construtoras", "Imobiliárias e corretores", "Clínicas e consultórios", "Escritórios de advocacia", "Comércio local", "Infoprodutores", "Restaurantes", "Prestadores de serviço"],
  },
  /**
   * Serviços em 3 categorias. Valores não aparecem no site: o orçamento é combinado na conversa.
   * demo escolhe a demonstração interativa: software, payment, report, ads, funnel, tracking, landing ou server.
   */
  serviceCategories: [
    {
      id: "software", title: "Software", label: "Software", short: "SOFTWARE",
      description: "Sites, sistemas, integrações e análises técnicas feitos sob medida.",
      services: [
        {
          id: "landing-page", title: "Site / Landing Page", demo: "landing", billing: "Serviço avulso",
          summary: "Produção de página única.",
          detail: "Uma página rápida e direta para apresentar um produto, serviço ou campanha e levar a visita até o contato.",
          includes: ["Layout responsivo para celular e computador", "Botões de contato por WhatsApp e e-mail", "Estrutura básica para buscadores (SEO)", "Publicação no seu domínio com HTTPS"],
        },
        {
          id: "software-personalizado", title: "Software Personalizado", demo: "software", billing: "Projeto sob medida",
          summary: "Sistemas Web e aplicativos windows e macOs criados sob medida para a rotina do seu negócio.",
          detail: "Cadastros, fluxos, documentos e financeiro no formato em que a sua operação já funciona, em vez de adaptar a empresa a um sistema pronto.",
          includes: ["Levantamento da rotina e dos processos", "Painel web com login e permissões", "Banco de dados, relatórios e documentos", "Acompanhamento pela área do cliente"],
        },
        {
          id: "integracao-gateway", title: "Integração Gateway de Pagamento", demo: "payment", billing: "Serviço avulso",
          summary: "Integração de APIs de Pix, cartão e boleto.",
          detail: "Cobranças geradas pelo seu sistema e confirmadas sozinhas quando o cliente paga, sem conferir extrato na mão.",
          includes: ["Pix, cartão de crédito e boleto", "Confirmação automática por webhook", "Cobranças e parcelas criadas pelo sistema", "Testes em ambiente de homologação"],
        },
        {
          id: "parecer-tecnico", title: "Parecer Técnico de Software", demo: "report", billing: "Serviço avulso",
          summary: "Análise técnica de software para avaliação de funcionamento, qualidade, conformidade e capacidade do sistema.",
          detail: "O resultado é um documento técnico para suporte jurídico, com o que foi analisado, como e as conclusões.",
          includes: ["Avaliação de funcionamento", "Qualidade do código e da arquitetura", "Conformidade e capacidade do sistema", "Documento técnico para suporte jurídico"],
        },
      ],
    },
    {
      id: "trafego", title: "Tráfego pago e funis de venda", label: "Tráfego e funis", short: "TRÁFEGO E FUNIS",
      description: "Anúncios, páginas e funis para transformar visitas em clientes.",
      services: [
        {
          id: "gestao-trafego", title: "Gestão de Tráfego Pago", demo: "ads", billing: "Gestão mensal",
          summary: "Campanhas no Google Ads e no Meta Ads (Instagram e Facebook) para levar as pessoas certas até você.",
          detail: "Planejamento, criação e otimização das campanhas, com relatório do que o investimento trouxe de volta.",
          includes: ["Planejamento de público e orçamento", "Criação e configuração das campanhas", "Otimização contínua dos anúncios", "Relatório mensal de resultados"],
        },
        {
          id: "funil-vendas", title: "Funil de Vendas", demo: "funnel", billing: "Projeto",
          summary: "O caminho completo do anúncio até a venda: página, captura do contato e acompanhamento automático.",
          detail: "Cada etapa é medida, então fica claro onde as pessoas desistem e o que ajustar.",
          includes: ["Mapeamento das etapas do funil", "Páginas de captura e de oferta", "Mensagens automáticas de acompanhamento", "Métricas de conversão por etapa"],
        },
        {
          id: "traqueamento-avancado", title: "Traqueamento Avançado", demo: "tracking", billing: "Serviço avulso",
          summary: "Medição completa da jornada do cliente com Google Analytics 4, traqueamento personalizado e integração com outros apps.",
          detail: "Cada visita, clique, cadastro e venda registrado com a origem certa, para saber qual anúncio realmente trouxe resultado.",
          includes: ["Configuração do Google Analytics 4 (GA4)", "Eventos e conversões personalizados", "Envio dos eventos para outros apps (Pixel do Meta, CRM)", "Origem de cada conversão por UTM e campanha"],
        },
      ],
    },
    {
      id: "ferramentas", title: "Ferramentas a contratar", label: "Ferramentas", short: "FERRAMENTAS",
      description: "Soluções prontas para usar, contratadas por mensalidade.",
      services: [
        {
          id: "servidor", title: "Servidor", demo: "server", billing: "Mensalidade",
          summary: "Locação de servidor.",
          detail: "O seu site ou sistema hospedado e mantido no ar, com as atualizações publicadas por mim.",
          includes: ["Hospedagem do site ou sistema", "Certificado HTTPS", "Acompanhamento de disponibilidade", "Publicação das atualizações"],
        },
      ],
    },
  ],
  process: [
    { title: "Conversa", text: "Entendimento do problema, do objetivo e do que já existe hoje." },
    { title: "Proposta", text: "Escopo, prazos e valores claros, por escrito." },
    { title: "Contrato", text: "Assinado digitalmente pelo gov.br, sem papel." },
    { title: "Desenvolvimento", text: "Etapas visíveis na área do cliente, com entregas parciais." },
    { title: "Entrega e suporte", text: "Publicação, monitoramento e evolução contínua." },
  ],
  clientArea: {
    eyebrow: "ÁREA DO CLIENTE",
    title: "Você acompanha tudo, sem precisar perguntar.",
    text: "Cada cliente recebe um acesso próprio para ver o andamento do projeto, baixar e assinar documentos e pagar as parcelas online.",
    features: [
      { title: "Jornada do projeto", text: "Da proposta aprovada à entrega, com a etapa atual e as próximas datas." },
      { title: "Documentos e assinatura", text: "Propostas e contratos em PDF, assinados pelo gov.br e enviados pelo próprio portal." },
      { title: "Pagamentos", text: "Parcelas pagas por Pix, boleto ou cartão, confirmadas automaticamente." },
      { title: "Lembretes", text: "Vencimentos, documentos pendentes e novidades do projeto avisados na hora certa." },
    ],
  },
  /**
   * Diagnóstico interativo da abertura: o visitante escolhe o que precisa resolver e vê o caminho sugerido.
   * services usa os ids do catálogo acima, na ordem em que devem aparecer.
   */
  diagnosis: {
    question: "O que trouxe você até aqui?",
    needs: [
      { id: "vender", label: "Vender mais pela internet", diagnosis: "Vender mais começa com um site que apresenta bem o seu negócio, e cresce com tráfego qualificado, um funil sem vazamentos e dados para saber o que realmente funciona.", services: ["landing-page", "gestao-trafego", "funil-vendas", "traqueamento-avancado"] },
      { id: "organizar", label: "Organizar minha empresa com um sistema", diagnosis: "Informação espalhada em planilhas, papéis e conversas trava o crescimento. Um sistema feito para a sua rotina coloca tudo num lugar só.", services: ["software-personalizado", "servidor"] },
      { id: "automatizar", label: "Automatizar um processo manual", diagnosis: "Tarefas repetidas, como cobrar, conferir pagamentos e enviar avisos, podem rodar sozinhas, sem erro e sem depender de alguém lembrar.", services: ["integracao-gateway", "software-personalizado"] },
      { id: "lancamento", label: "Fazer um lançamento", diagnosis: "Um lançamento precisa de uma página que converta, anúncios para as pessoas certas e a medição de cada venda.", services: ["landing-page", "gestao-trafego", "traqueamento-avancado"] },
      { id: "avaliar", label: "Avaliar um sistema que já tenho", diagnosis: "Uma análise técnica independente mostra se o sistema funciona, se cumpre o que foi contratado e onde estão os riscos.", services: ["parecer-tecnico"] },
    ],
  },
  faq: [
    { question: "Não sei exatamente o que preciso. Por onde começo?", answer: "Pela conversa inicial, sem compromisso. A partir do problema que você quer resolver, o caminho é indicado: site, sistema, automação, tráfego pago ou uma combinação deles. O diagnóstico no topo desta página já dá uma primeira ideia." },
    { question: "Qual a diferença entre um site e uma landing page?", answer: "O site apresenta a empresa como um todo, com várias seções ou páginas. A landing page é uma página única, focada em uma ação, como pedir um orçamento ou comprar, e costuma ser a escolha para campanhas e anúncios." },
    { question: "Por que um sistema sob medida e não um pronto do mercado?", answer: "Sistemas prontos atendem a média e obrigam a empresa a se adaptar a eles. Um sistema sob medida segue a sua rotina, tem só o que você usa e cresce junto com o negócio." },
    { question: "Quanto custa?", answer: "Depende do escopo. Depois da conversa você recebe uma proposta por escrito com o que será feito, os prazos e os valores, sem compromisso." },
    { question: "Quais são as formas de pagamento?", answer: "O valor pode ser parcelado conforme a proposta, com pagamento por Pix, boleto ou cartão. Cada parcela fica disponível na área do cliente e é confirmada automaticamente." },
    { question: "Quanto tempo leva para ficar pronto?", answer: "Varia com o tamanho do projeto: uma landing page fica pronta bem antes de um sistema completo. O prazo de cada etapa vem na proposta, e o andamento pode ser acompanhado a qualquer momento na área do cliente." },
    { question: "No tráfego pago, o valor dos anúncios está incluído?", answer: "Não. O investimento em anúncios é pago diretamente ao Google e à Meta e definido junto com você, de acordo com o objetivo. A gestão das campanhas é cobrada à parte." },
    { question: "Preciso de servidor para colocar o site ou sistema no ar?", answer: "Sim, todo site ou sistema precisa estar hospedado. Há a opção de locação de servidor, com certificado HTTPS, acompanhamento de disponibilidade e publicação das atualizações." },
    { question: "O contrato tem validade jurídica?", answer: "Sim. Proposta e contrato são gerados em PDF e assinados digitalmente pelo gov.br, com validade jurídica, sem papel e sem cartório." },
    { question: "E depois da entrega?", answer: "Todo projeto conta com um prazo de garantia para seguir com manutenção e monitoramento, para que problemas sejam resolvidos antes de chegarem aos seus clientes." },
  ],
  cta: {
    title: "Vamos conversar sobre o seu projeto?",
    text: "Conte o que você precisa resolver. A primeira conversa é sem compromisso e serve para entender o problema e indicar o melhor caminho.",
  },
} as const;
