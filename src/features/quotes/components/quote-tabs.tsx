import Link from "next/link";
import { countPendingQuotes } from "@/features/quotes/queries/quote-queries";

/** Abas da área de documentos: produção dos documentos e propostas que ainda não foram concluídas. */
export async function QuoteTabs({ current }: { current: "start" | "pending" }) {
  const pendingCount = await countPendingQuotes();
  return <nav className="profile-nav quote-tabs" aria-label="Seções de documentos">
    <Link className={current === "start" ? "active" : undefined} aria-current={current === "start" ? "page" : undefined} href="/documentos"><span>Documentos</span></Link>
    <Link className={current === "pending" ? "active" : undefined} aria-current={current === "pending" ? "page" : undefined} href="/orcamentos/pendentes"><span>Propostas pendentes</span><b>{pendingCount}</b></Link>
  </nav>;
}
