/** CPF e CNPJ: só dígitos no banco, pontuação habitual na tela. */

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Formata enquanto se digita (aceita valores incompletos). */
export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 6) && `.${digits.slice(3, 6)}`, digits.slice(6, 9) && `.${digits.slice(6, 9)}`, digits.slice(9, 11) && `-${digits.slice(9, 11)}`].filter(Boolean).join("");
}

export function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return [digits.slice(0, 2), digits.slice(2, 5) && `.${digits.slice(2, 5)}`, digits.slice(5, 8) && `.${digits.slice(5, 8)}`, digits.slice(8, 12) && `/${digits.slice(8, 12)}`, digits.slice(12, 14) && `-${digits.slice(12, 14)}`].filter(Boolean).join("");
}

/** Um único campo para os dois: até 11 dígitos é CPF, acima disso CNPJ. */
export function formatCpfOrCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
}

function allSame(digits: string) {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSame(digits)) return false;
  const check = (length: number) => {
    const sum = digits.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSame(digits)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Identificação exibida nos documentos e PDFs: "CNPJ 00.000.000/0000-00 · CPF 000.000.000-00". */
export function clientDocumentLabel(client: { cpf?: string | null; cnpj?: string | null }) {
  return [client.cnpj ? `CNPJ ${formatCnpj(client.cnpj)}` : null, client.cpf ? `CPF ${formatCpf(client.cpf)}` : null].filter(Boolean).join(" · ") || null;
}
