"use client";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteMonitoredAppButton({ id, action }: { id: string; action: DeleteAction }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm("Remover este sistema do monitoramento? O histórico de verificações também será apagado.")) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><button className="danger-action" type="submit">REMOVER SISTEMA</button></form>;
}
