"use client";

import { useActionState, useState } from "react";
import { portalAccessAction, type PortalAccessState } from "@/features/client-portal/services/portal-access-actions";

type Access = { id: string; email: string; isActive: boolean; lastLoginAt: string | null; createdAt: string };

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" });

function shareMessage(name: string, portalUrl: string, email: string, password: string) {
  const firstName = name.trim().split(/\s+/)[0] || "";
  return `Olá${firstName ? `, ${firstName}` : ""}! Seu acesso à área do cliente está pronto.\n\nEndereço: ${portalUrl}\nE-mail: ${email}\nSenha provisória: ${password}\n\nNo primeiro acesso, troque a senha em "Sua conta".`;
}

/** Acesso do cliente ao portal: criar, gerar nova senha, desativar/reativar e trocar o e-mail. */
export function PortalAccessPanel({ clientId, clientName, clientEmail, access, portalUrl }: { clientId: string; clientName: string; clientEmail: string | null; access: Access | null; portalUrl: string }) {
  const [state, action, pending] = useActionState<PortalAccessState, FormData>(portalAccessAction, { status: "idle" });
  const [copied, setCopied] = useState(false);
  const message = state.status === "password" ? shareMessage(clientName, portalUrl, state.email, state.password) : "";

  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
  }

  return <section className="client-block client-access" aria-labelledby="client-access-title">
    <div className="client-block-heading"><h2 id="client-access-title">Acesso ao portal do cliente</h2><a className="text-link" href={portalUrl} target="_blank" rel="noreferrer">{portalUrl.replace(/^https?:\/\//, "").toUpperCase()}</a></div>

    {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
    {state.status === "ok" ? <p className="form-success" role="status">{state.message}</p> : null}
    {state.status === "password" ? <div className="client-access-secret" role="status">
      <p><b>{state.created ? "Acesso criado." : "Nova senha gerada."}</b> Copie agora: a senha não será mostrada de novo.</p>
      <dl><div><dt>E-mail</dt><dd>{state.email}</dd></div><div><dt>Senha provisória</dt><dd><code>{state.password}</code></dd></div></dl>
      <textarea readOnly rows={7} value={message} aria-label="Mensagem para enviar ao cliente" />
      <button type="button" className="secondary-action" onClick={copy}>{copied ? "MENSAGEM COPIADA" : "COPIAR MENSAGEM"}</button>
    </div> : null}

    {access ? <>
      <dl className="client-facts">
        <div><dt>E-mail de acesso</dt><dd>{access.email}</dd></div>
        <div><dt>Situação</dt><dd className={access.isActive ? undefined : "is-empty"}>{access.isActive ? "Ativo" : "Desativado"}</dd></div>
        <div><dt>Último acesso</dt><dd className={access.lastLoginAt ? undefined : "is-empty"}>{access.lastLoginAt ? date.format(new Date(access.lastLoginAt)) : "Ainda não entrou"}</dd></div>
      </dl>
      <div className="client-access-actions">
        <form action={action} onSubmit={(event) => { if (!window.confirm("Gerar uma nova senha? A senha atual deixa de funcionar e o cliente precisa entrar de novo.")) event.preventDefault(); }}><input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="userId" value={access.id} /><input type="hidden" name="intent" value="reset" /><button className="secondary-action" type="submit" disabled={pending}>GERAR NOVA SENHA</button></form>
        <form action={action} onSubmit={(event) => { if (access.isActive && !window.confirm("Desativar o acesso? O cliente não consegue mais entrar no portal.")) event.preventDefault(); }}><input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="userId" value={access.id} /><input type="hidden" name="intent" value={access.isActive ? "deactivate" : "activate"} /><button className={access.isActive ? "text-link client-access-danger" : "text-link"} type="submit" disabled={pending}>{access.isActive ? "DESATIVAR ACESSO" : "REATIVAR ACESSO"}</button></form>
      </div>
      <details className="client-access-email"><summary>TROCAR E-MAIL DE ACESSO</summary><form action={action}><input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="userId" value={access.id} /><input type="hidden" name="intent" value="email" /><label>Novo e-mail<input name="email" type="email" required maxLength={254} defaultValue={access.email} /></label><button className="secondary-action" type="submit" disabled={pending}>SALVAR</button></form></details>
    </> : <form action={action} className="client-access-create">
      <p>Este cliente ainda não tem acesso. Crie a conta com o e-mail dele: uma senha provisória é gerada para você enviar.</p>
      <input type="hidden" name="clientId" value={clientId} /><input type="hidden" name="intent" value="create" />
      <label>E-mail de acesso<input name="email" type="email" required maxLength={254} defaultValue={clientEmail ?? ""} placeholder="email@cliente.com" /></label>
      <button className="primary-action" type="submit" disabled={pending}>{pending ? "CRIANDO..." : "CRIAR ACESSO"}</button>
    </form>}
  </section>;
}
