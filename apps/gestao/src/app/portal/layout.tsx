import type { Metadata } from "next";
import { requireClientUser } from "@/features/auth/services/auth-session";

export const metadata: Metadata = { title: "Área do cliente | Vinicius Riudi", description: "Serviços contratados, pagamentos e documentos." };

/** Portal do cliente. No domínio de clientes, o proxy serve "/pagamentos" a partir de "/portal/pagamentos". */
export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireClientUser();
  return children;
}
