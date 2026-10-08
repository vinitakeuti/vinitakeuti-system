import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { listServiceCategories } from "@/features/services/queries/service-catalog-queries";
import { createServiceCategory } from "@/features/services/services/service-catalog-actions";

export const dynamic = "force-dynamic";

export default async function ServiceCategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
  const [{ error, created }, categories] = await Promise.all([searchParams, listServiceCategories()]);
  return <main className="app-shell"><AppSidebar current="services" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">SERVIÇOS / ORGANIZAÇÃO</p><h1>Categorias.</h1><p>Separe o catálogo por áreas como sistemas, sites, tráfego, infraestrutura e suporte.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/servicos">VOLTAR PARA SERVIÇOS</Link></div></header>
    <section className="directory-surface categories-surface"><form className="category-form" action={createServiceCategory}><div className="category-form-heading"><div><p className="eyebrow">NOVA CATEGORIA</p><p>Crie áreas para manter serviços, preços e recorrências organizados.</p></div></div>{error ? <p className="form-error" role="alert">{error}</p> : null}{created ? <p className="form-success">Categoria criada.</p> : null}<div className="category-form-grid"><label><span>Nome da categoria</span><input name="name" required maxLength={80} placeholder="Ex.: Infraestrutura e cloud" /></label><label><span>Descrição</span><input name="description" maxLength={280} placeholder="Referência interna opcional" /></label><label className="category-order"><span>Ordem</span><input name="sortOrder" type="number" min="0" defaultValue="0" /></label><button className="primary-action" type="submit">CRIAR CATEGORIA</button></div></form><section className="category-list"><div className="category-list-heading"><p className="eyebrow">CATEGORIAS CADASTRADAS</p><span>{categories.length} {categories.length === 1 ? "categoria" : "categorias"}</span></div>{categories.length ? <div className="table-scroll category-table"><table><thead><tr><th>CATEGORIA</th><th>DESCRIÇÃO</th><th>SERVIÇOS</th><th>ESTADO</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><b>{category.name}</b></td><td>{category.description ?? "—"}</td><td>{category._count.services}</td><td>{category.isActive ? "Ativa" : "Arquivada"}</td></tr>)}</tbody></table></div> : <div className="category-empty"><p>Nenhuma categoria cadastrada.</p><span>Use o formulário acima para criar a primeira área do catálogo.</span></div>}</section></section>
  </section></div></main>;
}
