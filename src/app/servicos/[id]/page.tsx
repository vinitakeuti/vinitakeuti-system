import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { CatalogServiceCommercialFields } from "@/features/services/components/catalog-service-commercial-fields";
import { DeleteServiceButton } from "@/features/services/components/delete-service-button";
import { ServiceProposalEditor } from "@/features/services/components/service-proposal-editor";
import { getCatalogService, listServiceCategories } from "@/features/services/queries/service-catalog-queries";
import { archiveCatalogService, deleteCatalogService, updateCatalogService } from "@/features/services/services/service-catalog-actions";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { id } = await params;
  const [{ error, updated }, service, categories] = await Promise.all([searchParams, getCatalogService(id), listServiceCategories()]);
  if (!service) notFound();
  const selectableCategories = categories.filter((category) => category.isActive || category.id === service.categoryId);
  const hasSubscriptions = service._count.subscriptions > 0;
  const hasQuoteHistory = service._count.quoteItems > 0;

  return <main className="app-shell"><AppSidebar current="services" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">SERVIÇOS / CATÁLOGO</p><h1>Editar serviço.</h1><p>{service.name} · {service.category.name}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/servicos">VOLTAR PARA SERVIÇOS</Link></div></header>
    <form className="client-form service-catalog-form" action={updateCatalogService}><input type="hidden" name="serviceId" value={service.id} />{error ? <p className="form-error" role="alert">{error}</p> : null}{updated ? <p className="form-success">Alterações salvas.</p> : null}
      <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Categoria<select name="categoryId" required defaultValue={service.categoryId}>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Nome do serviço<input name="name" required maxLength={140} defaultValue={service.name} /></label><label className="form-wide">Descrição breve do catálogo<textarea name="description" maxLength={2000} defaultValue={service.description ?? ""} /></label><div className="form-wide service-proposal-field"><span>Descrição na proposta</span><ServiceProposalEditor name="proposalText" initialValue={service.proposalText} /><small>Opcional. A formatação será copiada para os novos orçamentos que incluírem este serviço.</small></div></div></section>
      <CatalogServiceCommercialFields defaultBillingType={service.billingType} defaultPricingMethod={service.pricingMethod} defaultAmountCents={service.defaultAmountCents} defaultBillingCycle={service.billingCycle} />
      <div className="form-actions"><Link className="text-link" href="/servicos">CANCELAR</Link><button className="primary-action" type="submit">SALVAR ALTERAÇÕES</button></div>
    </form>
    <section className="service-record-actions"><div><p className="eyebrow">GESTÃO DO REGISTRO</p><p>{hasSubscriptions ? "Este serviço possui assinaturas vinculadas. Arquive-o para retirá-lo das novas seleções sem alterar os clientes ativos." : hasQuoteHistory ? "Este serviço aparece em orçamentos anteriores. Você pode excluí-lo: as linhas antigas continuarão preservadas como histórico comercial." : "Este serviço ainda não possui histórico. Você pode arquivá-lo ou excluí-lo definitivamente."}</p></div><div className="service-record-buttons"><form action={archiveCatalogService}><input type="hidden" name="serviceId" value={service.id} /><button className="secondary-action" type="submit">ARQUIVAR SERVIÇO</button></form>{!hasSubscriptions ? <DeleteServiceButton serviceId={service.id} action={deleteCatalogService} /> : null}</div></section>
  </section></div></main>;
}
