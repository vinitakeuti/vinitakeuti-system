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
 * `sample: true` (opcional) mostra a etiqueta "Projeto ilustrativo", para exemplos que não são projetos reais.
 */
export type ProjectLayer = { layer: string; tech: readonly string[]; note: string };
export type ProjectMedia = { label: string; src?: string; alt: string; screen: "dashboard" | "site" | "portal" | "landing" };
export type ArchitectureMedia = { src: string; alt: string };

export type SkillGroup = { label: string; items: readonly string[] };

export const portfolio = {
  seo: {
    title: "Portfólio · Vinicius Riudi",
    description: "A história de Vinicius Riudi e os projetos entregues: sistemas, portais, sites e integrações sob medida.",
  },
  hero: {
    eyebrow: "PORTFÓLIO",
    name: "Vinicius Riudi",
  },
  /** A história em parágrafos simples, lidos em sequência. */
  story: [
    "Tudo começa com um problema real. Antes de escrever uma linha de código, entendo a rotina, o que trava e o que precisa mudar. A tecnologia vem depois.",
    "Para organizar o meu próprio trabalho, construí um sistema de gestão com clientes, propostas, contratos e cobranças num só lugar. Depois veio a área do cliente, para que cada cliente acompanhe o projeto, assine documentos e pague as parcelas sem precisar perguntar nada.",
    "Hoje desenvolvo sites, sistemas sob medida, integrações e estruturas de tráfego pago para negócios de áreas diferentes, sempre do planejamento à entrega e com acompanhamento depois.",
  ],
  /**
   * Habilidades por área. Só tecnologias que compõem um stack (linguagens, frameworks, bancos, plataformas),
   * sem bibliotecas. Cada área vira uma aba; para uma nova área, adicione outro item com os seus grupos.
   */
  skills: [
    {
      area: "Software",
      groups: [
        { label: "Linguagens", items: ["TypeScript", "Rust", "SQL"] },
        { label: "Frontend", items: ["React", "Next.js", "CSS", "PWA"] },
        { label: "Backend e APIs", items: ["Node.js", "Next.js API", "APIs REST", "Webhooks"] },
        { label: "Desktop", items: ["Tauri"] },
        { label: "Banco de dados", items: ["PostgreSQL", "SQLite", "Prisma"] },
        { label: "Integrações", items: ["Asaas", "Appmax", "SMTP"] },
        { label: "Infraestrutura", items: ["Docker", "Docker Compose", "EasyPanel", "VPS"] },
        { label: "Ferramentas", items: ["Git", "GitHub", "Vite", "npm"] },
      ],
    },
    {
      area: "Inteligência Artificial",
      groups: [
        { label: "Agentes de IA", items: ["Claude Code", "Codex"] },
        { label: "Integrações", items: ["APIs de IA"] },
      ],
    },
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
      id: "nutripulse", title: "NutriPulse", category: "Software desktop", year: "", client: "Consultórios de nutrição", ratio: "1 / 1",
      media: [
        { label: "Visão geral", src: "/portfolio/nutripulse/01-visao-geral.mp4", alt: "NutriPulse: tela inicial com a agenda da semana, consultas e pacientes ativos", screen: "dashboard" },
        { label: "Antropometria", src: "/portfolio/nutripulse/03-antropometria-oms.mp4", alt: "NutriPulse: avaliação antropométrica com curvas de crescimento da OMS", screen: "dashboard" },
      ],
      architectureMedia: { src: "/portfolio/nutripulse/07-arquitetura.mp4", alt: "Arquitetura do NutriPulse: interface React na WebView, ponte IPC, núcleo nativo em Tauri 2 e Rust e banco SQLite no disco, sem servidor" },
      summary: "Prontuário nutricional desktop e local-first para consultórios, que funciona sem internet.",
      problem: "Consultas, avaliações e planos alimentares espalhados entre papel, planilhas e ferramentas online que dependem de conexão.",
      solution: "Aplicativo para macOS e Windows com prontuário (consultas, antropometria com curvas da OMS e exames), prescrição (planos alimentares, substitutos e macros) e relatórios em PDF, com os dados guardados no próprio computador.",
      result: "Todo o atendimento acontece num só programa, sem depender de servidor ou de internet, e os dados dos pacientes ficam no consultório.",
      stack: [
        { group: "Desktop", items: ["Tauri 2", "Rust"] },
        { group: "Interface", items: ["React 18", "TypeScript", "Vite", "Lucide"] },
        { group: "Dados", items: ["SQLite", "tauri-plugin-sql", "Migrations versionadas"] },
        { group: "Documentos", items: ["React PDF", "plugin-fs", "plugin-dialog"] },
        { group: "Plataformas", items: ["macOS", "Windows"] },
      ],
      architecture: [
        { layer: "Prontuário", tech: ["Consultas", "Antropometria", "Exames"], note: "Avaliação com curvas da OMS 2006/2007, escore-z e percentil." },
        { layer: "Prescrição", tech: ["Planos", "Substitutos", "Macros"], note: "Planos alimentares com alimentos substitutos e cálculo de macronutrientes." },
        { layer: "Relatórios", tech: ["React PDF", "Impressão"], note: "Documentos em PDF, impressão e evolução do paciente." },
        { layer: "Interface", tech: ["React 18", "TypeScript"], note: "Telas e fluxo clínico na WebView; src/lib com repositórios, OMS e DRI." },
        { layer: "Ponte", tech: ["IPC", "invoke"], note: "A interface chama o núcleo nativo por IPC." },
        { layer: "Núcleo nativo", tech: ["Tauri 2", "Rust"], note: "Comandos Rust para seed e impressão nativa, com plugins de SQL, arquivos e diálogos." },
        { layer: "Dados locais", tech: ["SQLite", "nutripulse.db"], note: "Banco no disco, com migrations versionadas: sem servidor e funcionando offline." },
      ],
    },
  ],
  closing: {
    title: "A história continua a cada projeto.",
    text: "Para conhecer os serviços ou conversar sobre uma ideia, os caminhos estão aqui.",
  },
} as const;
