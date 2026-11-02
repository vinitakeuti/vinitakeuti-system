import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Texto das respostas da IA: Markdown simples (parágrafos, listas, títulos, **negrito**, *itálico*, `código`) e
 * links. Links da gestão (endereço completo ou caminho como /orcamentos/…) abrem na própria gestão. Nada de HTML cru:
 * tudo vira elementos do React.
 */

const INTERNAL_PATH = /^\/(orcamentos|clientes|financeiro|documentos|servicos|monitoramento|vendas|integracoes|configuracoes|assistente)(\/[\w\-/?=&.#]*)?/;
const TOKEN = /(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+|(?:^|(?<=[\s(]))\/(?:orcamentos|clientes|financeiro|documentos|servicos|monitoramento|vendas|integracoes|configuracoes|assistente)(?:\/[\w\-/?=&.#]*)?|\*[^*\s][^*]*\*)/g;

function internalHref(url: string) {
  try {
    const parsed = new URL(url);
    if (typeof window !== "undefined" && parsed.host === window.location.host) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (/^gestao\./.test(parsed.host) && INTERNAL_PATH.test(parsed.pathname)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { /* não é URL completa */ }
  return null;
}

function anchor(label: string, href: string, key: string) {
  const trimmed = href.replace(/[.,;:]+$/, "");
  const internal = trimmed.startsWith("/") ? trimmed : internalHref(trimmed);
  if (internal) return <Link key={key} href={internal}>{label === href ? internal : label}</Link>;
  return <a key={key} href={trimmed} target="_blank" rel="noreferrer noopener">{label === href ? trimmed : label}</a>;
}

function inline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${prefix}-${index++}`;
    const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) nodes.push(anchor(link[1], link[2], key));
    else if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("http") || token.startsWith("/")) nodes.push(anchor(token, token, key));
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block = { type: "p" | "h"; lines: string[] } | { type: "ul" | "ol"; items: string[] };

function blocks(text: string): Block[] {
  const output: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = output.at(-1);
    if (!line.trim()) { output.push({ type: "p", lines: [] }); continue; }
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (bullet || ordered) {
      const type = bullet ? "ul" : "ol";
      const item = (bullet ?? ordered)![1];
      if (last && "items" in last && last.type === type) last.items.push(item);
      else output.push({ type, items: [item] });
    } else if (heading) output.push({ type: "h", lines: [heading[1].replace(/\*\*/g, "")] });
    else if (last && "lines" in last && last.type === "p" && last.lines.length) last.lines.push(line);
    else output.push({ type: "p", lines: [line] });
  }
  return output.filter((block) => "items" in block ? block.items.length > 0 : block.lines.length > 0);
}

export function AssistantMarkdown({ text }: { text: string }) {
  return <>{blocks(text).map((block, index) => {
    const key = `b${index}`;
    if ("items" in block) return block.type === "ul"
      ? <ul key={key}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `${key}-${itemIndex}`)}</li>)}</ul>
      : <ol key={key}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `${key}-${itemIndex}`)}</li>)}</ol>;
    if (block.type === "h") return <h3 key={key}>{inline(block.lines[0], key)}</h3>;
    return <p key={key}>{block.lines.flatMap((line, lineIndex) => lineIndex ? [<br key={`br${lineIndex}`} />, ...inline(line, `${key}-${lineIndex}`)] : inline(line, `${key}-${lineIndex}`))}</p>;
  })}</>;
}
