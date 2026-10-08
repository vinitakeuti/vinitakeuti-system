"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeletePendingRecordButton({ id, field, label, action }: { id: string; field: "quoteId" | "saleId"; label: "orçamento" | "venda"; action: DeleteAction }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(`Excluir esta ${label} pendente permanentemente? Esta ação não pode ser desfeita.`)) event.preventDefault(); }}><input type="hidden" name={field} value={id} /><button className="table-action table-danger" type="submit">EXCLUIR</button></form>;
}
