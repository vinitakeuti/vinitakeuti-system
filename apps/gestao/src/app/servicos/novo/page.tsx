import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { CatalogServiceCommercialFields } from "@/features/services/components/catalog-service-commercial-fields";
import { ServiceProposalEditor } from "@/features/services/components/service-proposal-editor";
import { listServiceCategories } from "@/features/services/queries/service-catalog-queries";
import { createCatalogService } from "@/features/services/services/service-catalog-actions";

export const dynamic = "force-dynamic";

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, categories] = await Promise.all([searchParams, listServiceCategories()]);
  const activeCategories = categories.filter((category) => category.isActive);

  return <main className="app-shell"><AppSidebar current="services" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">SERVIÇOS / CATÁLOGO</p><h1>Novo serviço.</h1><p>Defina um padrão de cobrança que poderá ser reaproveitado nos orçamentos e recorrências.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/servicos">VOLTAR PARA SERVIÇOS</Link></div></header>
    {!activeCategories.length ? <section className="directory-surface"><div className="directory-empty"><p>Crie uma categoria antes de cadastrar o serviço.</p><span>As categorias organizam o catálogo para que ele continue legível com muitos serviços.</span><Link className="text-link" href="/servicos/categorias">CRIAR CATEGORIA</Link></div></section> : <form className="client-form service-catalog-form" action={createCatalogService}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Categoria<select name="categoryId" required defaultValue=""><option value="" disabled>Selecione uma categoria</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Nome do serviço<input name="name" required maxLength={140} placeholder="Ex.: Landing page institucional" /></label><label className="form-wide">Descrição breve do catálogo<textarea name="description" maxLength={2000} placeholder="Resumo interno para reconhecer este serviço na lista." /></label><div className="form-wide service-proposal-field"><span>Descrição na proposta</span><ServiceProposalEditor name="proposalText" /><small>Opcional. Use negrito, listas e formatação para definir exatamente o texto que entrará no PDF quando este serviço for selecionado.</small></div></div></section>
      <CatalogServiceCommercialFields />
      <div className="form-actions"><Link className="text-link" href="/servicos">CANCELAR</Link><button className="primary-action" type="submit">CRIAR SERVIÇO</button></div>
    </form>}
  </section></div></main>;
}
