import { managementUrl } from "@/features/auth/services/auth-host";

/**
 * E-mails na identidade da marca, em três layouts que se alternam conforme o assunto, sempre numa superfície única
 * (sem caixas de fundo), com rótulos em fonte mono, fios finos de 1px e botão de cantos retos:
 * - "carta": branco, cabeçalho como o dos documentos em PDF e assinatura no fim (conferências, sistemas, avisos);
 * - "noturno": todo preto, como a capa do documento livre (acesso ao portal, documentos);
 * - "destaque": branco, com a informação principal em tamanho grande (pagamentos).
 * HTML em tabelas e estilos inline, que é o que Gmail, Outlook e Apple Mail entendem; toda mensagem também sai em texto puro.
 */

export type EmailProfessional = { name: string; title?: string | null; email?: string | null; phone?: string | null; website?: string | null };

export type EmailLayout = "carta" | "noturno" | "destaque";

export type BrandEmail = {
  /** Padrão: "carta". */
  layout?: EmailLayout;
  /** Assunto, também usado como título da página do e-mail. */
  subject: string;
  /** Resumo que os aplicativos mostram ao lado do assunto. */
  preheader: string;
  /** Rótulo do assunto ("DOCUMENTO", "PAGAMENTO"). */
  kicker: string;
  title: string;
  paragraphs: string[];
  /** Informação principal em tamanho grande (valor de um pagamento). */
  highlight?: [string, string];
  /** Linhas rótulo/valor separadas por fios finos (valor, vencimento, documento). */
  details?: Array<[string, string]>;
  /** Dados para copiar (e-mail e senha de acesso), em fonte mono, com o rótulo acima do valor. */
  credentials?: Array<[string, string]>;
  /** Observação marcada por um fio lateral: "attention" para recusa e atraso, "info" para o restante. */
  note?: { tone: "attention" | "info"; label: string; text: string };
  action?: { label: string; href: string };
  /** Texto depois do botão. */
  closing?: string[];
  /** Despedida antes da assinatura ("Abraço,"). */
  signOff?: string;
  /** Por que a pessoa recebeu este e-mail. */
  reason: string;
  professional: EmailProfessional;
};

/** Marca em PNG (e-mails não exibem SVG), servida pela gestão: branca para o fundo preto, preta para o branco. */
export const EMAIL_LOGO_LIGHT_PATH = "/assets/images/email-logo.png";
export const EMAIL_LOGO_DARK_PATH = "/assets/images/email-logo-dark.png";
export const EMAIL_LOGO_PATHS = [EMAIL_LOGO_LIGHT_PATH, EMAIL_LOGO_DARK_PATH];

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";
const ACCENT = "#4B6156";

const LIGHT = { bg: "#FFFFFF", ink: "#111111", body: "#3A3D3B", muted: "#666B66", faint: "#8A8F8A", line: "#D9DED9", rule: "#111111", label: "#666B66", kicker: ACCENT, attention: "#8C4427", info: ACCENT, logo: EMAIL_LOGO_DARK_PATH };
const DARK = { bg: "#000000", ink: "#FFFFFF", body: "#B9BDB8", muted: "#7E847F", faint: "#7E847F", line: "#262A27", rule: "#3A403B", label: "#A9C2B4", kicker: "#A9C2B4", attention: "#D29A80", info: "#A9C2B4", logo: EMAIL_LOGO_LIGHT_PATH };
type Palette = typeof LIGHT;

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

const label = (text: string, color: string, size = 11) => `<span style="font-family:${MONO};font-size:${size}px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;color:${color}">${escape(text)}</span>`;
const table = (style: string, inner: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${style}">${inner}</table>`;
const wrapValue = (mono: boolean) => mono ? "word-break:break-all" : "overflow-wrap:anywhere";

/** Rótulo à esquerda e valor em negrito à direita, primeiro fio mais forte. */
function columnRows(items: Array<[string, string]>, p: Palette) {
  return items.map(([name, value], index) => {
    const border = `border-top:1px solid ${index ? p.line : p.rule}`;
    return `<tr><td style="padding:11px 0;${border};vertical-align:top;width:40%">${label(name, p.label)}</td><td style="padding:11px 0 11px 12px;${border};vertical-align:top;font-family:${SANS};font-size:15px;line-height:22px;font-weight:bold;color:${p.ink};${wrapValue(false)}">${escape(value)}</td></tr>`;
  }).join("");
}

/** Rótulo acima do valor: não quebra e-mails e senhas no meio, mesmo no celular. */
function stackedRows(items: Array<[string, string]>, p: Palette, mono: boolean) {
  return items.map(([name, value], index) => `<tr><td style="padding:12px 0;border-top:1px solid ${index ? p.line : p.rule}">${label(name, p.label, 10)}<div style="margin-top:3px;font-family:${mono ? MONO : SANS};font-size:${mono ? 17 : 16}px;line-height:23px;font-weight:bold;color:${p.ink};${wrapValue(mono)}">${escape(value)}</div></td></tr>`).join("");
}

/** Livro-razão: rótulo à esquerda, valor discreto alinhado à direita. */
function ledgerRows(items: Array<[string, string]>, p: Palette) {
  return items.map(([name, value]) => `<tr><td style="padding:10px 0;border-top:1px solid ${p.line};vertical-align:top;width:42%">${label(name, p.label, 10)}</td><td align="right" style="padding:10px 0 10px 12px;border-top:1px solid ${p.line};vertical-align:top;font-family:${SANS};font-size:14px;line-height:21px;color:${p.ink};${wrapValue(false)}">${escape(value)}</td></tr>`).join("");
}

export function renderBrandEmail(email: BrandEmail) {
  const layout = email.layout ?? "carta";
  const p = layout === "noturno" ? DARK : LIGHT;
  const pro = email.professional;
  const contacts = contactParts(pro);
  const logo = (width: number) => `<img src="${managementUrl(p.logo)}" width="${width}" height="${Math.round(width * 0.75)}" alt="VR" style="display:block;border:0;width:${width}px;height:${Math.round(width * 0.75)}px">`;
  const paragraph = (text: string) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:25px;color:${p.body}">${escape(text)}</p>`;
  const heading = `<h1 style="margin:0 0 22px;font-family:${SANS};font-size:${layout === "noturno" ? 30 : 28}px;line-height:${layout === "noturno" ? 36 : 34}px;font-weight:bold;letter-spacing:-0.6px;color:${p.ink}">${escape(email.title)}</h1>`;

  const header = layout === "carta"
    ? `<tr><td style="padding:36px 28px 18px">${table("", `<tr><td style="vertical-align:middle;width:36px">${logo(36)}</td><td style="vertical-align:middle;padding-left:12px"><div style="font-family:${SANS};font-size:14px;line-height:18px;font-weight:bold;color:${p.ink}">${escape(pro.name)}</div>${pro.title ? `<div style="font-family:${SANS};font-size:12px;line-height:16px;color:${p.muted}">${escape(pro.title)}</div>` : ""}</td><td align="right" style="vertical-align:middle">${label(email.kicker, p.kicker)}</td></tr>`)}</td></tr>
<tr><td style="padding:0 28px"><div style="height:2px;line-height:2px;font-size:0;background:${p.rule}">&nbsp;</div></td></tr>`
    : layout === "noturno"
      ? `<tr><td style="padding:40px 28px 0">${table("", `<tr><td style="vertical-align:middle">${logo(40)}</td><td align="right" style="vertical-align:middle">${label(email.kicker, p.kicker)}</td></tr>`)}</td></tr>`
      : `<tr><td style="padding:32px 28px 0">${logo(32)}</td></tr>`;

  const details = email.details?.length
    ? table(`margin:18px 0 26px;border-bottom:1px solid ${p.line}`, layout === "carta" ? columnRows(email.details, p) : layout === "noturno" ? stackedRows(email.details, p, false) : ledgerRows(email.details, p))
    : "";
  const highlight = email.highlight
    ? `<div style="margin:26px 0 4px">${label(email.highlight[0], p.label, 10)}</div><div style="margin:0 0 6px;font-family:${SANS};font-size:44px;line-height:50px;font-weight:bold;letter-spacing:-1.5px;color:${p.ink}">${escape(email.highlight[1])}</div>`
    : "";
  const credentials = email.credentials?.length ? table(`margin:18px 0 26px;border-bottom:1px solid ${p.line}`, stackedRows(email.credentials, p, true)) : "";
  const noteColor = email.note?.tone === "attention" ? p.attention : p.info;
  const note = email.note
    ? table(`margin:4px 0 26px;border-left:3px solid ${noteColor}`, `<tr><td style="padding:2px 0 2px 16px">${label(email.note.label, noteColor)}<div style="margin-top:6px;font-family:${SANS};font-size:15px;line-height:23px;color:${p.ink}">${escape(email.note.text)}</div></td></tr>`)
    : "";
  const button = layout === "noturno" ? { bg: "#FFFFFF", fg: "#000000" } : layout === "destaque" ? { bg: ACCENT, fg: "#FFFFFF" } : { bg: "#000000", fg: "#FFFFFF" };
  const action = email.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px"><tr><td style="background:${button.bg}"><a href="${escape(email.action.href)}" style="display:inline-block;padding:14px 22px;font-family:${MONO};font-size:12px;line-height:14px;letter-spacing:1.4px;text-transform:uppercase;color:${button.fg};text-decoration:none;font-weight:bold">${escape(email.action.label)}${layout === "carta" ? " &rarr;" : ""}</a></td></tr></table>`
    : "";
  const closing = (email.closing ?? []).map((text) => `<p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:22px;color:${p.muted}">${escape(text)}</p>`).join("");

  const contactLinks = (separator: string) => contacts.map((part) => `<a href="${escape(part.href)}" style="color:${layout === "noturno" ? p.body : p.muted};text-decoration:none">${escape(part.text)}</a>`).join(separator);
  const reason = `<div style="font-family:${SANS};font-size:12px;line-height:18px;color:${p.faint}">${escape(email.reason)}</div>`;
  const footer = layout === "carta"
    ? `<tr><td style="padding:34px 28px 36px">
${email.signOff ? `<p style="margin:0 0 4px;font-family:${SANS};font-size:15px;line-height:22px;color:${p.body}">${escape(email.signOff)}</p>` : ""}<div style="font-family:${SANS};font-size:15px;line-height:22px;font-weight:bold;color:${p.ink}">${escape(pro.name)}</div>
${contacts.length ? `<div style="margin-top:2px;font-family:${MONO};font-size:12px;line-height:19px">${contactLinks("<br>")}</div>` : ""}
<div style="margin-top:26px;padding-top:14px;border-top:1px solid ${p.line}">${reason}</div></td></tr>`
    : `<tr><td style="padding:40px 28px 38px"><div style="height:1px;line-height:1px;font-size:0;background:${layout === "noturno" ? ACCENT : p.rule}">&nbsp;</div>
${email.signOff ? `<p style="margin:16px 0 2px;font-family:${SANS};font-size:14px;line-height:21px;color:${p.body}">${escape(email.signOff)}</p>` : ""}<div style="margin-top:${email.signOff ? 0 : 16}px;font-family:${SANS};font-size:14px;line-height:21px;font-weight:bold;color:${p.ink}">${escape(pro.name)}${pro.title ? ` <span style="font-weight:normal;color:${p.muted}">&middot; ${escape(pro.title)}</span>` : ""}</div>
${contacts.length ? `<div style="margin-top:3px;font-family:${SANS};font-size:13px;line-height:20px">${contactLinks(layout === "noturno" ? " &middot; " : "<br>")}</div>` : ""}
<div style="margin-top:18px">${reason}</div></td></tr>`;

  const kickerAbove = layout === "destaque" ? `<div style="margin-bottom:12px">${label(`■  ${email.kicker}`, p.kicker)}</div>` : "";
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="${layout === "noturno" ? "dark only" : "light only"}"><meta name="supported-color-schemes" content="${layout === "noturno" ? "dark" : "light"}"><title>${escape(email.subject)}</title></head>
<body style="margin:0;padding:0;background:${p.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${p.bg}">${escape(email.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.bg}" style="background:${p.bg}"><tr><td align="center" style="padding:0">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
${header}
<tr><td style="padding:${layout === "carta" ? 34 : 44}px 28px 8px">
${kickerAbove}${heading}
${email.paragraphs.map(paragraph).join("")}
${highlight}${details}${credentials}${note}${action}${closing}
</td></tr>
${footer}
</table></td></tr></table>
</body></html>`;

  const text = [
    email.title,
    "",
    ...email.paragraphs.flatMap((line) => [line, ""]),
    ...(email.highlight ? [`${email.highlight[0]}: ${email.highlight[1]}`, ""] : []),
    ...(email.details?.length ? [...email.details.map(([name, value]) => `${name}: ${value}`), ""] : []),
    ...(email.credentials?.length ? [...email.credentials.map(([name, value]) => `${name}: ${value}`), ""] : []),
    ...(email.note ? [`${email.note.label}: ${email.note.text}`, ""] : []),
    ...(email.action ? [`${email.action.label}: ${email.action.href}`, ""] : []),
    ...(email.closing?.length ? [...email.closing, ""] : []),
    ...(email.signOff ? [email.signOff] : ["--"]),
    pro.name,
    ...contacts.map((part) => part.text),
    "",
    email.reason,
  ].join("\n");

  return { subject: email.subject, html, text };
}
