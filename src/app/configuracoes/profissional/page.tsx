import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PhoneInput } from "@/features/clients/components/phone-input";
import { DocumentInput } from "@/features/professional-profile/components/document-input";
import { saveProfessionalProfile } from "@/features/professional-profile/services/professional-profile-actions";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";

export const dynamic = "force-dynamic";

export default async function ProfessionalProfilePage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const { salvo } = await searchParams;
  const profile = await getProfessionalProfile();

  return <main className="app-shell"><AppSidebar current="identity" /><div className="workspace"><section className="directory-page form-page"><header className="directory-header"><div><p className="eyebrow">CONFIGURAÇÕES / IDENTIDADE</p><h1>Perfil profissional.</h1><p>Seus dados de identificação e contato aparecem no cabeçalho dos orçamentos em PDF.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/orcamentos">VOLTAR</Link></div></header>
    <form className="client-form professional-profile-form" action={saveProfessionalProfile}>
      {salvo === "1" ? <p className="professional-save-confirmation" role="status" aria-live="polite"><span aria-hidden="true">✓</span>Identificação salva.</p> : null}
      <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Nome profissional<input name="name" required maxLength={160} defaultValue={profile?.name ?? "Vinicius Riudi"} autoComplete="name" /></label><label>Profissão ou especialidade<input name="professionalTitle" maxLength={120} defaultValue={profile?.professionalTitle ?? ""} placeholder="Ex.: Desenvolvedor de software" /></label><label>CPF ou CNPJ<DocumentInput defaultValue={profile?.document ?? ""} /></label><label>Site ou portfólio<input name="website" type="url" maxLength={200} defaultValue={profile?.website ?? ""} placeholder="https://" autoComplete="url" /></label></div></section>
      <section><p className="eyebrow">CONTATO</p><div className="form-grid"><label>E-mail profissional<input name="email" type="email" maxLength={254} defaultValue={profile?.email ?? ""} autoComplete="email" /></label><label>Telefone de contato<PhoneInput defaultValue={profile?.phone ?? ""} /></label><label className="form-wide">Endereço<input name="address" maxLength={240} defaultValue={profile?.address ?? ""} autoComplete="street-address" /></label><label>Cidade<input name="city" maxLength={120} defaultValue={profile?.city ?? ""} autoComplete="address-level2" /></label><label>Estado<input name="state" maxLength={80} defaultValue={profile?.state ?? ""} autoComplete="address-level1" /></label></div></section>
      <div className="form-actions"><span className="professional-profile-note">A logo oficial VR será incluída automaticamente no cabeçalho do PDF.</span><button className="primary-action" type="submit">SALVAR IDENTIFICAÇÃO</button></div>
    </form></section></div></main>;
}
