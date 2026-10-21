"use client";

type FormAction = (formData: FormData) => void | Promise<void>;

/** Botão de envio que pede confirmação antes de executar uma ação destrutiva. */
export function ConfirmSubmitButton({ formAction, message, className, children }: { formAction: FormAction; message: string; className?: string; children: React.ReactNode }) {
  return <button type="submit" className={className} formAction={formAction} formNoValidate onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</button>;
}
