"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteQuoteButton({ quoteId, action }: { quoteId: string; action: DeleteAction }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Excluir este orçamento permanentemente? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="quoteId" value={quoteId} /><button className="danger-action" type="submit">EXCLUIR ORÇAMENTO</button></form>;
}
