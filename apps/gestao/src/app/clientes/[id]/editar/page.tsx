import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { updateClient } from "@/features/clients/services/client-actions";
import { ClientForm } from "@/features/clients/components/client-form";
import { getClientForEdit } from "@/features/clients/queries/client-queries";

export const dynamic = "force-dynamic";

type EditClientPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function EditClientPage({ params, searchParams }: EditClientPageProps) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const client = await getClientForEdit(id);
  if (!client) notFound();
  const profileHref = `/clientes/${client.id}`;
  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page form-page">
      <header className="directory-header"><div><p className="eyebrow">CLIENTES / EDITAR CADASTRO</p><h1>{client.name}</h1><p>As alterações valem para os próximos documentos e PDFs gerados para este cliente.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={profileHref}>VOLTAR PARA O PERFIL</Link></div></header>
      <ClientForm action={updateClient} values={client} error={error} cancelHref={profileHref} submitLabel="SALVAR CADASTRO" />
    </section></div></main>
  );
}
