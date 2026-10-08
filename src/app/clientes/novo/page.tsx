import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { createClient } from "@/features/clients/services/client-actions";
import { PhoneInput } from "@/features/clients/components/phone-input";

export const dynamic = "force-dynamic";

type NewClientPageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewClientPage({ searchParams }: NewClientPageProps) {
  const { error } = await searchParams;
  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page form-page">
      <header className="directory-header"><div><p className="eyebrow">CLIENTES / NOVO PERFIL</p><h1>Cadastrar cliente.</h1><p>Os dados abaixo formarão a base de orçamentos, contratos, serviços e cobranças.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/clientes">VOLTAR PARA CLIENTES</Link></div></header>
      <form className="client-form" action={createClient}>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Nome completo ou razão social<input name="name" required maxLength={160} autoComplete="name" /></label><label>Empresa<input name="company" maxLength={160} autoComplete="organization" /></label><label>CPF ou CNPJ<input name="document" maxLength={32} /></label></div></section>
        <section><p className="eyebrow">CONTATO</p><div className="form-grid"><label>E-mail<input name="email" type="email" maxLength={254} autoComplete="email" /></label><label>Telefone<PhoneInput /></label><label>Cidade<input name="city" maxLength={120} autoComplete="address-level2" /></label><label className="form-wide">Endereço<input name="address" maxLength={500} autoComplete="street-address" /></label></div></section>
        <section><p className="eyebrow">CONTEXTO</p><label>Observações<textarea name="notes" maxLength={4000} /></label></section>
        <div className="form-actions"><Link className="text-link" href="/clientes">CANCELAR</Link><button className="primary-action" type="submit">CRIAR PERFIL</button></div>
      </form>
    </section></div></main>
  );
}
