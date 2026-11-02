import { isAiChannelOpen } from "@/features/ai/services/ai-settings";
import { clientIp, field, rateLimited, readJson, siteCors } from "@/features/ai/services/http";
import { checkVisitor, parseVisitor, SITE_SESSION_ID, startSiteSession } from "@/features/ai/services/site-attendance";

/**
 * Início do atendimento no site: nome, telefone e e-mail são obrigatórios e passam pelo filtro de dados falsos.
 *   POST { sessionId, nome, telefone, email } → { ok, nome, saudacao } | 400 { error, field }
 */

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: siteCors(request) });
}

export async function POST(request: Request) {
  const headers = siteCors(request);
  if (rateLimited(`site-start:${clientIp(request)}`, 8, 10 * 60_000)) return Response.json({ error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers });
  const body = await readJson(request);
  const sessionId = field(body, "sessionId", 64);
  if (!body || !SITE_SESSION_ID.test(sessionId)) return Response.json({ error: "Sessão inválida." }, { status: 400, headers });
  if (!(await isAiChannelOpen("SITE"))) return Response.json({ error: "Atendimento indisponível no momento." }, { status: 503, headers });
  const parsed = parseVisitor({ nome: body.nome, telefone: body.telefone, email: body.email });
  if (!parsed.ok) return Response.json({ error: parsed.error, field: parsed.field }, { status: 400, headers });
  const checked = await checkVisitor(parsed.visitor);
  if (!checked.ok) return Response.json({ error: checked.error, field: checked.field, ...(checked.suggestion ? { sugestao: checked.suggestion } : {}) }, { status: 400, headers });
  const session = await startSiteSession(sessionId, parsed.visitor);
  return Response.json({ ok: true, nome: session.firstName, saudacao: session.welcome }, { headers });
}
