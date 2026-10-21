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
    whatsapp: "",
  },
  seo: {
    title: "Vinicius Riudi · Desenvolvimento de software sob medida",
    description: "Sistemas web, portais, integrações e automações sob medida, com acompanhamento de cada etapa pela área do cliente.",
  },
  nav: [
    { href: "#servicos", label: "Serviços" },
    { href: "#processo", label: "Como trabalho" },
    { href: "#area-do-cliente", label: "Área do cliente" },
    { href: "#perguntas", label: "Perguntas" },
  ],
  hero: {
    eyebrow: "ESTRATÉGIA · TECNOLOGIA · OPERAÇÃO",
    title: "Estruturas digitais que sustentam o crescimento do seu negócio.",
    text: "Desenvolvo sistemas, portais e integrações sob medida, do planejamento à entrega. Você acompanha cada etapa, documento e pagamento por uma área do cliente própria.",
    primary: "CONVERSAR SOBRE UM PROJETO",
    secondary: "VER COMO TRABALHO",
  },
  highlights: [
    { label: "ÁREA DO CLIENTE", text: "Projeto, documentos e pagamentos num só lugar." },
    { label: "ASSINATURA DIGITAL", text: "Contratos assinados pelo gov.br, com validade jurídica." },
    { label: "PAGAMENTO ONLINE", text: "Pix, boleto ou cartão, com confirmação automática." },
    { label: "MONITORAMENTO", text: "Sistemas acompanhados depois da entrega." },
  ],
  services: [
    { title: "Sistemas web sob medida", text: "Ferramentas internas, painéis de gestão e plataformas feitas para o jeito como o seu negócio funciona." },
    { title: "Portais e áreas de cliente", text: "Espaços com login para seus clientes acompanharem pedidos, documentos, pagamentos e suporte." },
    { title: "Integrações e automações", text: "Pagamentos, e-mails, APIs e rotinas que hoje são manuais conectados e funcionando sozinhos." },
    { title: "Sites e landing pages", text: "Presença digital rápida, clara e pronta para converter visitas em conversas." },
    { title: "Manutenção e evolução", text: "Ajustes, novas funcionalidades e atualizações de segurança depois da entrega." },
    { title: "Monitoramento", text: "Disponibilidade, certificado e domínio acompanhados, com alerta antes do problema chegar ao seu cliente." },
  ],
  process: [
    { title: "Conversa", text: "Entendo o problema, o objetivo e o que já existe hoje." },
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
    journey: [
      { label: "Proposta aprovada", detail: "Concluída", state: "done" },
      { label: "Contrato assinado", detail: "Assinado pelo gov.br", state: "done" },
      { label: "Desenvolvimento", detail: "Em andamento", state: "current" },
      { label: "Entrega", detail: "Data combinada", state: "next" },
    ],
  },
  faq: [
    { question: "Quanto tempo leva um projeto?", answer: "Depende do escopo. Na proposta você recebe as etapas e o prazo de cada uma, e acompanha o andamento pela área do cliente." },
    { question: "Como funciona o pagamento?", answer: "O valor é combinado na proposta e pode ser parcelado. As parcelas são pagas por Pix, boleto ou cartão, com confirmação automática." },
    { question: "O contrato é formal?", answer: "Sim. Proposta e contrato são gerados em PDF e assinados digitalmente pelo gov.br, com validade jurídica." },
    { question: "E depois da entrega?", answer: "O sistema pode seguir com manutenção, evolução e monitoramento contínuo, para problemas serem resolvidos antes de afetarem seus clientes." },
  ],
  cta: {
    title: "Vamos conversar sobre o seu projeto?",
    text: "Conte o que você precisa. A primeira conversa é para entender o problema e ver se faz sentido trabalharmos juntos.",
  },
} as const;
