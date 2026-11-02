import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientPortalUrl } from "@/features/auth/services/auth-host";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { loadReceivables, portalTodayStart } from "@/features/client-portal/queries/portal-queries";
import { renderBrandEmail, type EmailProfessional } from "@/features/notifications/templates/brand-email";
import { clientRecipient, emailProfessional, enqueueEmail, firstName } from "@/features/notifications/services/email-outbox";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * E-mails para o cliente: acesso ao portal, documentos, conferência da via assinada, pagamentos e sistemas. Cada
 * `…Email` monta a mensagem (também usada na pré-visualização das Configurações); cada `notify…` descobre o
 * destinatário (o acesso ativo ao portal) e põe na fila. Nenhuma falha aqui interrompe quem disparou.
 */

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Maceio" });
const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_REMINDER_DAYS = 3;
const OVERDUE_WINDOW_DAYS = 7;
const MAX_REMINDER_CLIENTS = 500;

const CLIENT_REASON = "Você recebe este e-mail porque tem acesso à área do cliente de Vinicius Riudi.";
const SIGN_OFF = "Abraço,";
const portal = (path = "") => `${clientPortalUrl()}${path}`;
const hello = (name: string) => name ? `Olá, ${name}.` : "Olá.";
const installmentLabel = (number: number | null, total: number) => number ? `Parcela ${number} de ${total}` : "Pagamento único";

function duration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")} min` : ""}` : `${Math.round(hours / 24)} dias`;
}

/* Mensagens */

export function accessEmail({ name, email, password, created, professional }: { name: string; email: string; password: string; created: boolean; professional: EmailProfessional }) {
  return renderBrandEmail({
    layout: "noturno",
    subject: created ? "Seu acesso à área do cliente" : "Nova senha da área do cliente",
    preheader: created ? "Acompanhe serviços, pagamentos e documentos em um só lugar." : "Use a senha provisória e crie uma nova no primeiro acesso.",
    kicker: "ÁREA DO CLIENTE",
    title: created ? "Sua área do cliente está pronta." : "Geramos uma nova senha para você.",
    paragraphs: [hello(name), created ? "Por ela você acompanha os serviços contratados, os pagamentos e os documentos do nosso trabalho, e envia as vias assinadas." : "A senha anterior deixou de valer. Entre com a senha provisória abaixo."],
    credentials: [["E-mail", email], ["Senha provisória", password]],
    action: { label: "Entrar na área do cliente", href: portal("/entrar") },
    closing: ["No primeiro acesso, você cria uma senha sua. A provisória deixa de valer depois disso.", "Se não esperava este e-mail, responda esta mensagem."],
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

export function documentAvailableEmail({ name, kindName, title, code, signable, professional }: { name: string; kindName: string; title: string; code: string; signable: boolean; professional: EmailProfessional }) {
  return renderBrandEmail({
    layout: "noturno",
    subject: signable ? `Documento para assinar: ${title}` : `Novo documento: ${title}`,
    preheader: signable ? "Baixe o PDF, assine pelo gov.br e envie a via assinada pela área do cliente." : "O PDF já está disponível na área do cliente.",
    kicker: "DOCUMENTO",
    title: signable ? "Um documento aguarda sua assinatura." : "Um novo documento está disponível.",
    paragraphs: [hello(name), signable ? "Baixe o PDF, assine pelo assinador do gov.br (gratuito) e envie a via assinada pela área do cliente. Eu confiro e aviso você." : "O documento já está na área do cliente, pronto para baixar."],
    details: [["Documento", kindName], ["Título", title], ["Código", code]],
    action: { label: signable ? "Ver e assinar" : "Baixar o documento", href: portal("/documentos") },
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

export function signatureReviewedEmail({ name, title, code, approved, reason, professional }: { name: string; title: string; code: string; approved: boolean; reason: string | null; professional: EmailProfessional }) {
  return renderBrandEmail({
    subject: approved ? `Assinatura confirmada: ${title}` : `Precisamos de uma nova via: ${title}`,
    preheader: approved ? "Conferi a via assinada e está tudo certo." : "A via enviada não pôde ser aceita. Veja o motivo.",
    kicker: "ASSINATURA",
    title: approved ? "Sua assinatura foi confirmada." : "A via assinada precisa ser enviada de novo.",
    paragraphs: [hello(name), approved ? "Conferi a via que você enviou e está tudo certo. O documento consta como assinado na área do cliente." : "Conferi a via que você enviou, mas ela não pôde ser aceita. Ajuste o ponto abaixo e envie uma nova via pela área do cliente."],
    details: [["Título", title], ["Código", code]],
    note: approved ? undefined : { tone: "attention", label: "Motivo", text: reason || "A via enviada não confere com o documento." },
    action: { label: approved ? "Ver documentos" : "Enviar nova via", href: portal("/documentos") },
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

type InstallmentInfo = { description: string; number: number | null; total: number; amountCents: number; dueDate: Date };

export function paymentDueEmail({ name, installment, daysLeft, professional }: { name: string; installment: InstallmentInfo; daysLeft: number; professional: EmailProfessional }) {
  const when = daysLeft <= 0 ? "hoje" : daysLeft === 1 ? "amanhã" : `em ${daysLeft} dias`;
  return renderBrandEmail({
    layout: "destaque",
    subject: `Seu pagamento vence ${when}`,
    preheader: `${money.format(installment.amountCents / 100)} com vencimento em ${longDate.format(installment.dueDate)}.`,
    kicker: "PAGAMENTO",
    title: `Seu pagamento vence ${when}.`,
    paragraphs: [hello(name), "Um lembrete do próximo vencimento. Pela área do cliente você vê os detalhes e as formas de pagamento."],
    highlight: ["Valor", money.format(installment.amountCents / 100)],
    details: [["Referente a", installment.description], ["Parcela", installmentLabel(installment.number, installment.total)], ["Vencimento", longDate.format(installment.dueDate)]],
    action: { label: "Ver pagamentos", href: portal("/pagamentos") },
    closing: ["Se você já pagou, desconsidere este lembrete."],
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

export function paymentOverdueEmail({ name, installment, professional }: { name: string; installment: InstallmentInfo; professional: EmailProfessional }) {
  return renderBrandEmail({
    layout: "destaque",
    subject: "Pagamento em aberto",
    preheader: `${money.format(installment.amountCents / 100)} venceu em ${longDate.format(installment.dueDate)}.`,
    kicker: "PAGAMENTO",
    title: "Um pagamento está em aberto.",
    paragraphs: [hello(name), "Não identifiquei o pagamento abaixo até o vencimento. Pela área do cliente você vê os detalhes e as formas de pagamento."],
    highlight: ["Valor em aberto", money.format(installment.amountCents / 100)],
    details: [["Referente a", installment.description], ["Parcela", installmentLabel(installment.number, installment.total)], ["Venceu em", longDate.format(installment.dueDate)]],
    note: { tone: "attention", label: "Já pagou?", text: "Pagamentos por Pix ou transferência podem levar um tempo para aparecer. Se já pagou, avise pela área do cliente em Pagamentos." },
    action: { label: "Ver pagamentos", href: portal("/pagamentos") },
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

export function paymentReceiptEmail({ name, description, amountCents, paidAt, remainingCents, professional }: { name: string; description: string; amountCents: number; paidAt: Date; remainingCents: number; professional: EmailProfessional }) {
  return renderBrandEmail({
    layout: "destaque",
    subject: `Pagamento confirmado: ${money.format(amountCents / 100)}`,
    preheader: `Recebi seu pagamento de ${money.format(amountCents / 100)}. Obrigado.`,
    kicker: "RECIBO",
    title: "Pagamento confirmado. Obrigado.",
    paragraphs: [hello(name), "Recebi o seu pagamento e ele já consta na área do cliente."],
    highlight: ["Valor pago", money.format(amountCents / 100)],
    details: [["Referente a", description], ["Data", longDate.format(paidAt)], ["Saldo restante", remainingCents > 0 ? money.format(remainingCents / 100) : "Quitado"]],
    action: { label: "Ver pagamentos", href: portal("/pagamentos") },
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

export function systemStatusEmail({ name, system, url, down, durationMs, professional }: { name: string; system: string; url: string | null; down: boolean; durationMs: number | null; professional: EmailProfessional }) {
  return renderBrandEmail({
    subject: down ? `${system} está fora do ar` : `${system} voltou ao ar`,
    preheader: down ? "Já fui avisado e estou trabalhando para normalizar." : "O sistema voltou a responder normalmente.",
    kicker: "SISTEMA",
    title: down ? `${system} está fora do ar.` : `${system} voltou ao ar.`,
    paragraphs: [hello(name), down ? "O monitoramento identificou que o sistema parou de responder, confirmado em duas verificações. Já fui avisado e estou trabalhando para normalizar." : "O sistema voltou a responder normalmente. Se notar algo diferente, me avise respondendo este e-mail."],
    details: [["Sistema", system], ...(url ? [["Endereço", url.replace(/^https?:\/\//i, "")] as [string, string]] : []), ...(!down && durationMs !== null ? [["Tempo fora do ar", duration(durationMs)] as [string, string]] : [])],
    note: down ? { tone: "info", label: "Próximo aviso", text: "Você recebe outro e-mail assim que o sistema voltar." } : undefined,
    action: { label: "Ver serviços", href: portal("/servicos") },
    signOff: SIGN_OFF,
    reason: CLIENT_REASON,
    professional,
  });
}

/* Disparos */

/** Põe o e-mail na fila sem deixar uma falha (banco, perfil) interromper a ação que o disparou. */
export async function notifySafely(task: () => Promise<unknown>) {
  try { await task(); }
  catch (error) { await logEvent({ source: "sistema", level: "error", event: "email.client.enqueue_failed", message: `E-mail para cliente não entrou na fila: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }); }
}

/** Acesso criado ou senha nova: vai para o e-mail do acesso, com a senha provisória. */
export async function notifyPortalAccess({ clientId, email, password, created }: { clientId: string; email: string; password: string; created: boolean }) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  return enqueueEmail({ kind: "client.access", to: email, clientId, email: accessEmail({ name: firstName(client?.name ?? ""), email, password, created, professional: await emailProfessional() }) });
}

/** Documento concluído: aparece no portal para assinar (ou só baixar, o livre). Anunciado uma vez por documento. */
export async function notifyDocumentAvailable(target: { quoteId: string } | { documentId: string }) {
  const found = "quoteId" in target
    ? await prisma.quote.findUnique({ where: { id: target.quoteId }, select: { id: true, clientId: true, code: true, title: true, completedAt: true } }).then((quote) => quote && { ...quote, key: `quote:${quote.id}`, kindName: "Proposta comercial", signable: true })
    : await prisma.clientDocument.findUnique({ where: { id: target.documentId }, select: { id: true, clientId: true, code: true, title: true, completedAt: true, kind: true } }).then((document) => {
      if (!document) return null;
      const info = documentKindFromEnum(document.kind);
      return { ...document, key: `document:${document.id}`, kindName: info.name, signable: info.signable };
    });
  if (!found?.clientId || !found.completedAt) return false;
  const recipient = await clientRecipient(found.clientId);
  if (!recipient) return false;
  return enqueueEmail({ kind: "client.document", to: recipient.email, clientId: found.clientId, dedupeKey: `${found.key}:available`, email: documentAvailableEmail({ name: recipient.firstName, kindName: found.kindName, title: found.title, code: found.code, signable: found.signable, professional: await emailProfessional() }) });
}

/** Via assinada aprovada ou recusada (com o motivo). */
export async function notifySignatureReviewed(signedId: string) {
  const signed = await prisma.signedDocument.findUnique({ where: { id: signedId }, select: { clientId: true, reviewStatus: true, rejectionReason: true, quote: { select: { code: true, title: true } }, document: { select: { code: true, title: true } } } });
  const target = signed?.quote ?? signed?.document;
  if (!signed || !target || signed.reviewStatus === "IN_REVIEW") return false;
  const recipient = await clientRecipient(signed.clientId);
  if (!recipient) return false;
  const approved = signed.reviewStatus === "APPROVED";
  return enqueueEmail({ kind: "client.signature", to: recipient.email, clientId: signed.clientId, dedupeKey: `signature:${signedId}:${signed.reviewStatus}`, email: signatureReviewedEmail({ name: recipient.firstName, title: target.title, code: target.code, approved, reason: signed.rejectionReason, professional: await emailProfessional() }) });
}

/** Recebimento registrado numa entrada que veio de proposta do cliente: recibo com o saldo que falta. */
export async function notifyPaymentReceipt(paymentId: string) {
  const payment = await prisma.financialPayment.findUnique({ where: { id: paymentId }, select: { amountCents: true, paidAt: true, entry: { select: { description: true, amountCents: true, paidCents: true, type: true, sourceKey: true } } } });
  const quoteId = payment?.entry.sourceKey?.startsWith("quote:") ? payment.entry.sourceKey.slice("quote:".length) : null;
  if (!payment || payment.entry.type !== "INCOME" || !quoteId) return false;
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { clientId: true } });
  if (!quote?.clientId) return false;
  const recipient = await clientRecipient(quote.clientId);
  if (!recipient) return false;
  return enqueueEmail({ kind: "client.payment.receipt", to: recipient.email, clientId: quote.clientId, dedupeKey: `receipt:${paymentId}`, email: paymentReceiptEmail({ name: recipient.firstName, description: payment.entry.description, amountCents: payment.amountCents, paidAt: payment.paidAt, remainingCents: Math.max(0, payment.entry.amountCents - payment.entry.paidCents), professional: await emailProfessional() }) });
}

/** Sistema do cliente caiu (queda confirmada) ou voltou. */
export async function notifySystemStatus({ appId, down, durationMs }: { appId: string; down: boolean; durationMs: number | null }) {
  const app = await prisma.monitoredApp.findUnique({ where: { id: appId }, select: { name: true, url: true, clientId: true } });
  if (!app?.clientId) return false;
  const recipient = await clientRecipient(app.clientId);
  if (!recipient) return false;
  return enqueueEmail({ kind: "client.system", to: recipient.email, clientId: app.clientId, email: systemStatusEmail({ name: recipient.firstName, system: app.name, url: app.url, down, durationMs, professional: await emailProfessional() }) });
}

/**
 * Lembretes diários de pagamento, para clientes com acesso ao portal: parcela que vence nos próximos 3 dias e parcela
 * vencida há até 7 dias. Cada parcela recebe cada aviso uma vez só (mesmo que o agendador fique parado um dia).
 */
export async function enqueuePaymentReminders(now = new Date()) {
  const todayStart = portalTodayStart(now);
  const users = await prisma.user.findMany({ where: { role: UserRole.CLIENT, isActive: true, clientId: { not: null } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_REMINDER_CLIENTS, select: { clientId: true } });
  const clientIds = [...new Set(users.map((user) => user.clientId!))];
  if (!clientIds.length) return 0;
  const professional = await emailProfessional();
  let queued = 0;
  for (const clientId of clientIds) {
    const recipient = await clientRecipient(clientId);
    if (!recipient) continue;
    const { open } = await loadReceivables(clientId);
    for (const installment of open) {
      const days = Math.round((installment.dueDate.getTime() - todayStart.getTime()) / DAY_MS);
      const key = `${installment.entryId}:${installment.number ?? 0}:${installment.dueDate.toISOString().slice(0, 10)}`;
      const info = { description: installment.entryDescription, number: installment.number, total: installment.total, amountCents: installment.remaining, dueDate: installment.dueDate };
      if (days >= 0 && days <= PAYMENT_REMINDER_DAYS) {
        if (await enqueueEmail({ kind: "client.payment.due", to: recipient.email, clientId, dedupeKey: `due:${key}`, email: paymentDueEmail({ name: recipient.firstName, installment: info, daysLeft: days, professional }) })) queued += 1;
      } else if (days < 0 && days >= -OVERDUE_WINDOW_DAYS) {
        if (await enqueueEmail({ kind: "client.payment.overdue", to: recipient.email, clientId, dedupeKey: `overdue:${key}`, email: paymentOverdueEmail({ name: recipient.firstName, installment: info, professional }) })) queued += 1;
      }
    }
  }
  return queued;
}
