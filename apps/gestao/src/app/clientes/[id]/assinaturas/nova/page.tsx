import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { RecurringServiceFields } from "@/features/services/components/recurring-service-fields";
import { getClientForRecurringService, getRecurringServiceOptions } from "@/features/services/queries/service-catalog-queries";
import { assignRecurringService } from "@/features/services/services/service-catalog-actions";

export const dynamic = "force-dynamic";

export default async function NewClientSubscriptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const [{ error }, client, services] = await Promise.all([searchParams, getClientForRecurringService(id), getRecurringServiceOptions()]);
  if (!client) notFound();
  const returnHref = `/clientes/${client.id}?section=subscriptions`;
  return <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">CLIENTE / RECORRÊNCIA</p><h1>Atribuir serviço.</h1><p>{client.name}{client.company ? ` · ${client.company}` : ""}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={returnHref}>VOLTAR PARA ASSINATURAS</Link></div></header>
    {!services.length ? <section className="directory-surface"><div className="directory-empty"><p>Nenhum serviço recorrente disponível.</p><span>Cadastre no catálogo um serviço com modelo de cobrança recorrente antes de atribuí-lo ao cliente.</span><Link className="text-link" href="/servicos/novo">CRIAR SERVIÇO RECORRENTE</Link></div></section> : <form className="client-form" action={assignRecurringService}><input type="hidden" name="clientId" value={id} />{error ? <p className="form-error" role="alert">{error}</p> : null}<section><p className="eyebrow">SERVIÇO E COBRANÇA</p><RecurringServiceFields services={services} /></section><div className="form-actions"><Link className="text-link" href={returnHref}>CANCELAR</Link><button className="primary-action" type="submit">ATRIBUIR SERVIÇO</button></div></form>}
  </section></div></main>;
}
