/**
 * Conteúdo da página /portfolio: a história e os projetos.
 *
 * Mídias: cada projeto tem a sua pasta em public/portfolio/<id-do-projeto>/ (ex.: public/portfolio/pacelab/).
 * - `media`: as telas do projeto (uma ou mais; com mais de uma, a janela ganha abas). `src` vazio = tela ilustrativa desenhada a partir de `screen`.
 * - `architectureMedia`: imagem ou vídeo do diagrama de arquitetura, revelado ao inspecionar. Sem ele, a planta é montada a partir de `architecture`.
 * - Prefira vídeo (.mp4/.webm) a GIF: mesma animação, arquivo muito menor. GIFs podem ser convertidos com ffmpeg e mantidos na pasta como fonte.
 * - `ratio`: proporção da janela, igual à das mídias (ex.: "1 / 1" para mídias quadradas). Padrão: "16 / 10".
 *
 * `stack` alimenta a aba "Tecnologia" (só a stack do projeto), agrupada por camada; sem ela, a aba usa as camadas de `architecture`.
 * `link` (opcional) mostra um link para conhecer o projeto no ar.
 * `sample: true` marca os projetos FICTÍCIOS com a etiqueta "Projeto ilustrativo"; remova ao trocar por um projeto real.
 */
export type ProjectLayer = { layer: string; tech: readonly string[]; note: string };
export type ProjectMedia = { label: string; src?: string; alt: string; screen: "dashboard" | "site" | "portal" | "landing" };
export type ArchitectureMedia = { src: string; alt: string };

export const portfolio = {
  seo: {
    title: "Portfólio · Vinicius Riudi",
    description: "A história de Vinicius Riudi e os projetos entregues: sistemas, portais, sites e integrações sob medida.",
  },
  hero: {
    eyebrow: "PORTFÓLIO",
    name: "Vinicius Riudi",
    text: "Desenvolvedor de software. A história do que construo e os projetos que nasceram dela.",
  },
  /** A história em parágrafos simples, lidos em sequência. */
  story: [
    "Tudo começa com um problema real. Antes de escrever uma linha de código, entendo a rotina, o que trava e o que precisa mudar. A tecnologia vem depois.",
    "Para organizar o meu próprio trabalho, construí um sistema de gestão com clientes, propostas, contratos e cobranças num só lugar. Depois veio a área do cliente, para que cada cliente acompanhe o projeto, assine documentos e pague as parcelas sem precisar perguntar nada.",
    "Hoje desenvolvo sites, sistemas sob medida, integrações e estruturas de tráfego pago para negócios de áreas diferentes, sempre do planejamento à entrega e com acompanhamento depois.",
  ],
  projects: [
    {
      id: "pacelab", title: "Pacelab", category: "Sistema", year: "", client: "Assessoria de corrida", ratio: "1 / 1",
      link: { href: "https://pacelabcoaching.com", label: "pacelabcoaching.com" },
      media: [{ label: "Telas", src: "/portfolio/pacelab/gestao+alunos+loja.mp4", alt: "Telas da Pacelab: gestão, portal do aluno e loja", screen: "dashboard" }],
      architectureMedia: { src: "/portfolio/pacelab/arq-e-stack.mp4", alt: "Ecossistema da Pacelab: gestão e alunos num serviço Next.js, loja em outro, cada um com seu PostgreSQL, integrados por API e com pagamentos por Asaas e Appmax" },
      summary: "Ecossistema digital de uma assessoria de corrida: gestão interna, portal do atleta e loja da marca.",
      problem: "Mensalidades, vendas e despesas controladas em lugares diferentes, com o caixa do mês dependendo de lançamentos manuais.",
      solution: "Três produtos em dois serviços independentes: a gestão (alunos, planos, cobranças, financeiro, demandas e equipe) e o portal do atleta numa mesma aplicação roteada por domínio, e a loja com estoque e retirada, conectada à gestão só por API.",
      result: "Mensalidades e vendas da loja chegam sozinhas ao financeiro, e cada pagamento só é confirmado depois do webhook e de uma consulta à API do meio de pagamento.",
      stack: [
        { group: "Linguagem", items: ["TypeScript 5.8"] },
        { group: "Frontend", items: ["React 19", "Next.js 16 (App Router)", "Server Components", "CSS próprio", "PWA"] },
        { group: "Backend", items: ["Node.js 20", "API do Next.js", "Roteamento por domínio"] },
        { group: "Banco de dados", items: ["PostgreSQL", "Prisma 6"] },
        { group: "Pagamentos", items: ["Asaas", "Appmax", "Appmax JS", "Webhooks"] },
        { group: "E-mail", items: ["Nodemailer", "SMTP", "Tarefas agendadas"] },
        { group: "Documentos", items: ["pdf-lib"] },
        { group: "Segurança", items: ["bcryptjs", "HMAC", "AES-256-GCM", "Limite de tentativas", "Cabeçalhos de segurança"] },
        { group: "Infraestrutura", items: ["Docker", "Docker Compose", "EasyPanel", "VPS VIXPI HOST"] },
        { group: "Ferramentas", items: ["tsx", "npm", "tsc"] },
      ],
      architecture: [
        { layer: "Gestão", tech: ["Next.js 16", "gestao-pacelab"], note: "Alunos, planos, cobranças, financeiro, demandas, equipe e e-mails." },
        { layer: "Alunos", tech: ["Mesmo serviço", "Roteamento por domínio"], note: "Portal do atleta no celular: plano, pagamento, termo em PDF e instalação como app." },
        { layer: "Loja", tech: ["Next.js 16", "loja-pacelab"], note: "Vitrine, estoque por variação, checkout e retirada; fala com a gestão só por API." },
        { layer: "Dados", tech: ["PostgreSQL", "Prisma 6"], note: "Bancos isolados: gestão com 32 migrations e loja com 19." },
        { layer: "Pagamentos", tech: ["Asaas", "Appmax", "Webhooks"], note: "Confirmados só após o webhook e uma consulta à API do meio de pagamento." },
        { layer: "E-mails", tech: ["Nodemailer", "SMTP"], note: "Lembretes de vencimento e confirmações, com reenvio automático." },
        { layer: "Segurança", tech: ["bcryptjs", "AES-256-GCM", "HMAC"], note: "Sessão guardada como hash, credenciais criptografadas e limite de tentativas." },
        { layer: "Infraestrutura", tech: ["Docker", "EasyPanel", "VPS"], note: "Um container por serviço, HTTPS por domínio e verificação de saúde." },
      ],
    },
    {
      id: "agenda-fit", sample: true, title: "Agenda Fit", category: "Sistema", year: "2026", client: "Estúdio de treinamento funcional",
      media: [{ label: "Painel", alt: "Painel do sistema Agenda Fit", screen: "dashboard" }],
      summary: "Agendamento de aulas, planos e mensalidades para um estúdio de treinamento.",
      problem: "Horários marcados por mensagem, planilha de alunos desatualizada e mensalidades cobradas uma a uma.",
      solution: "Agenda online por turma, cadastro de alunos e planos, cobrança recorrente automática e lembretes de aula.",
      result: "Os alunos reservam sozinhos, as mensalidades são cobradas e confirmadas sem intervenção e as faltas caíram.",
      architecture: [
        { layer: "Interface", tech: ["Next.js", "React"], note: "Agenda e painel do estúdio, funcionando no celular." },
        { layer: "API", tech: ["Route Handlers", "Zod"], note: "Regras de reserva, limite por turma e validação de dados." },
        { layer: "Dados", tech: ["PostgreSQL", "Prisma"], note: "Alunos, turmas, planos e histórico de presença." },
        { layer: "Integrações", tech: ["Asaas", "WhatsApp API"], note: "Cobrança recorrente e lembrete antes de cada aula." },
        { layer: "Infraestrutura", tech: ["Docker", "VPS"], note: "Aplicação em contêiner com backups diários." },
      ],
    },
    {
      id: "lumen-fotografia", sample: true, title: "Lumen Fotografia", category: "Site", year: "2026", client: "Estúdio de fotografia",
      media: [{ label: "Site", alt: "Site do estúdio Lumen Fotografia", screen: "site" }],
      summary: "Site do estúdio com galerias privadas para cada cliente escolher e baixar as fotos.",
      problem: "Fotos enviadas por links soltos e a escolha das fotos feita por mensagem, foto a foto.",
      solution: "Site com portfólio e uma galeria privada por cliente, com seleção das fotos favoritas e download em alta.",
      result: "A seleção que levava dias passou a ser feita numa tarde, direto na galeria.",
      architecture: [
        { layer: "Interface", tech: ["Next.js", "React"], note: "Portfólio público e galerias privadas com senha." },
        { layer: "API", tech: ["Route Handlers"], note: "Acesso às galerias, seleção e geração dos downloads." },
        { layer: "Dados", tech: ["PostgreSQL", "Prisma"], note: "Clientes, ensaios e fotos escolhidas." },
        { layer: "Arquivos", tech: ["S3", "Sharp"], note: "Armazenamento das fotos e versões otimizadas para a web." },
        { layer: "Infraestrutura", tech: ["Docker", "CDN"], note: "Imagens entregues rápido de qualquer lugar." },
      ],
    },
    {
      id: "obra-certa", sample: true, title: "Obra Certa", category: "Sistema", year: "2026", client: "Construtora",
      media: [{ label: "Portal", alt: "Portal do cliente da Obra Certa", screen: "portal" }],
      summary: "Portal em que cada cliente da construtora acompanha a obra, o cronograma e os pagamentos.",
      problem: "Clientes ligavam toda semana para saber o andamento da obra e pedir comprovantes.",
      solution: "Portal com cronograma por etapa, fotos da obra, documentos e parcelas do contrato.",
      result: "As ligações de acompanhamento praticamente acabaram e os documentos ficaram num só lugar.",
      architecture: [
        { layer: "Interface", tech: ["Next.js", "React"], note: "Portal do cliente e painel da construtora." },
        { layer: "API", tech: ["Route Handlers", "Zod"], note: "Permissões por obra e por cliente." },
        { layer: "Dados", tech: ["PostgreSQL", "Prisma"], note: "Obras, etapas, medições e contratos." },
        { layer: "Integrações", tech: ["Asaas", "gov.br"], note: "Parcelas do contrato e assinatura digital." },
        { layer: "Infraestrutura", tech: ["Docker", "VPS"], note: "Monitoramento de disponibilidade e certificado." },
      ],
    },
    {
      id: "horizonte-imoveis", sample: true, title: "Horizonte Imóveis", category: "Funil", year: "2026", client: "Imobiliária",
      media: [{ label: "Landing page", alt: "Landing page de lançamento da Horizonte Imóveis", screen: "landing" }],
      summary: "Landing page de lançamento com tráfego pago e cada contato medido até o corretor.",
      problem: "Anúncios no ar sem saber quais traziam contatos de verdade e leads perdidos no WhatsApp.",
      solution: "Página de lançamento, campanhas no Google e na Meta, eventos no GA4 e envio automático dos leads ao CRM.",
      result: "Cada lead chega ao corretor com a origem identificada, e o investimento foi para os anúncios que vendem.",
      architecture: [
        { layer: "Interface", tech: ["Next.js"], note: "Página rápida, com formulário curto e botão de WhatsApp." },
        { layer: "Medição", tech: ["GA4", "Pixel do Meta"], note: "Eventos de visita, clique e cadastro com a origem." },
        { layer: "Anúncios", tech: ["Google Ads", "Meta Ads"], note: "Campanhas por público e remarketing." },
        { layer: "Integrações", tech: ["CRM", "Webhooks"], note: "Lead enviado ao corretor na hora, com UTM." },
        { layer: "Infraestrutura", tech: ["Docker", "CDN"], note: "Página entregue rápido mesmo com pico de acessos." },
      ],
    },
  ],
  closing: {
    title: "A história continua a cada projeto.",
    text: "Para conhecer os serviços ou conversar sobre uma ideia, os caminhos estão aqui.",
  },
} as const;
