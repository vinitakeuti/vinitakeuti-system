/**
 * Vencimento do domínio pelo RDAP (o sucessor público do WHOIS), descoberto pela lista oficial da IANA.
 * Funciona para .com, .com.br (Registro.br) e a maioria das extensões, independentemente de onde o domínio foi comprado.
 */

/** Sufixos de dois níveis mais comuns; o domínio registrado é o rótulo antes deles (cliente.com.br). */
const TWO_LEVEL_SUFFIXES = new Set([
  "com.br", "net.br", "org.br", "gov.br", "edu.br", "art.br", "blog.br", "app.br", "dev.br", "eco.br", "emp.br", "eng.br", "esp.br", "far.br", "ind.br", "inf.br", "jus.br", "leg.br", "med.br", "mil.br", "nom.br", "odo.br", "psi.br", "rec.br", "srv.br", "tec.br", "tur.br", "tv.br", "adv.br", "arq.br", "log.br", "seg.br", "ong.br",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "com.mx", "com.ar", "com.pt", "co.jp", "co.za", "com.co", "com.pe", "com.uy", "com.py", "com.bo", "com.ec", "com.ve",
]);

/** Domínio registrado a partir do host (app.cliente.com.br → cliente.com.br). IPs e localhost não têm domínio. */
export function registrableDomain(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3 ? labels.slice(-3).join(".") : lastTwo;
}

type Bootstrap = { services: Array<[string[], string[]]> };
let bootstrapCache: { loadedAt: number; services: Bootstrap["services"] } | null = null;

async function rdapBaseFor(tld: string) {
  if (!bootstrapCache || Date.now() - bootstrapCache.loadedAt > 24 * 60 * 60 * 1000) {
    const response = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!response.ok) throw new Error(`Lista RDAP da IANA indisponível (HTTP ${response.status}).`);
    bootstrapCache = { loadedAt: Date.now(), services: ((await response.json()) as Bootstrap).services };
  }
  const service = bootstrapCache.services.find(([tlds]) => tlds.includes(tld));
  const urls = service?.[1] ?? [];
  return urls.find((url) => url.startsWith("https://")) ?? urls[0] ?? null;
}

export type DomainResult = { expiresAt: Date | null; error: string | null };

export async function checkDomainExpiration(domain: string): Promise<DomainResult> {
  try {
    const tld = domain.split(".").at(-1)!;
    const base = await rdapBaseFor(tld);
    if (!base) return { expiresAt: null, error: `A extensão .${tld} não publica dados de vencimento (RDAP).` };
    const response = await fetch(`${base.replace(/\/$/, "")}/domain/${encodeURIComponent(domain)}`, { headers: { accept: "application/rdap+json, application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (response.status === 404) return { expiresAt: null, error: "Domínio não encontrado no registro." };
    if (!response.ok) return { expiresAt: null, error: `Registro respondeu HTTP ${response.status}.` };
    const body = await response.json() as { events?: Array<{ eventAction?: string; eventDate?: string }> };
    const expiration = body.events?.find((event) => event.eventAction === "expiration")?.eventDate;
    return expiration ? { expiresAt: new Date(expiration), error: null } : { expiresAt: null, error: "O registro não informa a data de vencimento." };
  } catch (error) {
    return { expiresAt: null, error: error instanceof Error ? (error.name === "TimeoutError" ? "Registro sem resposta em 10 s." : error.message.slice(0, 200)) : "Falha ao consultar o registro." };
  }
}
