/**
 * Custo da IA. O OpenRouter informa o custo de cada resposta; para os demais provedores, o custo é calculado pelos
 * tokens e pelo preço do modelo (por milhão de tokens) configurado em Integrações. Tudo em micro-dólares (inteiros).
 */

export type ModelPrice = { inputPriceMicros: number | null; outputPriceMicros: number | null };

/** Custo em micro-dólares pelos tokens e pelo preço do modelo; null sem preço configurado. */
export function costFromPrice(inputTokens: number, outputTokens: number, price: ModelPrice) {
  if (price.inputPriceMicros === null || price.outputPriceMicros === null) return null;
  return Math.round((inputTokens * price.inputPriceMicros + outputTokens * price.outputPriceMicros) / 1_000_000);
}

/** "3,00" ou "3.00" (dólares) em micro-dólares; null quando vazio; NaN quando inválido. */
export function parseUsd(value: string) {
  const text = value.trim().replace(/^US\$\s*/i, "");
  if (!text) return null;
  const number = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(number) && number >= 0 && number <= 10_000 ? Math.round(number * 1_000_000) : Number.NaN;
}

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "US$ 0,0912" e, com cotação, "≈ R$ 0,50". Valores pequenos mantêm 4 casas para não virarem zero. */
export function formatCost(micros: number | null, usdBrlCents: number | null) {
  if (micros === null) return { usd: "—", brl: null };
  const dollars = micros / 1_000_000;
  const reais = usdBrlCents ? (dollars * usdBrlCents) / 100 : null;
  return { usd: usd.format(dollars).replace("US$", "US$ ").replace(/\s+/, " "), brl: reais === null ? null : reais > 0 && reais < 0.01 ? "< R$ 0,01" : brl.format(reais) };
}

export function priceToInput(micros: number | null | undefined) {
  return micros === null || micros === undefined ? "" : String(micros / 1_000_000).replace(".", ",");
}
