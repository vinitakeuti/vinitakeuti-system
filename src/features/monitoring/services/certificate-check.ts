import { isIP } from "node:net";
import { connect, type TLSSocket } from "node:tls";

const CERTIFICATE_ERRORS: Record<string, string> = {
  CERT_HAS_EXPIRED: "Certificado vencido.",
  ERR_TLS_CERT_ALTNAME_INVALID: "O certificado é de outro domínio.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "Certificado autoassinado (não confiável).",
  SELF_SIGNED_CERT_IN_CHAIN: "Certificado autoassinado na cadeia (não confiável).",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Cadeia de certificados incompleta no servidor.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "Cadeia de certificados incompleta no servidor.",
  CERT_NOT_YET_VALID: "Certificado ainda não é válido (data futura).",
};

const CONNECTION_ERRORS: Record<string, string> = {
  ENOTFOUND: "Domínio não encontrado (DNS).",
  EAI_AGAIN: "Falha temporária de DNS.",
  ECONNREFUSED: "Conexão recusada na porta 443.",
  ECONNRESET: "Conexão interrompida pelo servidor.",
  EHOSTUNREACH: "Servidor inalcançável.",
  ETIMEDOUT: "Tempo de conexão esgotado.",
  ERR_SSL_WRONG_VERSION_NUMBER: "O endereço não responde HTTPS nesta porta.",
};

export type CertificateResult = { expiresAt: Date | null; issuer: string | null; error: string | null };

/**
 * Lê o certificado HTTPS do servidor (data de vencimento e emissor). Funciona com qualquer hospedagem e DNS.
 * Certificados inválidos (vencidos, de outro domínio, autoassinados) também são lidos, com o motivo em `error`.
 */
export function checkCertificate(hostname: string, port = 443): Promise<CertificateResult> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: TLSSocket | null = null;
    const finish = (result: CertificateResult) => { if (!settled) { settled = true; socket?.destroy(); resolve(result); } };
    try {
      // Endereço IP não pode ser usado como nome do servidor (SNI).
      socket = connect({ host: hostname, port, ...(isIP(hostname) ? {} : { servername: hostname }), rejectUnauthorized: false, timeout: 10_000 }, () => {
        const certificate = socket!.getPeerCertificate();
        if (!certificate || !certificate.valid_to) return finish({ expiresAt: null, issuer: null, error: "O servidor não apresentou certificado." });
        const issuer = certificate.issuer ? [certificate.issuer.O, certificate.issuer.CN].filter(Boolean).join(" · ") || null : null;
        const code = socket!.authorized ? null : String(socket!.authorizationError ?? "");
        const error = code === null ? null : CERTIFICATE_ERRORS[code] ?? `Certificado não confiável (${code || "motivo desconhecido"}).`;
        finish({ expiresAt: new Date(certificate.valid_to), issuer, error });
      });
      socket.on("timeout", () => finish({ expiresAt: null, issuer: null, error: "Sem resposta na porta 443 em 10 s." }));
      socket.on("error", (error: Error & { code?: string }) => finish({ expiresAt: null, issuer: null, error: CONNECTION_ERRORS[error.code ?? ""] ?? error.message.slice(0, 200) }));
    } catch (error) {
      finish({ expiresAt: null, issuer: null, error: error instanceof Error ? error.message.slice(0, 200) : "Falha ao conectar." });
    }
  });
}
