import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { listCatalogServices, listServiceCategories } from "@/features/services/queries/service-catalog-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const billingType = { ONE_TIME: "Avulso", RECURRING: "Recorrente" } as const;
const pricingMethod = { FIXED: "Valor fechado", HOURLY: "Por hora", DAILY: "Por dia", CUSTOM: "Definir no orçamento" } as const;
const cycle = { MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMIANNUAL: "Semestral", YEARLY: "Anual" } as Record<string, string>;

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ cursor?: string; q?: string; category?: string }> }) {
  const { cursor, q, category } = await searchParams;
  const [categories, { data, nextCursor }] = await Promise.all([
    listServiceCategories(),
    listCatalogServices({ cursor, query: q, categoryId: category }),
  ]);
  const nextHref = nextCursor ? `/servicos?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), cursor: nextCursor })}` : null;
  const groups = data.reduce<Array<{ id: string; name: string; services: typeof data }>>((result, service) => {
    const current = result.at(-1);
    if (!current || current.id !== service.category.id) result.push({ id: service.category.id, name: service.category.name, services: [service] });
    else current.services.push(service);
    return result;
  }, []);

  return <main className="app-shell"><AppSidebar current="services" /><div className="workspace"><section className="directory-page">
    <header className="directory-header"><div><p className="eyebrow">Operação / Catálogo</p><h1>Serviços.</h1><p>Base organizada para precificar entregas, manter ofertas recorrentes e atribuir serviços aos clientes.</p></div><div className="header-actions service-header-actions"><SidebarToggle location="header" /><div className="service-header-creation-actions"><Link className="text-link" href="/servicos/categorias">Categorias</Link><Link className="primary-action" href="/servicos/novo">Novo serviço</Link></div></div></header>
    <section className="directory-surface service-directory-surface" aria-label="Catálogo de serviços">
      <form className="client-search service-search" action="/servicos"><div className="search-control"><label htmlFor="service-query">Buscar serviço</label><input id="service-query" name="q" defaultValue={q ?? ""} placeholder="Nome ou descrição" /></div><label className="service-category-filter">Categoria<select name="category" defaultValue={category ?? ""}><option value="">Todas as categorias</option>{categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit">Filtrar</button></form>
      {data.length ? <div className="table-scroll service-table service-grouped-table"><table><colgroup><col className="service-col-name" /><col className="service-col-billing" /><col className="service-col-price" /><col className="service-col-clients" /></colgroup><thead><tr><th>Serviço</th><th>Cobrança</th><th>Referência</th><th>Clientes ativos</th></tr></thead>{groups.map((group) => <tbody key={group.id}><tr className="service-category-row"><td colSpan={4}><div><span>Categoria</span><strong>{group.name}</strong></div></td></tr>{group.services.map((service) => <tr key={service.id}><td><Link className="client-name" href={`/servicos/${service.id}`}>{service.name}</Link><small>{service.description ?? "Sem descrição cadastrada"}</small></td><td><span>{billingType[service.billingType]}</span><small>{pricingMethod[service.pricingMethod]}</small></td><td><span>{service.defaultAmountCents ? money.format(service.defaultAmountCents / 100) : "A definir"}</span><small>{service.billingType === "RECURRING" ? cycle[service.billingCycle ?? "MONTHLY"] ?? service.billingCycle : service.pricingMethod === "HOURLY" ? "Taxa por hora" : service.pricingMethod === "DAILY" ? "Taxa por dia" : service.pricingMethod === "CUSTOM" ? "Definida na proposta" : "Valor fechado do serviço"}</small></td><td>{service._count.subscriptions}</td></tr>)}</tbody>)}</table></div> : <div className="directory-empty"><p>Nenhum serviço cadastrado.</p><span>Comece por uma categoria e crie as referências de preço que serão reutilizadas nos seus processos.</span><Link className="text-link" href={categories.length ? "/servicos/novo" : "/servicos/categorias"}>{categories.length ? "Criar serviço" : "Criar categoria"}</Link></div>}
      {nextHref ? <div className="table-footer"><Link className="text-link" href={nextHref}>Carregar próximos 50</Link></div> : null}
    </section>
  </section></div></main>;
}
