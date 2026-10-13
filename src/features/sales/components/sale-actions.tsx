"use client";

import { useState } from "react";

type SaleAction = (formData: FormData) => void | Promise<void>;
const statuses = [{ value: "PENDING", label: "Pendente" }, { value: "CONFIRMED", label: "Confirmada" }, { value: "PAID", label: "Paga" }, { value: "CANCELLED", label: "Cancelada" }];

export function SaleActions({ saleId, status, updateAction, deleteAction }: { saleId: string; status: string; updateAction: SaleAction; deleteAction: SaleAction }) {
  const [selected, setSelected] = useState(status);
  const [isEditing, setIsEditing] = useState(false);
  return <div className="sale-actions"><button className="sale-edit-toggle" type="button" aria-expanded={isEditing} onClick={() => setIsEditing((open) => !open)}>{isEditing ? "FECHAR" : "EDITAR"}</button>{isEditing ? <div className="sale-edit-panel"><form action={updateAction}><input type="hidden" name="saleId" value={saleId} /><select name="status" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Status da venda">{statuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><button type="submit">SALVAR</button></form>{(status === "PENDING" || status === "CONFIRMED") ? <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("Excluir esta venda? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="saleId" value={saleId} /><button className="sale-delete-action" type="submit">EXCLUIR</button></form> : null}</div> : null}</div>;
}
