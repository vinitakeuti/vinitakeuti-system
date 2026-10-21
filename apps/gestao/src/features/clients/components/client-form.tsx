import Link from "next/link";
import { DocumentInput } from "@/components/document-input";
import { PhoneInput } from "@/features/clients/components/phone-input";

type ClientFormValues = { id?: string; name?: string; company?: string | null; cpf?: string | null; cnpj?: string | null; email?: string | null; phone?: string | null; city?: string | null; address?: string | null; notes?: string | null };

/** Formulário do cadastro do cliente, usado para criar e para editar. */
export function ClientForm({ action, values = {}, error, cancelHref, submitLabel }: { action: (formData: FormData) => Promise<void>; values?: ClientFormValues; error?: string; cancelHref: string; submitLabel: string }) {
  return <form className="client-form" action={action}>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
    <section><p className="eyebrow">IDENTIFICAÇÃO</p><div className="form-grid"><label>Nome completo ou razão social<input name="name" required maxLength={160} autoComplete="name" defaultValue={values.name ?? ""} /></label><label>Empresa<input name="company" maxLength={160} autoComplete="organization" defaultValue={values.company ?? ""} /></label><label>CPF<DocumentInput name="cpf" kind="cpf" defaultValue={values.cpf} /></label><label>CNPJ<DocumentInput name="cnpj" kind="cnpj" defaultValue={values.cnpj} /></label></div></section>
    <section><p className="eyebrow">CONTATO</p><div className="form-grid"><label>E-mail<input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={values.email ?? ""} /></label><label>Telefone<PhoneInput defaultValue={values.phone ?? ""} /></label><label>Cidade<input name="city" maxLength={120} autoComplete="address-level2" defaultValue={values.city ?? ""} /></label><label className="form-wide">Endereço<input name="address" maxLength={500} autoComplete="street-address" defaultValue={values.address ?? ""} /></label></div></section>
    <section><p className="eyebrow">CONTEXTO</p><label>Observações<textarea name="notes" maxLength={4000} defaultValue={values.notes ?? ""} /></label></section>
    <div className="form-actions"><Link className="text-link" href={cancelHref}>CANCELAR</Link><button className="primary-action" type="submit">{submitLabel}</button></div>
  </form>;
}
