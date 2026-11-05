"use client";

import { useActionState } from "react";
import { sendModelTestAction, sendTestEmailAction, verifyEmailConnectionAction, type EmailTestState } from "@/features/settings/services/email-actions";

function Result({ state }: { state: EmailTestState }) {
  if (state.status === "idle") return null;
  return <div className={state.status === "ok" ? "settings-result is-ok" : "settings-result is-error"} role={state.status === "ok" ? "status" : "alert"}>
    <b>{state.message}</b>
    {state.detail ? <code>{state.detail}</code> : null}
  </div>;
}

/** Teste de conexão SMTP e envio de e-mail de teste, com o resultado detalhado. */
export function EmailTestPanel({ configured, defaultTo }: { configured: boolean; defaultTo: string }) {
  const [verifyState, verify, verifying] = useActionState<EmailTestState>(verifyEmailConnectionAction, { status: "idle" });
  const [sendState, send, sending] = useActionState<EmailTestState, FormData>(sendTestEmailAction, { status: "idle" });
  return <>
    <form action={verify} className="settings-inline-action">
      <button className="secondary-action" type="submit" disabled={!configured || verifying}>{verifying ? "Testando..." : "Testar conexão"}</button>
      <small>Conecta e faz login no servidor, sem enviar nada.</small>
    </form>
    <Result state={verifyState} />
    <form action={send} className="settings-form">
      <label>Para<input name="to" type="email" required maxLength={254} defaultValue={defaultTo} /></label>
      <label>Assunto<input name="subject" maxLength={160} defaultValue="Teste de envio · VR Gestão" /></label>
      <label className="settings-form-wide">Mensagem<textarea name="message" rows={3} maxLength={2000} defaultValue="Este é um e-mail de teste enviado pelas Configurações da VR Gestão." /></label>
      <div className="settings-form-actions"><button className="primary-action" type="submit" disabled={!configured || sending}>{sending ? "Enviando..." : "Enviar e-mail de teste"}</button>{!configured ? <small>Configure o servidor de envio para habilitar.</small> : null}</div>
    </form>
    <Result state={sendState} />
  </>;
}

/** Envio de um modelo de e-mail (com dados de exemplo) para conferir na caixa de entrada. */
export function EmailModelTest({ model, configured, defaultTo }: { model: string; configured: boolean; defaultTo: string }) {
  const [state, send, sending] = useActionState<EmailTestState, FormData>(sendModelTestAction, { status: "idle" });
  return <form action={send} className="settings-model-test">
    <input type="hidden" name="model" value={model} />
    <label>Enviar este modelo para<input name="to" type="email" required maxLength={254} defaultValue={defaultTo} /></label>
    <button className="secondary-action" type="submit" disabled={!configured || sending}>{sending ? "Enviando..." : "Enviar teste"}</button>
    <Result state={state} />
  </form>;
}
