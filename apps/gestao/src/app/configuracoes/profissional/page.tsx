import { BRAND_TITLE } from "@/features/professional-profile/types/brand";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PhoneInput } from "@/features/clients/components/phone-input";
import { DocumentInput } from "@/components/document-input";
import { removeSignatureAction, saveProfessionalProfile, saveSignatureAction } from "@/features/professional-profile/services/professional-profile-actions";
import { SignaturePreview } from "@/features/professional-profile/components/signature-preview";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { DEFAULT_PROFESSIONAL, getProfessionalProfile, getProfessionalSignature } from "@/features/professional-profile/queries/professional-profile-queries";

export const dynamic = "force-dynamic";

const signatureNotices: Record<string, { text: string; error?: boolean }> = {
  salva: { text: "Assinatura salva. Ela já aparece nos próximos PDFs gerados." },
  removida: { text: "Assinatura removida dos documentos." },
  arquivo: { text: "Escolha o arquivo SVG da assinatura.", error: true },
  grande: { text: "O arquivo deve ter até 300 KB.", error: true },
  invalida: { text: "Não encontramos traços de assinatura neste arquivo. Envie um SVG com o desenho em caminhos (path).", error: true },
};

export default async function ProfessionalProfilePage({ searchParams }: { searchParams: Promise<{ salvo?: string; assinatura?: string }> }) {
  const { salvo, assinatura } = await searchParams;
  const [profile, signature] = await Promise.all([getProfessionalProfile(), getProfessionalSignature()]);
  const signatureNotice = assinatura ? signatureNotices[assinatura] : null;

  return <main className="app-shell"><AppSidebar current="identity" /><div className="workspace"><section className="directory-page form-page"><header className="directory-header"><div><p className="eyebrow">CONFIGURAÇÕES / IDENTIDADE</p><h1>Perfil profissional.</h1><p>Seus dados de identificação e contato aparecem no cabeçalho dos orçamentos em PDF.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/orcamentos">VOLTAR</Link></div></header>
    <form className="client-form professional-profile-form" action={saveProfessionalProfile}>
      {salvo === "1" ? <p className="professional-save-confirmation" role="status" aria-live="polite"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>Identificação salva.</p> : null}
      <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Nome profissional<input name="name" required maxLength={160} defaultValue={profile?.name ?? "Vinicius Riudi"} autoComplete="name" /></label><label>Título nos documentos<input value={BRAND_TITLE} disabled readOnly /><small>O mesmo título da marca na barra lateral. Aparece na capa, no cabeçalho das páginas e na folha final de todos os PDFs.</small></label><label>CPF ou CNPJ<DocumentInput defaultValue={profile?.document || DEFAULT_PROFESSIONAL.document} /></label><label>Site ou portfólio<input name="website" type="url" maxLength={200} defaultValue={profile?.website ?? ""} placeholder="https://" autoComplete="url" /></label></div></section>
      <section><p className="eyebrow">CONTATO</p><div className="form-grid"><label>E-mail profissional<input name="email" type="email" maxLength={254} defaultValue={profile?.email ?? ""} autoComplete="email" /></label><label>Telefone de contato<PhoneInput defaultValue={profile?.phone ?? ""} /></label><label className="form-wide">Endereço<input name="address" maxLength={240} defaultValue={profile?.address ?? ""} autoComplete="street-address" /></label><label>Cidade<input name="city" maxLength={120} defaultValue={profile?.city ?? ""} autoComplete="address-level2" /></label><label>Estado<input name="state" maxLength={80} defaultValue={profile?.state ?? ""} autoComplete="address-level1" /></label></div></section>
      <section><p className="eyebrow">PAGAMENTO NO PORTAL DO CLIENTE</p><div className="form-grid"><label>Chave Pix<input name="pixKey" maxLength={140} defaultValue={profile?.pixKey ?? ""} placeholder="E-mail, telefone, CPF, CNPJ ou chave aleatória" /><small>Só aparece na área do cliente enquanto o Asaas não estiver conectado em Integrações. Com o Asaas, o cliente paga pela fatura e a confirmação é automática.</small></label><label className="form-wide">Instruções de pagamento<textarea name="paymentInstructions" maxLength={1000} rows={3} defaultValue={profile?.paymentInstructions ?? ""} placeholder="Favorecido, banco e o que fazer depois de pagar." /></label></div></section>
      <div className="form-actions"><span className="professional-profile-note">A logo oficial VR será incluída automaticamente no cabeçalho do PDF.</span><button className="primary-action" type="submit">SALVAR IDENTIFICAÇÃO</button></div>
    </form>
    <form className="client-form professional-signature" id="assinatura" action={saveSignatureAction}>
      <section><p className="eyebrow">ASSINATURA NOS DOCUMENTOS</p>
        <p className="professional-signature-help">Aparece acima do seu nome na folha de assinaturas de propostas, contratos, cessões e memoriais. Envie um SVG com o desenho da assinatura: o sistema guarda só os traços, sem deixar o arquivo em nenhum endereço público.</p>
        {signatureNotice ? <p className={signatureNotice.error ? "form-error" : "form-success"} role={signatureNotice.error ? "alert" : "status"}>{signatureNotice.text}</p> : null}
        <div className="professional-signature-body">
          <div className="professional-signature-sheet">{signature ? <SignaturePreview signature={signature} /> : <span>Nenhuma assinatura cadastrada.</span>}<i /><b>{profile?.name ?? DEFAULT_PROFESSIONAL.name}</b></div>
          <div className="professional-signature-actions">
            <label>{signature ? "TROCAR ASSINATURA (SVG)" : "ARQUIVO SVG DA ASSINATURA"}<input name="signature" type="file" accept="image/svg+xml,.svg" required /></label>
            <div><button className="primary-action" type="submit">SALVAR ASSINATURA</button>{signature ? <ConfirmSubmitButton formAction={removeSignatureAction} className="text-link professional-signature-remove" message="Remover a assinatura? Os próximos PDFs saem com o espaço em branco.">REMOVER</ConfirmSubmitButton> : null}</div>
          </div>
        </div>
      </section>
    </form></section></div></main>;
}
