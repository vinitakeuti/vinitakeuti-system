import { managementUrl } from "@/features/auth/services/auth-host";

/**
 * Layout único dos e-mails (para clientes e para você), na identidade da marca: faixa preta com a marca VR, fio verde,
 * corpo em papel claro com rótulos em fonte mono, linhas finas de 1px e botão preto de cantos retos. HTML em tabelas e
 * estilos inline, que é o que Gmail, Outlook e Apple Mail entendem; toda mensagem também sai em texto puro.
 */

export type EmailProfessional = { name: string; title?: string | null; email?: string | null; phone?: string | null; website?: string | null };

export type BrandEmail = {
  /** Assunto, também usado como título da página do e-mail. */
  subject: string;
  /** Resumo que os aplicativos mostram ao lado do assunto. */
  preheader: string;
  /** Rótulo no canto da faixa preta ("DOCUMENTO", "PAGAMENTO"). */
  kicker: string;
  title: string;
  paragraphs: string[];
  /** Linhas rótulo/valor separadas por fios finos (valor, vencimento, documento). */
  details?: Array<[string, string]>;
  /** Bloco destacado com dados para copiar (e-mail e senha de acesso), em fonte mono. */
  credentials?: Array<[string, string]>;
  /** Observação destacada: "attention" para recusa e atraso, "info" para o restante. */
  note?: { tone: "attention" | "info"; label: string; text: string };
  action?: { label: string; href: string };
  /** Texto depois do botão. */
  closing?: string[];
  /** Por que a pessoa recebeu este e-mail. */
  reason: string;
  professional: EmailProfessional;
};

/** Marca em PNG branco (e-mails não exibem SVG), servida pela gestão. */
export const EMAIL_LOGO_PATH = "/assets/images/email-logo.png";

const C = { page: "#ECEEEB", band: "#000000", accent: "#4B6156", label: "#A9C2B4", paper: "#FFFFFF", soft: "#F5F6F4", ink: "#111111", body: "#3A3D3B", muted: "#666B66", line: "#D9DED9", attention: "#8C4427", attentionSoft: "#FBF2EF", onBand: "#FFFFFF", onBandMuted: "#B9BDB8" } as const;
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

const escape = (value: string) => value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[char]!);

function websiteLabel(value?: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? "";
}

function websiteHref(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function contactParts(professional: EmailProfessional) {
  return [
    professional.email ? { text: professional.email, href: `mailto:${professional.email}` } : null,
    professional.phone ? { text: professional.phone, href: `tel:${professional.phone.replace(/[^\d+]/g, "")}` } : null,
    professional.website ? { text: websiteLabel(professional.website), href: websiteHref(professional.website) } : null,
  ].filter((part): part is { text: string; href: string } => Boolean(part));
}

const label = (text: string, color: string = C.muted) => `<span style="font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:1.2px;text-transform:uppercase;color:${color}">${escape(text)}</span>`;

function rows(items: Array<[string, string]>, mono = false) {
  return items.map(([name, value], index) => `<tr><td style="padding:12px 0;${index ? `border-top:1px solid ${C.line};` : ""}vertical-align:top;width:38%">${label(name)}</td><td style="padding:12px 0 12px 16px;${index ? `border-top:1px solid ${C.line};` : ""}vertical-align:top;font-family:${mono ? MONO : SANS};font-size:${mono ? 16 : 15}px;line-height:22px;font-weight:bold;color:${C.ink};word-break:break-word">${escape(value)}</td></tr>`).join("");
}

export function renderBrandEmail(email: BrandEmail) {
  const contacts = contactParts(email.professional);
  const paragraph = (text: string) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.body}">${escape(text)}</p>`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escape(email.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${escape(email.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td style="background:${C.band};padding:26px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:14px"><img src="${managementUrl(EMAIL_LOGO_PATH)}" width="44" height="33" alt="VR" style="display:block;border:0;width:44px;height:33px"></td>
<td style="vertical-align:middle"><div style="font-family:${SANS};font-size:15px;line-height:18px;font-weight:bold;color:${C.onBand};letter-spacing:-0.2px">${escape(email.professional.name)}</div>${email.professional.title ? `<div style="font-family:${SANS};font-size:12px;line-height:16px;color:${C.onBandMuted}">${escape(email.professional.title)}</div>` : ""}</td>
</tr></table></td>
<td align="right" style="vertical-align:middle">${label(email.kicker, C.label)}</td>
</tr></table></td></tr>
<tr><td style="background:${C.accent};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
<tr><td style="background:${C.paper};padding:40px 32px 36px">
<h1 style="margin:0 0 20px;font-family:${SANS};font-size:26px;line-height:32px;font-weight:bold;letter-spacing:-0.5px;color:${C.ink}">${escape(email.title)}</h1>
${email.paragraphs.map(paragraph).join("")}
${email.details?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-top:1px solid ${C.ink};border-bottom:1px solid ${C.line}">${rows(email.details)}</table>` : ""}
${email.credentials?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:${C.soft};border-left:3px solid ${C.accent}"><tr><td style="padding:8px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows(email.credentials, true)}</table></td></tr></table>` : ""}
${email.note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:${email.note.tone === "attention" ? C.attentionSoft : C.soft};border-left:3px solid ${email.note.tone === "attention" ? C.attention : C.accent}"><tr><td style="padding:16px 20px">${label(email.note.label, email.note.tone === "attention" ? C.attention : C.accent)}<div style="margin-top:6px;font-family:${SANS};font-size:15px;line-height:23px;color:${C.ink}">${escape(email.note.text)}</div></td></tr></table>` : ""}
${email.action ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 8px"><tr><td style="background:${C.band}"><a href="${escape(email.action.href)}" style="display:inline-block;padding:15px 24px;font-family:${MONO};font-size:12px;line-height:14px;letter-spacing:1.4px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;font-weight:bold">${escape(email.action.label)}</a></td></tr></table>` : ""}
${email.closing?.length ? `<div style="margin-top:24px">${email.closing.map((text) => `<p style="margin:0 0 10px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted}">${escape(text)}</p>`).join("")}</div>` : ""}
</td></tr>
<tr><td style="padding:24px 32px 8px;border-top:1px solid ${C.line}">
<div style="font-family:${SANS};font-size:13px;line-height:20px;font-weight:bold;color:${C.ink}">${escape(email.professional.name)}</div>
${contacts.length ? `<div style="font-family:${SANS};font-size:13px;line-height:20px;color:${C.muted}">${contacts.map((part) => `<a href="${escape(part.href)}" style="color:${C.muted};text-decoration:underline">${escape(part.text)}</a>`).join(" &middot; ")}</div>` : ""}
<div style="margin-top:14px;font-family:${SANS};font-size:12px;line-height:18px;color:${C.muted}">${escape(email.reason)}</div>
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    email.title,
    "",
    ...email.paragraphs.flatMap((line) => [line, ""]),
    ...(email.details?.length ? [...email.details.map(([name, value]) => `${name}: ${value}`), ""] : []),
    ...(email.credentials?.length ? [...email.credentials.map(([name, value]) => `${name}: ${value}`), ""] : []),
    ...(email.note ? [`${email.note.label}: ${email.note.text}`, ""] : []),
    ...(email.action ? [`${email.action.label}: ${email.action.href}`, ""] : []),
    ...(email.closing?.length ? [...email.closing, ""] : []),
    "--",
    email.professional.name,
    ...contacts.map((part) => part.text),
    "",
    email.reason,
  ].join("\n");

  return { subject: email.subject, html, text };
}
