import type { ReactNode } from "react";

const KEY_TOKEN_RE = /<[A-Za-z0-9-]+>/g;

function renderKeys(text: string): ReactNode[] {
  const parts = text.split(KEY_TOKEN_RE);
  const tokens = text.match(KEY_TOKEN_RE) ?? [];
  return parts.map((part, i) => {
    const token = tokens[i];
    return (
      <>
        {part}
        {token && (
          <code
            key={i}
            className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan"
          >
            {token}
          </code>
        )}
      </>
    );
  });
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function renderTagline(text: string): ReactNode {
  return <span className="font-mono text-sm text-muted">{renderKeys(text)}</span>;
}

export default function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => line.trim().startsWith("- "));
        if (isList) {
          return (
            <ul key={bi} className="flex flex-col gap-1.5 pl-1">
              {lines.map((line, li) => (
                <li key={li} className="relative pl-4 text-sm text-foreground/90">
                  <span className="absolute left-0 top-0 text-accent">›</span>
                  {renderInline(line.replace(/^\s*- /, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="text-sm leading-relaxed text-foreground/90">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}
