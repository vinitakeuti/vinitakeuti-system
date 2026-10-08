"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { InlineRichTextEditor, type RichTextEditorCommand } from "@/features/services/components/service-proposal-editor";
import { updateQuoteDocumentAction } from "@/features/quotes/services/quote-actions";
import type { QuoteDocumentAlign, QuoteDocumentBlock, QuoteDocumentBlockType, QuoteDocumentContent, QuoteDocumentFontSize } from "@/features/quotes/types/document-content";
import { parseRichText, richTextPlainText, serializeRichText, type RichTextBlock, type RichTextRun } from "@/lib/rich-text";

type ProfessionalProfile = {
  name: string;
  professionalTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
};

type DocumentDisplayBlock = QuoteDocumentBlock & { sourceId?: string; partIndex?: number };
type DocumentPage = { blocks: DocumentDisplayBlock[] };

type Props = {
  quoteId: string;
  quoteCode: string;
  quoteTitle: string;
  backHref: string;
  initialContent: QuoteDocumentContent;
  professional: ProfessionalProfile;
};

const sizeLabels: Record<QuoteDocumentFontSize, string> = { small: "Pequeno", medium: "Normal", large: "Grande" };
const alignLabels: Record<QuoteDocumentAlign, string> = { left: "À esquerda", center: "Centralizado", right: "À direita", justify: "Justificado" };

function estimatedBlockHeight(block: DocumentDisplayBlock) {
  const source = block.type === "rich-text" ? richTextPlainText(block.text) : block.text;
  if (!source) return block.type === "rich-text" ? 24 : 24;
  const charactersPerLine = block.fontSize === "large" ? 48 : block.fontSize === "small" ? 100 : 78;
  const lines = Math.max(1, source.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0));
  return lines * (block.fontSize === "large" ? 32 : block.fontSize === "small" ? 20 : 25) + (block.type === "rich-text" ? 12 : 18);
}

function estimatedRichTextBlockHeight(block: RichTextBlock) {
  if (block.type === "paragraph") {
    const text = block.runs.map((run) => run.text).join("");
    const lines = Math.max(1, text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 74)), 0));
    return lines * 19 + 8;
  }
  return block.items.reduce((total, item) => {
    const text = item.map((run) => run.text).join("");
    const lines = Math.max(1, text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 69)), 0));
    return total + lines * 19 + 5;
  }, 8);
}

function splitRunsForPage(runs: RichTextRun[], maxCharacters = 760) {
  const parts: RichTextRun[][] = [];
  let part: RichTextRun[] = [];
  let used = 0;
  for (const run of runs) {
    let remainingText = run.text;
    while (remainingText) {
      const capacity = maxCharacters - used;
      if (capacity <= 0) {
        if (part.length) parts.push(part);
        part = [];
        used = 0;
        continue;
      }
      if (remainingText.length <= capacity) {
        part.push({ ...run, text: remainingText });
        used += remainingText.length;
        remainingText = "";
        continue;
      }
      const preferredBreak = remainingText.lastIndexOf(" ", capacity);
      const cutAt = preferredBreak > Math.floor(capacity * 0.6) ? preferredBreak + 1 : capacity;
      part.push({ ...run, text: remainingText.slice(0, cutAt) });
      parts.push(part);
      part = [];
      used = 0;
      remainingText = remainingText.slice(cutAt);
    }
  }
  if (part.length) parts.push(part);
  return parts;
}

function richTextParts(block: QuoteDocumentBlock): DocumentDisplayBlock[] {
  const document = parseRichText(block.text);
  if (!document.blocks.length || !richTextPlainText(block.text).trim()) return [];
  const atomicBlocks = document.blocks.flatMap((item): RichTextBlock[] => {
    if (item.type === "paragraph") return splitRunsForPage(item.runs).map((runs) => ({ type: "paragraph", runs }));
    return item.items.flatMap((listItem) => splitRunsForPage(listItem).map((runs) => ({ type: item.type, items: [runs] })));
  });
  const chunks: RichTextBlock[][] = [];
  let chunk: RichTextBlock[] = [];
  let chunkHeight = 0;
  for (const item of atomicBlocks) {
    const height = estimatedRichTextBlockHeight(item);
    if (chunk.length && chunkHeight + height > 300) {
      chunks.push(chunk);
      chunk = [];
      chunkHeight = 0;
    }
    chunk.push(item);
    chunkHeight += height;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks.map((items, index) => ({ ...block, id: `${block.id}-part-${index}`, text: serializeRichText({ version: 1, blocks: items }) ?? "", sourceId: block.id, partIndex: index }));
}

function expandedBlocks(blocks: QuoteDocumentBlock[]) {
  return blocks.flatMap((block): DocumentDisplayBlock[] => block.type === "rich-text" ? richTextParts(block) : [block]);
}

function serviceGroup(blocks: DocumentDisplayBlock[], start: number) {
  const group = [blocks[start]];
  const suffix = blocks[start].id.slice("service-title-".length);
  let index = start + 1;
  while (index < blocks.length && (blocks[index].id === `service-category-${suffix}` || blocks[index].id === `service-description-${suffix}-part-0`)) {
    group.push(blocks[index]);
    index += 1;
  }
  return { group, nextIndex: index };
}

function paginationGroups(blocks: DocumentDisplayBlock[]) {
  const groups: DocumentDisplayBlock[][] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block.id === "services-label" && blocks[index + 1]?.id.startsWith("service-title-")) {
      const service = serviceGroup(blocks, index + 1);
      groups.push([block, ...service.group]);
      index = service.nextIndex;
      continue;
    }
    if (block.id.startsWith("service-title-")) {
      const service = serviceGroup(blocks, index);
      groups.push(service.group);
      index = service.nextIndex;
      continue;
    }
    groups.push([block]);
    index += 1;
  }
  return groups;
}

function paginateDocument(blocks: QuoteDocumentBlock[]) {
  const displayBlocks = expandedBlocks(blocks);
  const pages: DocumentPage[] = [{ blocks: [] }];
  let usedHeight = 66;
  for (const group of paginationGroups(displayBlocks)) {
    const height = group.reduce((total, block) => total + estimatedBlockHeight(block), 0);
    const page = pages.at(-1)!;
    if (page.blocks.length && usedHeight + height > 790) {
      pages.push({ blocks: [] });
      usedHeight = 0;
    }
    pages.at(-1)!.blocks.push(...group);
    usedHeight += height;
  }
  return pages;
}

function EditableBlock({ block, onActivate, onInput, onCommit, onRemove, command }: { block: DocumentDisplayBlock; onActivate: () => void; onInput: (text: string) => void; onCommit: () => void; onRemove: () => void; command?: { id: number; value: RichTextEditorCommand } | null }) {
  if (block.type === "rich-text") return <div className="quote-editor-document-block quote-editor-document-rich-text"><InlineRichTextEditor initialValue={block.text} ariaLabel="Texto da proposta" className="quote-editor-document-rich-content" onFocus={onActivate} onBlur={onCommit} onChange={(value) => onInput(value ?? "")} command={command} /></div>;
  return <div className={`quote-editor-document-block quote-editor-document-${block.type} quote-editor-document-${block.fontSize}${block.text ? "" : " is-empty"}`}>
    <div className="quote-editor-document-content" role="textbox" aria-multiline="true" aria-label={block.type === "heading" ? "Título do documento" : "Texto do documento"} contentEditable suppressContentEditableWarning onFocus={onActivate} onBlur={onCommit} onKeyDown={(event) => { if ((event.key === "Backspace" || event.key === "Delete") && !event.currentTarget.innerText.trim()) { event.preventDefault(); onRemove(); } }} onInput={(event) => onInput(event.currentTarget.innerText.slice(0, 4_000))} style={{ textAlign: block.align, fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none" }}>{block.text}</div>
  </div>;
}

export function QuoteDocumentEditor({ quoteId, quoteCode, quoteTitle, backHref, initialContent, professional }: Props) {
  const [content, setContent] = useState<QuoteDocumentContent>(initialContent);
  const contentRef = useRef<QuoteDocumentContent>(initialContent);
  const documentContentFieldRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState(initialContent.blocks.find((block) => block.id !== "intro-title")?.id ?? "");
  const [richTextCommand, setRichTextCommand] = useState<{ id: number; value: RichTextEditorCommand } | null>(null);
  const blocks = content.blocks;
  const editableBlocks = blocks.filter((block) => block.id !== "intro-title");
  const activeBlock = editableBlocks.find((block) => block.id === activeBlockId) ?? (activeBlockId.includes("-part-") ? { id: activeBlockId, type: "rich-text" as const, text: "", fontSize: "medium" as const, bold: false, italic: false, underline: false, align: "left" as const } : editableBlocks[0]);
  const pages = useMemo(() => paginateDocument(editableBlocks), [editableBlocks]);
  const headerDetails = [professional.document, professional.phone, professional.email].filter(Boolean);
  const footerDetails = [professional.document, professional.website?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "")].filter(Boolean).join(" · ");

  function updateBlock(id: string, patch: Partial<QuoteDocumentBlock>) {
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    setContent(next);
  }

  function updateBlockText(id: string, text: string) {
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, text } : block) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
  }

  function updateDisplayBlockText(block: DocumentDisplayBlock, text: string) {
    if (!block.sourceId || block.partIndex === undefined) {
      updateBlockText(block.id, text);
      return;
    }
    const source = contentRef.current.blocks.find((item) => item.id === block.sourceId);
    if (!source) return;
    const parts = richTextParts(source);
    const mergedBlocks = parts.flatMap((part) => parseRichText(part.partIndex === block.partIndex ? text : part.text).blocks);
    updateBlockText(source.id, serializeRichText({ version: 1, blocks: mergedBlocks }) ?? "");
  }

  function commitDocument() {
    setContent(contentRef.current);
  }

  function removeBlock(id: string) {
    if (contentRef.current.blocks.length <= 1) return;
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.filter((block) => block.id !== id) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    setContent(next);
  }

  function commitBlock(block: DocumentDisplayBlock) {
    const sourceId = block.sourceId ?? block.id;
    const source = contentRef.current.blocks.find((item) => item.id === sourceId);
    if (source && source.type !== "rich-text" && !source.text.trim() && contentRef.current.blocks.length > 1) {
      removeBlock(source.id);
      return;
    }
    commitDocument();
  }

  function applyRichTextCommand(value: RichTextEditorCommand) {
    setRichTextCommand((current) => ({ id: (current?.id ?? 0) + 1, value }));
  }

  return <form className="quote-document-editor quote-docs-editor" action={updateQuoteDocumentAction}>
    <input type="hidden" name="quoteId" value={quoteId} />
    <input ref={documentContentFieldRef} type="hidden" name="documentContent" defaultValue={JSON.stringify(content)} />
    <section className="quote-docs-toolbar" aria-label="Ferramentas do editor">
      <div className="quote-docs-toolbar-meta"><div className="quote-docs-toolbar-title"><span>DOCUMENTO</span><strong>{quoteTitle}</strong></div><div className="quote-docs-toolbar-actions"><SidebarToggle location="header" hideWhenOpen /><Link className="quote-docs-back-link quote-docs-template-link" href="/orcamentos/texto-padrao">TEXTO PADRÃO</Link><Link className="quote-docs-back-link" href={backHref}>VOLTAR</Link><button className="primary-action quote-docs-save" type="submit">SALVAR</button></div></div>
      <div className="quote-docs-toolbar-tools">
        {activeBlock?.type === "rich-text" ? <>
          <span className="quote-docs-tool-context">FORMATAÇÃO DO TEXTO</span>
          <button type="button" aria-label="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("bold")}><strong>N</strong></button>
          <button type="button" aria-label="Itálico" className="quote-docs-italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("italic")}><em>I</em></button>
          <button type="button" aria-label="Sublinhado" className="quote-docs-underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("underline")}><u>S</u></button>
          <span className="quote-docs-divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertUnorderedList")}>LISTA</button>
          <button type="button" aria-label="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertOrderedList")}>1.</button>
          <span className="quote-docs-divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("removeFormat")}>LIMPAR FORMATAÇÃO</button>
        </> : <>
        <select aria-label="Tipo de conteúdo" disabled={!activeBlock} value={activeBlock?.type ?? "paragraph"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { type: event.target.value as QuoteDocumentBlockType })}><option value="heading">Título</option><option value="paragraph">Texto</option></select>
        <select aria-label="Tamanho do texto" disabled={!activeBlock} value={activeBlock?.fontSize ?? "medium"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { fontSize: event.target.value as QuoteDocumentFontSize })}>{Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="quote-docs-divider" />
        <button type="button" aria-label="Negrito" disabled={!activeBlock} className={activeBlock?.bold ? "is-active" : ""} aria-pressed={activeBlock?.bold ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { bold: !activeBlock.bold })}>N</button>
        <button type="button" aria-label="Itálico" disabled={!activeBlock} className={activeBlock?.italic ? "is-active quote-docs-italic" : "quote-docs-italic"} aria-pressed={activeBlock?.italic ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { italic: !activeBlock.italic })}>I</button>
        <button type="button" aria-label="Sublinhado" disabled={!activeBlock} className={activeBlock?.underline ? "is-active quote-docs-underline" : "quote-docs-underline"} aria-pressed={activeBlock?.underline ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { underline: !activeBlock.underline })}>S</button>
        <select aria-label="Alinhamento" disabled={!activeBlock} value={activeBlock?.align ?? "left"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { align: event.target.value as QuoteDocumentAlign })}>{Object.entries(alignLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="quote-docs-divider" />
        <button type="button" disabled={!activeBlock} onClick={() => activeBlock && updateBlock(activeBlock.id, { bold: false, italic: false, underline: false, fontSize: activeBlock.type === "heading" ? "large" : "medium", align: "left" })}>LIMPAR FORMATAÇÃO</button>
        </>}
      </div>
    </section>
    <section className="quote-docs-canvas" aria-label="Documento editável">
      <div className="quote-docs-canvas-heading"><span>PÁGINAS DO DOCUMENTO</span><small>{pages.length} {pages.length === 1 ? "página" : "páginas"} organizadas automaticamente</small></div>
      <div className="quote-docs-pages">
        {pages.map((page, pageIndex) => <article className="quote-docs-page" key={`page-${pageIndex}`}>
          <header className="quote-docs-page-header">
            <div className="quote-docs-page-header-top">
              <div className="quote-docs-page-brand">
                <span className="quote-docs-page-logo"><img src="/assets/images/logo-vr.svg" alt="" /></span>
                <div className="quote-docs-page-professional">
                  <span>PROPOSTA COMERCIAL</span>
                  <strong>{professional.name}</strong>
                  {professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}
                </div>
              </div>
              {headerDetails.length ? <div className="quote-docs-page-contact">{headerDetails.map((detail) => <small key={detail}>{detail}</small>)}</div> : null}
            </div>
          </header>
          <div className="quote-docs-page-content">
            {pageIndex === 0 ? <h2 className="quote-docs-document-title">{quoteTitle}</h2> : null}
            {page.blocks.map((block) => <EditableBlock key={block.id} block={block} onActivate={() => setActiveBlockId(block.id)} onInput={(text) => updateDisplayBlockText(block, text)} onCommit={() => commitBlock(block)} onRemove={() => removeBlock(block.sourceId ?? block.id)} command={activeBlockId === block.id && block.type === "rich-text" ? richTextCommand : null} />)}
          </div>
          <footer>{pageIndex === pages.length - 1 && footerDetails ? <span className="quote-docs-page-footer-details">{footerDetails}</span> : <span />}{pageIndex + 1} / {pages.length}</footer>
        </article>)}
      </div>
    </section>
  </form>;
}
