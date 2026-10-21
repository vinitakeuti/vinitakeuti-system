export const MAX_QUOTE_PAYMENTS = 50;
export const MAX_QUOTE_PAYMENT_NOTES = 2_000;

export type QuotePaymentInput = { amountCents: number; paidAt: Date };

type ParsedQuotePayments =
  | { ok: true; payments: QuotePaymentInput[]; paymentNotes: string | null }
  | { ok: false; error: string };

function formValues(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => typeof value === "string" ? value.trim().slice(0, 20) : "");
}

function amountToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

/** Datas de pagamento são dias civis: gravadas ao meio-dia UTC para não mudar de dia em nenhum fuso do Brasil. */
function paymentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? date : null;
}

/**
 * Lê as linhas de pagamento enviadas pelo formulário do orçamento.
 * Linhas totalmente vazias são ignoradas; a soma nunca ultrapassa o total da proposta.
 */
export function parseQuotePayments(formData: FormData, totalCents: number): ParsedQuotePayments {
  const amounts = formValues(formData, "paymentAmount");
  const dates = formValues(formData, "paymentDate");
  if (amounts.length !== dates.length || amounts.length > MAX_QUOTE_PAYMENTS) return { ok: false, error: `Registre no máximo ${MAX_QUOTE_PAYMENTS} pagamentos.` };

  const payments: QuotePaymentInput[] = [];
  for (let index = 0; index < amounts.length; index += 1) {
    const amount = amounts[index];
    const date = dates[index];
    if (!amount && !date) continue;
    if (!amount || !date) return { ok: false, error: "Informe o valor e a data de cada pagamento." };
    const amountCents = amountToCents(amount);
    if (!Number.isInteger(amountCents) || amountCents < 1) return { ok: false, error: "Cada pagamento precisa ter valor maior que zero." };
    const paidAt = paymentDate(date);
    if (!paidAt) return { ok: false, error: "Informe uma data de pagamento válida." };
    payments.push({ amountCents, paidAt });
  }

  const paidCents = payments.reduce((total, payment) => total + payment.amountCents, 0);
  if (paidCents > totalCents) return { ok: false, error: "A soma dos pagamentos não pode ultrapassar o total do orçamento." };

  const notes = formData.get("paymentNotes");
  const paymentNotes = typeof notes === "string" ? notes.replace(/\r\n?/g, "\n").trim().slice(0, MAX_QUOTE_PAYMENT_NOTES) : "";
  payments.sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime());
  return { ok: true, payments, paymentNotes: paymentNotes || null };
}
