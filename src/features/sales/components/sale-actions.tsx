"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type SaleAction = (formData: FormData) => void | Promise<void>;
const statuses = [{ value: "PENDING", label: "Pendente" }, { value: "CONFIRMED", label: "Confirmada" }, { value: "PAID", label: "Paga" }, { value: "CANCELLED", label: "Cancelada" }];
const PANEL_WIDTH = 200;

/**
 * Edição do status da venda. O painel flutua sobre a página (fora da área de rolagem da tabela, que o cortava)
 * e abre para baixo do botão, ou para cima quando não há espaço.
 */
export function SaleActions({ saleId, status, updateAction, deleteAction }: { saleId: string; status: string; updateAction: SaleAction; deleteAction: SaleAction }) {
  const [selected, setSelected] = useState(status);
  const [isEditing, setIsEditing] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function place() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 96;
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 && rect.top - 6 - height > 8 ? rect.top - 6 - height : below;
    setPosition({ top, left: Math.min(Math.max(8, rect.right - PANEL_WIDTH), window.innerWidth - PANEL_WIDTH - 8) });
  }

  // Mede o painel já montado e o posiciona antes de ele aparecer na tela.
  useLayoutEffect(() => { if (isEditing) place(); }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setIsEditing(false);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setIsEditing(false); }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isEditing]);

  return <div className="sale-actions">
    <button ref={triggerRef} className="sale-edit-toggle" type="button" aria-expanded={isEditing} onClick={() => setIsEditing((open) => !open)}>{isEditing ? "FECHAR" : "EDITAR"}</button>
    {isEditing ? createPortal(<div ref={panelRef} className="sale-edit-panel is-floating" style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: PANEL_WIDTH }}>
      <form action={updateAction}><input type="hidden" name="saleId" value={saleId} /><select name="status" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Status da venda">{statuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><button type="submit">SALVAR</button></form>
      {(status === "PENDING" || status === "CONFIRMED") ? <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("Excluir esta venda? Esta ação não pode ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="saleId" value={saleId} /><button className="sale-delete-action" type="submit">EXCLUIR</button></form> : null}
    </div>, document.body) : null}
  </div>;
}
