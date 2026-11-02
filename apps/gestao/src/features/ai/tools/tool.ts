import type { AiChannel } from "@prisma/client";
import type { ObjectSchema } from "@/features/ai/tools/schema";

/**
 * Escopo de quem conversa com a IA:
 * - owner: você (gestão, WhatsApp do dono, MCP). Lê e altera o sistema.
 * - client: um cliente no portal. Só lê os dados do próprio cadastro.
 * - public: visitante do site. Só serviços e contato.
 */
export type AiScope = "owner" | "client" | "public";

export function scopeForChannel(channel: AiChannel): AiScope {
  if (channel === "PORTAL") return "client";
  if (channel === "SITE") return "public";
  return "owner";
}

export type ToolContext = {
  scope: AiScope;
  channel: AiChannel;
  conversationId: string;
  /** Cliente do portal. Ferramentas do escopo "client" só leem dados dele. */
  clientId: string | null;
  /** Quem pediu (e-mail, número de WhatsApp ou "visitante"), para a auditoria. */
  actor: string;
  runId: string | null;
};

export type AiTool<I = unknown> = {
  /** snake_case, único. É o nome que o modelo vê. */
  name: string;
  /** O que faz e quando usar: é o que o modelo lê para escolher a ferramenta. */
  description: string;
  scopes: AiScope[];
  /** Altera dados (fica na auditoria como alteração). */
  mutates: boolean;
  /** Pede um "sim" da pessoa antes de executar (quando a confirmação está ligada). Padrão: igual a `mutates`. */
  confirm?: boolean;
  input: ObjectSchema<I>;
  /** Resumo em uma linha do que será feito, mostrado ao pedir confirmação. */
  summarize?: (input: I) => string;
  run(input: I, context: ToolContext): Promise<unknown>;
};

export function defineTool<I>(tool: AiTool<I>): AiTool<I> {
  return tool;
}

export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const reais = (cents: number) => money.format(cents / 100);
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
/** Data no fuso de Brasília, AAAA-MM-DD. */
export const day = (date: Date | null | undefined) => date ? isoDay.format(date) : null;
export const todayIso = () => isoDay.format(new Date());
