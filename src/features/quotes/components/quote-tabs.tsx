import Link from "next/link";
import { countPendingQuotes } from "@/features/quotes/queries/quote-queries";

/** Abas da área de orçamentos: início do fluxo e propostas que ainda não foram concluídas. */
export async function QuoteTabs({ current }: { current: "start" | "pending" }) {
  const pendingCount = await countPendingQuotes();
  return <nav className="profile-nav quote-tabs" aria-label="Seções de orçamentos">
    <Link className={current === "start" ? "active" : undefined} aria-current={current === "start" ? "page" : undefined} href="/orcamentos"><span>Novo orçamento</span></Link>
    <Link className={current === "pending" ? "active" : undefined} aria-current={current === "pending" ? "page" : undefined} href="/orcamentos/pendentes"><span>Pendentes de conclusão</span><b>{pendingCount}</b></Link>
  </nav>;
}
