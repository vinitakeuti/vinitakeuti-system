"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteDocumentButton({ documentId, action }: { documentId: string; action: DeleteAction }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Excluir este documento permanentemente? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="documentId" value={documentId} /><button className="quote-pending-delete" type="submit">EXCLUIR</button></form>;
}
