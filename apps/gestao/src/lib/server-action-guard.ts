import type { NextRequest } from "next/server";

/** IDs de ações do servidor gerados pelo Next.js: 42 caracteres hexadecimais. */
const SERVER_ACTION_ID = /^[0-9a-f]{42}$/i;

function boundActionId(metadata: FormDataEntryValue | null) {
  if (typeof metadata !== "string") return "";
  try {
    const parsed: unknown = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && "id" in parsed && typeof parsed.id === "string" ? parsed.id : "";
  } catch {
    return "";
  }
}

/**
 * Robôs varrem a internet com chamadas falsas de ações do servidor (cabeçalho "Next-Action: x" e corpos montados para
 * a falha CVE-2025-55182 do React). O Next.js já as recusa, mas registra um erro a cada tentativa e polui o log do
 * container. Reconhece essas chamadas pelo formato do ID, igual à checagem do Next.js, para descartá-las antes.
 */
export async function isForgedServerAction(request: NextRequest) {
  if (request.method !== "POST") return false;
  const header = request.headers.get("next-action");
  if (header !== null) return !SERVER_ACTION_ID.test(header);

  // Sem o cabeçalho, é um formulário enviado antes de o JavaScript carregar: o ID vai nos nomes dos campos.
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.startsWith("multipart/form-data") || contentType.startsWith("application/x-www-form-urlencoded");
  if (!isForm || request.nextUrl.pathname.startsWith("/api/")) return false;
  const form = await request.clone().formData().catch(() => null);
  if (!form) return true;
  for (const key of form.keys()) {
    if (key.startsWith("$ACTION_ID_") && !SERVER_ACTION_ID.test(key.slice(11))) return true;
    if (key.startsWith("$ACTION_REF_") && !SERVER_ACTION_ID.test(boundActionId(form.get(`$ACTION_${key.slice(12)}:0`)))) return true;
  }
  return false;
}
