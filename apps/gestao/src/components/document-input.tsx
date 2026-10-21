"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { formatCnpj, formatCpf, formatCpfOrCnpj, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/br-documents";

type DocumentKind = "cpf" | "cnpj" | "any";

const formatters: Record<DocumentKind, (value: string) => string> = { cpf: formatCpf, cnpj: formatCnpj, any: formatCpfOrCnpj };
const placeholders: Record<DocumentKind, string> = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", any: "CPF ou CNPJ" };
const maxLengths: Record<DocumentKind, number> = { cpf: 14, cnpj: 18, any: 18 };

/** Mensagem do navegador para CPF ou CNPJ incompleto ou com dígitos verificadores errados (vazio é permitido). */
function validityMessage(kind: DocumentKind, value: string) {
  const digits = onlyDigits(value);
  if (!digits || kind === "any") return "";
  const label = kind === "cpf" ? "CPF" : "CNPJ";
  const length = kind === "cpf" ? 11 : 14;
  if (digits.length < length) return `${label} incompleto: informe os ${length} dígitos.`;
  return (kind === "cpf" ? isValidCpf(digits) : isValidCnpj(digits)) ? "" : `${label} inválido. Confira os números.`;
}

function cursorPosition(value: string, digitCount: number) {
  if (digitCount === 0) return 0;
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) count += 1;
    if (count === digitCount) return index + 1;
  }
  return value.length;
}

/** Campo de CPF e/ou CNPJ com a máscara aplicada durante a digitação, mantendo o cursor no lugar. */
export function DocumentInput({ name = "document", kind = "any", defaultValue = "", placeholder, ariaLabel }: { name?: string; kind?: DocumentKind; defaultValue?: string | null; placeholder?: string; ariaLabel?: string }) {
  const format = formatters[kind];
  const [value, setValue] = useState(() => format(defaultValue ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.setCustomValidity(validityMessage(kind, value)); }, [kind, value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value;
    const digitsBeforeCursor = raw.slice(0, event.currentTarget.selectionStart ?? raw.length).replace(/\D/g, "").length;
    const formatted = format(raw);
    setValue(formatted);
    requestAnimationFrame(() => {
      const position = cursorPosition(formatted, Math.min(digitsBeforeCursor, formatted.replace(/\D/g, "").length));
      inputRef.current?.setSelectionRange(position, position);
    });
  }

  return <input ref={inputRef} name={name} type="text" inputMode="numeric" autoComplete="off" maxLength={maxLengths[kind]} value={value} onChange={handleChange} placeholder={placeholder ?? placeholders[kind]} aria-label={ariaLabel} />;
}
