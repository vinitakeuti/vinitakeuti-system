import { redirect } from "next/navigation";

/** Orçamentos passou a fazer parte de Documentos: a proposta comercial é um dos documentos do cliente. */
export default function QuotesPage() {
  redirect("/documentos");
}
