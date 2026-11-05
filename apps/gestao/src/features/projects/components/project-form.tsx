import { ClientPicker, type ClientPickerOption } from "@/features/clients/components/client-picker";
import { PROJECT_LIMITS, PROJECT_STATUS_OPTIONS, projectStatusLabel } from "@/features/projects/types/project";
import type { ProjectStatus } from "@prisma/client";

type Values = { name: string; description: string | null; status: ProjectStatus; startedAt: Date | null; deliveryAt: Date | null; client: ClientPickerOption | null; quoteId: string | null };

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const dateValue = (date: Date | null) => date ? isoDay.format(date) : "";

/**
 * Campos do projeto (novo e edição). Sem cliente, o projeto é pessoal. O orçamento só aparece quando há opções
 * (orçamentos do cliente ainda sem projeto); vindo de um orçamento, ele e o cliente ficam fixos.
 */
export function ProjectFields({ values, quotes, lockedQuote }: { values: Values; quotes?: { id: string; code: string; title: string }[]; lockedQuote?: { id: string; code: string; title: string } | null }) {
  const statuses = PROJECT_STATUS_OPTIONS.includes(values.status as (typeof PROJECT_STATUS_OPTIONS)[number]) ? PROJECT_STATUS_OPTIONS : [values.status, ...PROJECT_STATUS_OPTIONS];
  return <div className="form-grid">
    <label className="form-wide">Nome do projeto<input name="name" required maxLength={PROJECT_LIMITS.title} defaultValue={values.name} placeholder="Ex.: Sistema de gestão da Pacelab" /></label>
    {lockedQuote ? <>
      <input type="hidden" name="clientId" value={values.client?.id ?? ""} /><input type="hidden" name="quoteId" value={lockedQuote.id} />
      <div className="project-locked-field form-wide"><span>Cliente e orçamento</span><b>{values.client?.name}</b><small>{lockedQuote.code} · {lockedQuote.title}</small></div>
    </> : <div className="form-wide"><ClientPicker name="clientId" label="Cliente" hint="Deixe vazio para um projeto pessoal (não aparece em nenhuma área do cliente)." initialClient={values.client} removeLabel="Tornar pessoal" /></div>}
    <label>Situação<select name="status" defaultValue={values.status}>{statuses.map((status) => <option key={status} value={status}>{projectStatusLabel[status]}</option>)}</select></label>
    {!lockedQuote && quotes?.length ? <label>Orçamento vinculado<select name="quoteId" defaultValue={values.quoteId ?? ""}><option value="">Nenhum</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.code} · {quote.title}</option>)}</select></label> : <span />}
    <label>Início<input name="startedAt" type="date" defaultValue={dateValue(values.startedAt)} /></label>
    <label>Entrega prevista<input name="deliveryAt" type="date" defaultValue={dateValue(values.deliveryAt)} /></label>
    <label className="form-wide">Resumo do projeto<textarea name="description" maxLength={PROJECT_LIMITS.description} defaultValue={values.description ?? ""} placeholder="Uma ou duas frases sobre o objetivo. A descrição completa você entrega à Eliza no Plano." /></label>
  </div>;
}
