"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteQuoteButton({ quoteId, action, returnTo, compact = false }: { quoteId: string; action: DeleteAction; returnTo?: "pending"; compact?: boolean }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Excluir este orçamento permanentemente? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="quoteId" value={quoteId} />{returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}<button className={compact ? "quote-pending-delete" : "danger-action"} type="submit">{compact ? "EXCLUIR" : "EXCLUIR ORÇAMENTO"}</button></form>;
}
