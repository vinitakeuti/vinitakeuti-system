import type { JsonSchema } from "@/lib/integrations/ai/types";

/**
 * Esquema das entradas das ferramentas: o mesmo objeto gera o JSON Schema enviado ao modelo e valida o que ele
 * mandar de volta. A IA erra campos às vezes; a validação devolve um erro claro para ela corrigir e tentar de novo.
 */

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

export type Field<T> = { json: JsonSchema; optional: boolean; parse(value: unknown, path: string): T };

type Options = { description?: string };

function field<T>(json: JsonSchema, parse: (value: unknown, path: string) => T): Field<T> {
  return { json, optional: false, parse };
}

export const s = {
  string(options: Options & { min?: number; max: number; pattern?: RegExp }) {
    return field<string>({ type: "string", description: options.description, ...(options.min ? { minLength: options.min } : {}), maxLength: options.max }, (value, path) => {
      if (typeof value !== "string") throw new ToolInputError(`${path}: informe um texto.`);
      const text = value.trim();
      if (options.min && text.length < options.min) throw new ToolInputError(`${path}: texto muito curto.`);
      if (options.pattern && !options.pattern.test(text)) throw new ToolInputError(`${path}: formato inválido.`);
      return text.slice(0, options.max);
    });
  },
  /** Texto longo (Markdown de um documento): preserva quebras de linha. */
  longText(options: Options & { max: number }) {
    return field<string>({ type: "string", description: options.description, maxLength: options.max }, (value, path) => {
      if (typeof value !== "string" || !value.trim()) throw new ToolInputError(`${path}: informe o texto.`);
      if (value.length > options.max) throw new ToolInputError(`${path}: texto acima de ${options.max} caracteres.`);
      return value.replace(/\r\n?/g, "\n");
    });
  },
  integer(options: Options & { min?: number; max?: number }) {
    return field<number>({ type: "integer", description: options.description, ...(options.min !== undefined ? { minimum: options.min } : {}), ...(options.max !== undefined ? { maximum: options.max } : {}) }, (value, path) => {
      const number = typeof value === "string" ? Number(value) : value;
      if (typeof number !== "number" || !Number.isInteger(number)) throw new ToolInputError(`${path}: informe um número inteiro.`);
      if ((options.min !== undefined && number < options.min) || (options.max !== undefined && number > options.max)) throw new ToolInputError(`${path}: fora do intervalo permitido.`);
      return number;
    });
  },
  /** Valor em reais (número com até 2 casas), devolvido em centavos. */
  money(options: Options = {}) {
    return field<number>({ type: "number", description: `${options.description ?? "Valor"} em reais, como número (ex.: 1250.5).`, minimum: 0.01 }, (value, path) => {
      const number = typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : value;
      if (typeof number !== "number" || !Number.isFinite(number) || number <= 0 || number > 100_000_000) throw new ToolInputError(`${path}: informe um valor em reais maior que zero.`);
      return Math.round(number * 100);
    });
  },
  boolean(options: Options = {}) {
    return field<boolean>({ type: "boolean", description: options.description }, (value, path) => {
      if (typeof value !== "boolean") throw new ToolInputError(`${path}: informe true ou false.`);
      return value;
    });
  },
  /** Data AAAA-MM-DD. */
  date(options: Options = {}) {
    return field<string>({ type: "string", description: `${options.description ?? "Data"} no formato AAAA-MM-DD.`, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, (value, path) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())) throw new ToolInputError(`${path}: use uma data no formato AAAA-MM-DD.`);
      return value;
    });
  },
  enum<const T extends string>(values: readonly T[], options: Options = {}) {
    return field<T>({ type: "string", description: options.description, enum: values }, (value, path) => {
      if (typeof value !== "string" || !values.includes(value as T)) throw new ToolInputError(`${path}: use um destes valores: ${values.join(", ")}.`);
      return value as T;
    });
  },
  id(options: Options = {}) {
    return s.string({ ...options, min: 1, max: 50, pattern: /^[A-Za-z0-9_-]+$/ });
  },
  /** Número com casas decimais (percentual, por exemplo). */
  decimal(options: Options & { min: number; max: number }) {
    return field<number>({ type: "number", description: options.description, minimum: options.min, maximum: options.max }, (value, path) => {
      const number = typeof value === "string" ? Number(value.replace(",", ".")) : value;
      if (typeof number !== "number" || !Number.isFinite(number) || number < options.min || number > options.max) throw new ToolInputError(`${path}: informe um número entre ${options.min} e ${options.max}.`);
      return number;
    });
  },
  /** Lista de objetos (itens de um orçamento, por exemplo). */
  list<T>(item: ObjectSchema<T>, options: Options & { min?: number; max: number }) {
    return field<T[]>({ type: "array", description: options.description, items: item.json }, (value, path) => {
      if (!Array.isArray(value)) throw new ToolInputError(`${path}: informe uma lista.`);
      if (value.length < (options.min ?? 0) || value.length > options.max) throw new ToolInputError(`${path}: de ${options.min ?? 0} a ${options.max} itens.`);
      return value.map((entry, index) => {
        try { return item.parse(entry); }
        catch (error) { throw error instanceof ToolInputError ? new ToolInputError(`${path}[${index}].${error.message}`) : error; }
      });
    });
  },
  optional<T>(inner: Field<T>): Field<T | undefined> {
    return { json: inner.json, optional: true, parse: (value, path) => value === undefined || value === null || value === "" ? undefined : inner.parse(value, path) };
  },
};

type Shape = Record<string, Field<unknown>>;
export type InputOf<S extends Shape> = { [K in keyof S]: S[K] extends Field<infer T> ? T : never };

export type ObjectSchema<T> = { json: JsonSchema; parse(value: unknown): T };

export function object<S extends Shape>(shape: S): ObjectSchema<InputOf<S>> {
  const entries = Object.entries(shape);
  return {
    json: { type: "object", properties: Object.fromEntries(entries.map(([key, item]) => [key, item.json])), required: entries.filter(([, item]) => !item.optional).map(([key]) => key), additionalProperties: false },
    parse(value) {
      const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      return Object.fromEntries(entries.map(([key, item]) => [key, item.parse(input[key], key)])) as InputOf<S>;
    },
  };
}
