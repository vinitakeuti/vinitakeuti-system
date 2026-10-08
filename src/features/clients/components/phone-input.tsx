"use client";

import { useState } from "react";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${areaCode}) ${number}`;

  const prefixLength = number.length > 8 ? 5 : 4;
  return `(${areaCode}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}

export function PhoneInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(() => formatPhone(defaultValue));

  return <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={15} value={value} onChange={(event) => setValue(formatPhone(event.target.value))} placeholder="(00) 00000-0000" />;
}
