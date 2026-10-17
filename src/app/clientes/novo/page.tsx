import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { createClient } from "@/features/clients/services/client-actions";
import { ClientForm } from "@/features/clients/components/client-form";

export const dynamic = "force-dynamic";

type NewClientPageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewClientPage({ searchParams }: NewClientPageProps) {
  const { error } = await searchParams;
  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page form-page">
      <header className="directory-header"><div><p className="eyebrow">CLIENTES / NOVO PERFIL</p><h1>Cadastrar cliente.</h1><p>Os dados abaixo formarão a base de orçamentos, contratos, serviços e cobranças.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/clientes">VOLTAR PARA CLIENTES</Link></div></header>
      <ClientForm action={createClient} error={error} cancelHref="/clientes" submitLabel="CRIAR PERFIL" />
    </section></div></main>
  );
}
