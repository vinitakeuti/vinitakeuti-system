"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Enquanto a Eliza trabalha, recarrega os dados da tela a cada poucos segundos (sem recarregar a página). */
export function JobRefresher({ everyMs = 4_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
