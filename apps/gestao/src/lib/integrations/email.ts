import { createTransport } from "nodemailer";

/**
 * Envio de e-mail por SMTP (Hostinger, Zoho, Google Workspace, Amazon SES, Resend...). Configuração por variáveis
 * de ambiente: SMTP_HOST, SMTP_PORT (587 ou 465), SMTP_SECURE (true para a porta 465), SMTP_USER, SMTP_PASSWORD
 * e EMAIL_FROM ("Vinicius Riudi <contato@viniciusriudi.com>").
 */
type EmailConfig = { host: string; port: number; secure: boolean; user: string; password: string; from: string };

const REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"] as const;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function readConfig(): EmailConfig | null {
  if (REQUIRED.some((name) => !env(name))) return null;
  const port = Number(env("SMTP_PORT")) || 587;
  const secure = env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465;
  return { host: env("SMTP_HOST"), port, secure, user: env("SMTP_USER"), password: env("SMTP_PASSWORD"), from: env("EMAIL_FROM") };
}

/** Situação da configuração para exibir na tela (sem a senha). */
export function emailConfigStatus() {
  const config = readConfig();
  return {
    configured: Boolean(config),
    missing: REQUIRED.filter((name) => !env(name)),
    host: env("SMTP_HOST") || null,
    port: Number(env("SMTP_PORT")) || 587,
    secure: config?.secure ?? (env("SMTP_SECURE") === "true"),
    user: env("SMTP_USER") || null,
    from: env("EMAIL_FROM") || null,
  };
}

function transport(config: EmailConfig) {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export class EmailNotConfiguredError extends Error {
  constructor() { super(`E-mail não configurado: defina ${REQUIRED.join(", ")}.`); }
}

/** Detalhes técnicos de uma falha de SMTP (código, comando e resposta do servidor), para os logs. */
export function emailErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return String(error).slice(0, 1_000);
  const extra = error as Error & { code?: string; command?: string; response?: string; responseCode?: number };
  return [error.message, extra.code ? `código ${extra.code}` : null, extra.command ? `comando ${extra.command}` : null, extra.responseCode ? `resposta ${extra.responseCode}` : null, extra.response && extra.response !== error.message ? extra.response : null].filter(Boolean).join(" · ").slice(0, 1_000);
}

export async function sendEmail(message: { to: string; subject: string; text: string; html?: string }) {
  const config = readConfig();
  if (!config) throw new EmailNotConfiguredError();
  const info = await transport(config).sendMail({ from: config.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
  return { messageId: info.messageId ?? null, response: typeof info.response === "string" ? info.response.slice(0, 500) : null, accepted: info.accepted?.map(String) ?? [], rejected: info.rejected?.map(String) ?? [] };
}

/** Testa a conexão e o login no servidor SMTP, sem enviar nada. */
export async function verifyEmailConnection() {
  const config = readConfig();
  if (!config) throw new EmailNotConfiguredError();
  await transport(config).verify();
  return `Conexão e login aceitos por ${config.host}:${config.port}${config.secure ? " (TLS)" : " (STARTTLS)"}.`;
}
