"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

function formatCpf(digits: string) {
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 6);
  const third = digits.slice(6, 9);
  const check = digits.slice(9, 11);
  return [first, second && `.${second}`, third && `.${third}`, check && `-${check}`].filter(Boolean).join("");
}

function formatCnpj(digits: string) {
  const first = digits.slice(0, 2);
  const second = digits.slice(2, 5);
  const third = digits.slice(5, 8);
  const branch = digits.slice(8, 12);
  const check = digits.slice(12, 14);
  return [first, second && `.${second}`, third && `.${third}`, branch && `/${branch}`, check && `-${check}`].filter(Boolean).join("");
}

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
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

export function DocumentInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(() => formatDocument(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value;
    const digitsBeforeCursor = raw.slice(0, event.currentTarget.selectionStart ?? raw.length).replace(/\D/g, "").length;
    const formatted = formatDocument(raw);
    setValue(formatted);
    requestAnimationFrame(() => {
      const position = cursorPosition(formatted, Math.min(digitsBeforeCursor, formatted.replace(/\D/g, "").length));
      inputRef.current?.setSelectionRange(position, position);
    });
  }

  return <input ref={inputRef} name="document" type="text" inputMode="numeric" autoComplete="off" maxLength={18} value={value} onChange={handleChange} placeholder="CPF ou CNPJ" />;
}
