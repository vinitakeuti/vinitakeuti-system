import { resolveMx } from "node:dns/promises";

/**
 * Filtro de dados falsos no início do atendimento do site, antes de qualquer chamada à IA (que custaria tokens).
 * Erro de digitação não é dado falso: o que dá para corrigir sem dúvida é corrigido (celular sem o 9, zero ou +55 na
 * frente, vírgula no e-mail); o que dá para adivinhar vira sugestão ("você quis dizer …@gmail.com?"); o que não dá
 * vira uma mensagem dizendo o que conferir. Só o claramente inventado é recusado: nomes digitados ao acaso, números
 * repetidos ou em sequência, e-mails descartáveis ou de domínio que não existe.
 */

const PLACEHOLDER_WORDS = new Set(["teste", "test", "testando", "fulano", "ciclano", "beltrano", "nome", "sobrenome", "anonimo", "anonima", "ninguem", "xxx", "asd", "asdf", "qwe", "qwer", "abc", "aaa", "zzz", "fake", "null", "undefined", "admin", "usuario", "user"]);
const KEYBOARD_RUNS = /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|mnbv|lkjh|poiu)/;
const DISPOSABLE = new Set(["mailinator.com", "yopmail.com", "guerrillamail.com", "sharklasers.com", "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "tempmail.net", "throwawaymail.com", "trashmail.com", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mohmal.com", "fakeinbox.com", "emailondeck.com", "mintemail.com", "mytemp.email", "tempr.email", "discard.email", "spamgourmet.com", "burnermail.io", "inboxkitten.com", "moakt.com", "tmail.ws", "email-temp.com", "mailnesia.com", "tempail.com"]);
/** DDDs existentes no Brasil. */
const DDDS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99]);

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavra digitada ao acaso: letra repetida, sílaba repetida, sequência do teclado ou consoantes demais. */
export function looksRandom(word: string) {
  const letters = plain(word).replace(/[^a-z]/g, "");
  if (letters.length < 3) return false;
  if (PLACEHOLDER_WORDS.has(letters)) return true;
  if (/(.)\1{3,}/.test(letters) || /(..)\1{2,}/.test(letters) || KEYBOARD_RUNS.test(letters)) return true;
  if (!/[aeiouy]/.test(letters)) return true;
  if (/[^aeiouy]{5,}/.test(letters)) return true;
  const clusters = letters.match(/[^aeiouy]{3,}/g)?.length ?? 0;
  if (letters.length >= 9 && clusters >= 2) return true;
  const vowels = letters.match(/[aeiouy]/g)?.length ?? 0;
  return letters.length >= 8 && vowels / letters.length < 0.25;
}

export function suspiciousName(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return words.some((word) => looksRandom(word)) || words.every((word) => PLACEHOLDER_WORDS.has(plain(word)));
}

export type PhoneResult = { ok: true; digits: string; corrected: boolean } | { ok: false; error: string };

/**
 * Telefone brasileiro como a pessoa digitou → 55 + DDD + número. Aceita +55, zero antes do DDD, espaços e traços.
 * Celular digitado sem o 9 (8 dígitos começando com 6 a 9, o formato antigo) ganha o 9. Erros que não dá para
 * adivinhar voltam com uma mensagem dizendo o que conferir.
 */
export function normalizeBrazilPhone(raw: string): PhoneResult {
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10) return { ok: false, error: "Informe o telefone com DDD, por exemplo (82) 99999-0000." };
  if (digits.length > 11) return { ok: false, error: "O telefone ficou com dígitos a mais. Confira o número com DDD." };
  const ddd = digits.slice(0, 2);
  if (!DDDS.has(Number(ddd))) return { ok: false, error: `Confira o DDD: ${ddd} não é um DDD do Brasil.` };
  let number = digits.slice(2);
  let corrected = false;
  if (number.length === 8 && /^[6-9]/.test(number)) { number = `9${number}`; corrected = true; }
  if (number.length === 9 && number[0] !== "9") return { ok: false, error: "Confira o telefone: o celular tem 9 dígitos e começa com 9." };
  if (number.length === 8 && !/^[2-5]/.test(number)) return { ok: false, error: "Confira o telefone: o número parece incompleto." };
  return { ok: true, digits: `55${ddd}${number}`, corrected };
}

/** Número claramente inventado: dígitos repetidos ou em sequência. `digits` vem normalizado (55 + DDD + número). */
export function suspiciousPhone(digits: string) {
  const number = digits.slice(4);
  const core = number.length === 9 ? number.slice(1) : number;
  if (new Set(core).size <= 2) return true;
  if (/(\d)\1{5,}/.test(number)) return true;
  return ["01234567", "12345678", "23456789", "98765432", "87654321", "76543210"].some((sequence) => core.includes(sequence));
}

/** Erros de digitação comuns nos provedores mais usados no Brasil. */
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmal.com": "gmail.com", "gnail.com": "gmail.com", "gmaill.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmail.comm": "gmail.com", "gmail.com.br": "gmail.com", "gmail.cmo": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com", "homail.com": "hotmail.com", "hotmil.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.cm": "hotmail.com", "hotmail.com.b": "hotmail.com.br",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outllok.com": "outlook.com", "otlook.com": "outlook.com", "outlook.con": "outlook.com", "outlook.co": "outlook.com", "outlook.com.b": "outlook.com.br",
  "yaho.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.con": "yahoo.com", "yaho.com.br": "yahoo.com.br", "yahoo.com.b": "yahoo.com.br", "yahooo.com.br": "yahoo.com.br",
  "iclod.com": "icloud.com", "icoud.com": "icloud.com", "icloud.con": "icloud.com", "live.con": "live.com", "uol.com": "uol.com.br", "bol.com": "bol.com.br", "terra.com": "terra.com.br",
};
const POPULAR = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "yahoo.com", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "hotmail.com.br", "outlook.com.br"];

function distance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]++;
    for (let j = 1; j <= right.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[right.length];
}

/** Sugestão para um provedor digitado errado ("ana@gmial.com" → "ana@gmail.com"), ou null. */
export function suggestEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain || POPULAR.includes(domain)) return null;
  const fixed = DOMAIN_FIXES[domain] ?? POPULAR.find((item) => distance(domain, item) === 1) ?? null;
  return fixed ? `${localPart}@${fixed}` : null;
}

/** Limpa o que a pessoa digitou no e-mail: espaços, maiúsculas e vírgula no lugar de ponto. */
export function cleanEmail(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".").replace(/\.{2,}/g, ".").replace(/\.$/, "");
}

/** E-mail descartável, com nome aleatório ou de domínio que não recebe e-mails. */
export async function suspiciousEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return true;
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((item) => domain.endsWith(`.${item}`))) return true;
  const words = localPart.split(/[._+-]+/).filter((part) => /[a-z]/i.test(part));
  if (words.some((word) => PLACEHOLDER_WORDS.has(plain(word).replace(/\d+/g, "")) || looksRandom(word.replace(/\d+/g, "")))) return true;
  // O domínio precisa receber e-mails. Falha de rede ou demora não bloqueia (só domínio inexistente).
  try {
    const records = await Promise.race([resolveMx(domain), new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500))]);
    return records !== null && records.length === 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === "ENOTFOUND" || code === "ENODATA" || code === "ESERVFAIL" || code === "NXDOMAIN";
  }
}
