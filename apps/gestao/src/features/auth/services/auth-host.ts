import type { AuthPortal } from "@/features/auth/types/auth";

function hostname(host: string | null | undefined) {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

function configuredHost(name: "MANAGEMENT_HOST" | "CLIENT_PORTAL_HOST", fallback: string) {
  return hostname(process.env[name]) || fallback;
}

type HeaderReader = { get(name: string): string | null };

/**
 * Domínio da requisição. Prefere x-forwarded-host (definido pelo proxy do Easypanel e pelo próprio Next.js): na
 * página montada logo depois de uma ação do servidor (por exemplo, o redirecionamento do login), o Next.js faz uma
 * requisição interna em que "host" vira localhost e só x-forwarded-host traz o domínio original.
 */
export function requestHost(requestHeaders: HeaderReader) {
  const forwarded = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("host");
}

/** Portal da requisição (gestão, portal do cliente ou landing) a partir dos cabeçalhos. */
export function portalForRequest(requestHeaders: HeaderReader) {
  return getAuthPortal(requestHost(requestHeaders));
}

export function getAuthPortal(host: string | null | undefined): AuthPortal {
  const current = hostname(host);
  const managementHost = configuredHost("MANAGEMENT_HOST", "gestao.viniciusriudi.com");
  const clientHost = configuredHost("CLIENT_PORTAL_HOST", "clientes.viniciusriudi.com");

  if (!current || current === "localhost" || current === "127.0.0.1" || current === "::1") return "management";
  if (current === clientHost || current === "clientes.localhost") return "client";
  if (current === managementHost || current === "gestao.localhost") return "management";
  return "landing";
}

export function portalLabel(portal: AuthPortal) {
  if (portal === "client") return "Portal do cliente";
  if (portal === "management") return "VR Gestão";
  return "Vinitakeuti";
}

/** Endereço público do portal do cliente, para compartilhar o acesso com o cliente. */
export function clientPortalUrl() {
  return `https://${configuredHost("CLIENT_PORTAL_HOST", "clientes.viniciusriudi.com")}`;
}

/** Endereço público da gestão, para links em e-mails de alerta. */
export function managementUrl(path = "") {
  return `https://${configuredHost("MANAGEMENT_HOST", "gestao.viniciusriudi.com")}${path}`;
}
