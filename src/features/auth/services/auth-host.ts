import type { AuthPortal } from "@/features/auth/types/auth";

function hostname(host: string | null | undefined) {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
}

function configuredHost(name: "MANAGEMENT_HOST" | "CLIENT_PORTAL_HOST", fallback: string) {
  return hostname(process.env[name]) || fallback;
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
