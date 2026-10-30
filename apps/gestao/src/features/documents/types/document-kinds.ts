/**
 * Tipos de documento produzidos para cada cliente. A proposta comercial é o orçamento (fluxo próprio, com
 * serviços e valores); os demais são documentos de texto com capa, páginas e folha de assinaturas.
 */
export type DocumentKind = "proposal" | "contract" | "assignment" | "memorial" | "free";
export type ClientDocumentKindValue = "CONTRACT" | "IP_ASSIGNMENT" | "TECHNICAL_MEMORIAL" | "FREE";

type SignatureParty = { role: string };

export type DocumentKindInfo = {
  kind: DocumentKind;
  /** Identificador na URL (?tipo=). */
  slug: string;
  name: string;
  shortName: string;
  description: string;
  /** Rótulo da capa e do cabeçalho das páginas. */
  coverLabel: string;
  codePrefix: string;
  /** Registro do texto padrão deste tipo. */
  templateId: string;
  /** Folha final dos documentos de texto: título, declaração e as partes que assinam. */
  closing: { title: string; statement: string; professional: SignatureParty; client: SignatureParty; witnesses: boolean } | null;
  /** O cliente assina e envia a via pelo portal. O documento livre é só para leitura. */
  signable: boolean;
  /** Cliente obrigatório na criação. */
  requiresClient: boolean;
};

export const DOCUMENT_KINDS: DocumentKindInfo[] = [
  {
    kind: "proposal",
    slug: "proposta",
    name: "Proposta comercial",
    shortName: "Proposta",
    description: "Serviços, valores, pagamentos e condições. Folha final de investimento e aceite.",
    coverLabel: "PROPOSTA COMERCIAL",
    codePrefix: "ORC",
    templateId: "default",
    closing: null,
    signable: true,
    requiresClient: true,
  },
  {
    kind: "contract",
    slug: "contrato",
    name: "Contrato de prestação de serviço",
    shortName: "Contrato",
    description: "Objeto, obrigações, prazos, valores e cláusulas. Folha final de assinaturas com testemunhas.",
    coverLabel: "CONTRATO DE PRESTAÇÃO DE SERVIÇO",
    codePrefix: "CTR",
    templateId: "contract",
    closing: { title: "Assinaturas", statement: "E, por estarem justas e de acordo, as partes assinam o presente contrato, que passa a valer a partir da data de assinatura.", professional: { role: "CONTRATADA" }, client: { role: "CONTRATANTE" }, witnesses: true },
    signable: true,
    requiresClient: true,
  },
  {
    kind: "assignment",
    slug: "cessao",
    name: "Cessão de transferência de propriedade",
    shortName: "Cessão",
    description: "Transferência dos direitos patrimoniais sobre o que foi desenvolvido. Folha final de assinaturas com testemunhas.",
    coverLabel: "CESSÃO DE TRANSFERÊNCIA DE PROPRIEDADE",
    codePrefix: "CES",
    templateId: "assignment",
    closing: { title: "Assinaturas", statement: "Por estarem de acordo com a cessão e a transferência de propriedade descritas neste documento, as partes assinam o presente termo.", professional: { role: "CEDENTE" }, client: { role: "CESSIONÁRIO" }, witnesses: true },
    signable: true,
    requiresClient: true,
  },
  {
    kind: "memorial",
    slug: "memorial",
    name: "Documentação do projeto / Memorial técnico",
    shortName: "Memorial técnico",
    description: "Escopo entregue, funcionalidades, arquitetura e tecnologias. Folha final de recebimento.",
    coverLabel: "MEMORIAL TÉCNICO",
    codePrefix: "MEM",
    templateId: "memorial",
    closing: { title: "Recebimento da documentação", statement: "Declaro ter recebido a documentação técnica do projeto descrita neste memorial.", professional: { role: "RESPONSÁVEL TÉCNICO" }, client: { role: "RECEBIDO POR" }, witnesses: false },
    signable: true,
    requiresClient: true,
  },
  {
    kind: "free",
    slug: "livre",
    name: "Documento livre",
    shortName: "Documento livre",
    description: "Cabeçalho padrão e capa opcional, sem folha final. Com ou sem cliente vinculado.",
    coverLabel: "DOCUMENTO",
    codePrefix: "DOC",
    templateId: "free",
    closing: null,
    signable: false,
    requiresClient: false,
  },
];

const kindByEnum: Record<ClientDocumentKindValue, DocumentKind> = { CONTRACT: "contract", IP_ASSIGNMENT: "assignment", TECHNICAL_MEMORIAL: "memorial", FREE: "free" };
const enumByKind: Record<Exclude<DocumentKind, "proposal">, ClientDocumentKindValue> = { contract: "CONTRACT", assignment: "IP_ASSIGNMENT", memorial: "TECHNICAL_MEMORIAL", free: "FREE" };

export function documentKindInfo(kind: DocumentKind) {
  return DOCUMENT_KINDS.find((item) => item.kind === kind)!;
}

export function documentKindFromSlug(slug?: string | null) {
  return DOCUMENT_KINDS.find((item) => item.slug === slug) ?? null;
}

export function documentKindFromEnum(value: ClientDocumentKindValue) {
  return documentKindInfo(kindByEnum[value]);
}

export function documentKindEnum(kind: Exclude<DocumentKind, "proposal">) {
  return enumByKind[kind];
}

/** Documentos de texto (tudo exceto a proposta), na ordem de exibição. */
export const TEXT_DOCUMENT_KINDS = DOCUMENT_KINDS.filter((item) => item.kind !== "proposal");
