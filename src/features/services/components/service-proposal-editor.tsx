"use client";

import { useEffect, useRef } from "react";
import { parseRichText, serializeRichText, type RichTextDocument, type RichTextMark, type RichTextRun } from "@/lib/rich-text";

type Props = {
  name?: string;
  initialValue?: string | null;
  onChange?: (value: string | null) => void;
};

export type RichTextEditorCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "removeFormat";

type InlineEditorProps = {
  initialValue?: string | null;
  onChange: (value: string | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  command?: { id: number; value: RichTextEditorCommand } | null;
  ariaLabel: string;
  className?: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function runsToHtml(runs: RichTextRun[]) {
  return runs.map((run) => {
    let value = escapeHtml(run.text).replace(/\n/g, "<br>");
    if (run.underline) value = `<u>${value}</u>`;
    if (run.italic) value = `<em>${value}</em>`;
    if (run.bold) value = `<strong>${value}</strong>`;
    return value;
  }).join("");
}

function documentToHtml(document: RichTextDocument) {
  return document.blocks.map((block) => {
    if (block.type === "paragraph") return `<p>${runsToHtml(block.runs)}</p>`;
    const tag = block.type === "bullet-list" ? "ul" : "ol";
    return `<${tag}>${block.items.map((item) => `<li>${runsToHtml(item)}</li>`).join("")}</${tag}>`;
  }).join("");
}

function sameMarks(left: RichTextMark, right: RichTextMark) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline;
}

function addRun(runs: RichTextRun[], text: string, marks: RichTextMark) {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous && sameMarks(previous, marks)) {
    previous.text += text;
    return;
  }
  runs.push({ text, ...marks });
}

function runsFromNodes(nodes: NodeListOf<ChildNode> | ChildNode[], marks: RichTextMark = {}) {
  const runs: RichTextRun[] = [];
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      addRun(runs, node.textContent ?? "", marks);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === "BR") {
      addRun(runs, "\n", marks);
      continue;
    }
    const style = node.style;
    const nextMarks: RichTextMark = {
      bold: marks.bold || node.tagName === "B" || node.tagName === "STRONG" || Number(style.fontWeight) >= 600,
      italic: marks.italic || node.tagName === "I" || node.tagName === "EM" || style.fontStyle === "italic",
      underline: marks.underline || node.tagName === "U" || style.textDecoration.includes("underline"),
    };
    const nested = runsFromNodes(node.childNodes, nextMarks);
    for (const run of nested) addRun(runs, run.text, run);
  }
  return runs;
}

function documentFromEditor(root: HTMLElement): RichTextDocument {
  const blocks: RichTextDocument["blocks"] = [];
  const inlineNodes: ChildNode[] = [];
  const appendInlineParagraph = () => {
    const runs = runsFromNodes(inlineNodes);
    inlineNodes.length = 0;
    if (runs.length) blocks.push({ type: "paragraph", runs });
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && node.tagName === "BR")) {
      inlineNodes.push(node);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    appendInlineParagraph();
    if (node.tagName === "UL" || node.tagName === "OL") {
      const items = Array.from(node.children)
        .filter((item) => item.tagName === "LI")
        .map((item) => runsFromNodes(item.childNodes))
        .filter((item) => item.length);
      if (items.length) blocks.push({ type: node.tagName === "UL" ? "bullet-list" : "ordered-list", items });
      continue;
    }
    const runs = runsFromNodes(node.childNodes);
    if (runs.length) blocks.push({ type: "paragraph", runs });
  }
  appendInlineParagraph();
  return { version: 1, blocks };
}

export function InlineRichTextEditor({ initialValue, onChange, onFocus, onBlur, command, ariaLabel, className }: InlineEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialDocumentRef = useRef<RichTextDocument | null>(null);
  const lastCommandIdRef = useRef(0);
  if (!initialDocumentRef.current) initialDocumentRef.current = parseRichText(initialValue);
  const initialDocument = initialDocumentRef.current;

  function syncValue() {
    const editor = editorRef.current;
    if (!editor) return;
    const value = serializeRichText(documentFromEditor(editor));
    onChange(value);
  }

  useEffect(() => {
    if (!command || command.id === lastCommandIdRef.current || document.activeElement !== editorRef.current) return;
    lastCommandIdRef.current = command.id;
    document.execCommand(command.value, false);
    syncValue();
  }, [command]);

  return <div ref={editorRef} className={className} role="textbox" aria-multiline="true" aria-label={ariaLabel} contentEditable suppressContentEditableWarning spellCheck onFocus={onFocus} onBlur={onBlur} onInput={syncValue} dangerouslySetInnerHTML={{ __html: documentToHtml(initialDocument) }} />;
}

export function ServiceProposalEditor({ name, initialValue, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenFieldRef = useRef<HTMLInputElement>(null);
  const initialDocumentRef = useRef<RichTextDocument | null>(null);
  if (!initialDocumentRef.current) initialDocumentRef.current = parseRichText(initialValue);
  const initialDocument = initialDocumentRef.current;
  const initialValueRef = useRef(serializeRichText(initialDocument) ?? "");

  function applyCommand(command: RichTextEditorCommand) {
    const editor = containerRef.current?.querySelector<HTMLDivElement>(".service-proposal-content");
    editor?.focus();
    document.execCommand(command, false);
    if (!editor) return;
    const value = serializeRichText(documentFromEditor(editor));
    if (hiddenFieldRef.current) hiddenFieldRef.current.value = value ?? "";
    onChange?.(value);
  }

  function syncValue(value: string | null) {
    if (hiddenFieldRef.current) hiddenFieldRef.current.value = value ?? "";
    onChange?.(value);
  }

  return <div ref={containerRef} className="service-proposal-editor" data-editor="service-proposal">
    {name ? <input ref={hiddenFieldRef} type="hidden" name={name} defaultValue={initialValueRef.current} /> : null}
    <div className="service-proposal-toolbar" role="toolbar" aria-label="Formatação da descrição da proposta">
      <button type="button" title="Negrito" aria-label="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("bold")}><strong>N</strong></button>
      <button type="button" title="Itálico" aria-label="Itálico" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("italic")}><em>I</em></button>
      <button type="button" title="Sublinhado" aria-label="Sublinhado" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("underline")}><u>S</u></button>
      <span aria-hidden="true" />
      <button type="button" title="Lista com marcadores" aria-label="Lista com marcadores" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertUnorderedList")}>LISTA</button>
      <button type="button" title="Lista numerada" aria-label="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertOrderedList")}>1.</button>
      <span aria-hidden="true" />
      <button type="button" title="Limpar formatação" aria-label="Limpar formatação" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("removeFormat")}>LIMPAR</button>
    </div>
    <InlineRichTextEditor initialValue={initialValue} onChange={syncValue} ariaLabel="Descrição que será exibida no PDF" className="service-proposal-content" />
  </div>;
}
