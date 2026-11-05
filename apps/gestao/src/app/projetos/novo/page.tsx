import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ProjectFields } from "@/features/projects/components/project-form";
import { getQuoteForProject } from "@/features/projects/queries/project-queries";
import { createProjectAction } from "@/features/projects/services/project-actions";

export const dynamic = "force-dynamic";

/** Novo projeto, do zero ou a partir de um orçamento (?orcamento=…), que já traz o cliente, o nome e o resumo. */
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ orcamento?: string; erro?: string }> }) {
  const { orcamento, erro } = await searchParams;
  const quote = orcamento ? await getQuoteForProject(orcamento.slice(0, 50)) : null;
  const linked = quote?.projectId ? quote : null;
  const fromQuote = quote && !quote.projectId ? quote : null;

  return <main className="app-shell"><AppSidebar current="projects" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow page-crumb"><Link href="/projetos">Projetos</Link></p><h1>Novo projeto</h1><p>Depois de criar, cole a descrição completa no Plano e a Eliza destrincha em funcionalidades e subatividades.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/projetos">Voltar para projetos</Link></div></header>
    {linked ? <p className="form-error">O orçamento {linked.code} já tem um projeto. <Link className="text-link-inline" href={`/projetos/${linked.projectId}`}>Abrir o projeto</Link>.</p> : null}
    <form className="client-form" action={createProjectAction}>
      {erro ? <p className="form-error">{erro}</p> : null}
      <section><p className="eyebrow">{fromQuote ? `A partir do orçamento ${fromQuote.code}` : "Dados do projeto"}</p>
        <ProjectFields values={{ name: fromQuote?.title ?? "", description: fromQuote?.scope.slice(0, 600) ?? null, status: "PLANNING", startedAt: null, deliveryAt: fromQuote?.estimatedDays ? new Date(Date.now() + fromQuote.estimatedDays * 86_400_000) : null, client: fromQuote?.client ?? null, quoteId: fromQuote?.id ?? null }} lockedQuote={fromQuote} />
      </section>
      <div className="form-actions"><Link className="text-link" href="/projetos">Cancelar</Link><button className="primary-action" type="submit">Criar projeto</button></div>
    </form>
  </section></div></main>;
}
