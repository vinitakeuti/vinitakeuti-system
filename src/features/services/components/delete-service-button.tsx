"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteServiceButton({ serviceId, action }: { serviceId: string; action: DeleteAction }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Excluir este serviço permanentemente? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="serviceId" value={serviceId} /><button className="danger-action" type="submit">EXCLUIR SERVIÇO</button></form>;
}
