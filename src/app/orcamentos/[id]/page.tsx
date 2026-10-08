import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const pricingLabel = { FIXED: "valor fechado", HOURLY: "por hora", DAILY: "por dia", CUSTOM: "valor definido na proposta" } as const;

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteForPdf(id);
  if (!quote) notFound();
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-detail-page"><header className="directory-header"><div><p className="eyebrow">ORÇAMENTO / RASCUNHO</p><h1>{quote.title}</h1><p>{quote.code} · {quote.client.name}</p></div><div className="header-actions quote-header-actions"><SidebarToggle location="header" /><div className="quote-detail-actions"><Link className="text-link" href={`/orcamentos/${quote.id}/editor`}>ABRIR EDITOR PDF</Link><a className="primary-action" href={`/api/orcamentos/${quote.id}/pdf`}>GERAR PDF</a><Link className="text-link" href="/vendas">VOLTAR PARA VENDAS</Link></div></div></header><section className="profile-surface quote-detail quote-detail-surface"><div className="profile-overview"><div className="profile-identity"><p className="eyebrow">CLIENTE</p><strong>{quote.client.name}</strong><span>{quote.client.company ?? quote.client.email ?? "Perfil de cliente"}</span><small>EMITIDO EM {date.format(quote.createdAt).toUpperCase()}</small></div><div className="profile-stat"><span>ESTIMATIVA</span><b>{quote.validUntil ? date.format(quote.validUntil) : "A definir"}</b></div><div className="profile-stat"><span>INVESTIMENTO</span><b>{money.format(quote.amountCents / 100)}</b></div></div><div className="profile-section"><div className="quote-detail-toolbar"><Link className="text-link" href={`/orcamentos/${quote.id}/editar`}>AJUSTAR SERVIÇOS E VALORES</Link><Link className="text-link" href="/orcamentos/texto-padrao">TEXTO PADRÃO</Link></div>{quote.items.length ? <div className="quote-detail-services"><p className="eyebrow">SERVIÇOS ORÇADOS</p>{quote.items.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.categoryName} · {pricingLabel[item.pricingMethod]} · {item.quantity} {item.pricingMethod === "HOURLY" ? "h" : item.pricingMethod === "DAILY" ? "dias" : item.quantity === 1 ? "unidade" : "unidades"}{item.billingType === "RECURRING" ? ` · ${item.billingCycle === "YEARLY" ? "anual" : item.billingCycle === "QUARTERLY" ? "trimestral" : item.billingCycle === "SEMIANNUAL" ? "semestral" : "mensal"}` : ""}</small></span><strong>{money.format(item.totalAmountCents / 100)}</strong></div>)}</div> : null}{quote.terms ? <><div className="address-line"><dt>Condições comerciais</dt><dd>{quote.terms}</dd></div></> : null}</div></section></section></div></main>;
}
