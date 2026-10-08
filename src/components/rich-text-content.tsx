import { parseRichText, type RichTextRun } from "@/lib/rich-text";

function InlineRuns({ runs }: { runs: RichTextRun[] }) {
  return <>{runs.map((run, index) => <span key={`${index}-${run.text.slice(0, 12)}`} style={{ fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? "italic" : undefined, textDecoration: run.underline ? "underline" : undefined }}>{run.text}</span>)}</>;
}

/** Renders only the application's structured rich text; it never injects stored HTML. */
export function RichTextContent({ value, className }: { value?: string | null; className?: string }) {
  const document = parseRichText(value);
  if (!document.blocks.length) return null;

  return <div className={className}>
    {document.blocks.map((block, index) => {
      if (block.type === "paragraph") return <p key={`paragraph-${index}`}><InlineRuns runs={block.runs} /></p>;
      const List = block.type === "bullet-list" ? "ul" : "ol";
      return <List key={`${block.type}-${index}`}>{block.items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}><InlineRuns runs={item} /></li>)}</List>;
    })}
  </div>;
}
