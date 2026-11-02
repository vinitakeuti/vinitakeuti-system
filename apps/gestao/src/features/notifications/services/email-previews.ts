import { managementUrl } from "@/features/auth/services/auth-host";
import { renderBrandEmail, type EmailProfessional } from "@/features/notifications/templates/brand-email";
import { accessEmail, documentAvailableEmail, paymentDueEmail, paymentOverdueEmail, paymentReceiptEmail, signatureReviewedEmail, systemStatusEmail } from "@/features/notifications/services/client-emails";

/** Modelos de e-mail com dados de exemplo, para a pré-visualização e o envio de teste em Configurações. */
export const EMAIL_MODELS = [
  { id: "acesso", group: "Cliente", name: "Acesso ao portal", when: "Ao criar o acesso do cliente no perfil dele." },
  { id: "nova-senha", group: "Cliente", name: "Nova senha", when: "Ao gerar uma nova senha no perfil do cliente." },
  { id: "documento-assinar", group: "Cliente", name: "Documento para assinar", when: "Ao concluir proposta, contrato, cessão ou memorial." },
  { id: "documento-livre", group: "Cliente", name: "Novo documento", when: "Ao concluir um documento livre vinculado ao cliente." },
  { id: "assinatura-aprovada", group: "Cliente", name: "Assinatura confirmada", when: "Ao aprovar a via assinada enviada pelo cliente." },
  { id: "assinatura-recusada", group: "Cliente", name: "Nova via necessária", when: "Ao recusar a via assinada, com o motivo." },
  { id: "vencimento", group: "Cliente", name: "Lembrete de vencimento", when: "Uma vez por parcela, até 3 dias antes de vencer." },
  { id: "atraso", group: "Cliente", name: "Pagamento em aberto", when: "Uma vez por parcela, no primeiro dia de atraso." },
  { id: "recibo", group: "Cliente", name: "Pagamento confirmado", when: "Ao registrar um recebimento (Asaas ou no Financeiro)." },
  { id: "sistema-fora", group: "Cliente", name: "Sistema fora do ar", when: "Quando o monitoramento confirma a queda de um sistema do cliente." },
  { id: "sistema-voltou", group: "Cliente", name: "Sistema de volta", when: "Quando o sistema do cliente volta a responder." },
  { id: "aviso-gestao", group: "Você", name: "Avisos da gestão", when: "Monitoramento, pagamentos e portal: o mesmo layout para todos os seus avisos." },
] as const;

export type EmailModelId = (typeof EMAIL_MODELS)[number]["id"];

export function isEmailModel(value: string | undefined): value is EmailModelId {
  return EMAIL_MODELS.some((model) => model.id === value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildEmailPreview(id: EmailModelId, professional: EmailProfessional, now = new Date()) {
  const name = "Maria";
  const installment = { description: "ORC-261016-A40283 · Site institucional", number: 2, total: 4, amountCents: 125_000, dueDate: new Date(now.getTime() + 3 * DAY_MS) };
  switch (id) {
    case "acesso": return accessEmail({ name, email: "maria@empresa.com.br", password: "Kp7m-Qx3a-Wd9r", created: true, professional });
    case "nova-senha": return accessEmail({ name, email: "maria@empresa.com.br", password: "Kp7m-Qx3a-Wd9r", created: false, professional });
    case "documento-assinar": return documentAvailableEmail({ name, kindName: "Contrato de prestação de serviço", title: "Site institucional", code: "CTR-261016-7F2A91", signable: true, professional });
    case "documento-livre": return documentAvailableEmail({ name, kindName: "Documento livre", title: "Relatório mensal de outubro", code: "DOC-261030-C03927", signable: false, professional });
    case "assinatura-aprovada": return signatureReviewedEmail({ name, title: "Site institucional", code: "CTR-261016-7F2A91", approved: true, reason: null, professional });
    case "assinatura-recusada": return signatureReviewedEmail({ name, title: "Site institucional", code: "CTR-261016-7F2A91", approved: false, reason: "Falta a assinatura na última página.", professional });
    case "vencimento": return paymentDueEmail({ name, installment, daysLeft: 3, professional });
    case "atraso": return paymentOverdueEmail({ name, installment: { ...installment, dueDate: new Date(now.getTime() - DAY_MS) }, professional });
    case "recibo": return paymentReceiptEmail({ name, description: installment.description, amountCents: 125_000, paidAt: now, remainingCents: 250_000, professional });
    case "sistema-fora": return systemStatusEmail({ name, system: "Loja online", url: "https://loja.empresa.com.br", down: true, durationMs: null, professional });
    case "sistema-voltou": return systemStatusEmail({ name, system: "Loja online", url: "https://loja.empresa.com.br", down: false, durationMs: 23 * 60_000, professional });
    case "aviso-gestao": return renderBrandEmail({ subject: "Pagamento recebido: Maria Souza · R$ 1.250,00", preheader: "Cliente: Maria Souza", kicker: "PORTAL DO CLIENTE", title: "Pagamento recebido pelo portal.", paragraphs: ["O recebimento já foi registrado no Financeiro."], details: [["Cliente", "Maria Souza"], ["Valor", "R$ 1.250,00"]], action: { label: "Abrir na gestão", href: managementUrl("/financeiro") }, reason: "Aviso automático da VR Gestão · Portal do cliente.", professional });
  }
}
