import type { Mode } from "@/lib/tools/vim/engine/types";

export interface Cell {
  ch: string;
  key: string;
  isCursor: boolean;
  inSelection: boolean;
  isTarget: boolean;
  row: number;
  col: number;
}

interface VimBufferProps {
  lines: string[];
  row: number;
  col: number;
  mode: Mode;
  visualAnchor?: { row: number; col: number } | null;
  targetCursor?: { row: number; col: number } | null;
  showCursor?: boolean;
  filename?: string;
  echo?: string;
  tone?: "live" | "target";
  /** highlight the border to mark the focused split */
  active?: boolean;
  /** show a trailing `+` next to the filename */
  modified?: boolean;
  /** simulate a screen: rows outside [top, top+height) are dimmed */
  viewport?: { top: number; height: number };
}

const MODE_COLOR: Record<Mode, string> = {
  normal: "text-accent",
  insert: "text-green",
  visual: "text-orange",
  "visual-line": "text-orange",
  cmdline: "text-cyan",
};

const MODE_LABEL: Record<Mode, string> = {
  normal: "-- NORMAL --",
  insert: "-- INSERT --",
  visual: "-- VISUAL --",
  "visual-line": "-- V-LINE --",
  cmdline: "-- COMMAND --",
};

function selectionCells(
  mode: Mode,
  anchor: { row: number; col: number } | null | undefined,
  row: number,
  col: number,
): Set<string> {
  const out = new Set<string>();
  if ((mode !== "visual" && mode !== "visual-line") || !anchor) return out;
  const a = anchor;
  const from = a.row < row || (a.row === row && a.col <= col) ? a : { row, col };
  const to = a.row < row || (a.row === row && a.col <= col) ? { row, col } : a;
  if (mode === "visual-line") {
    for (let r = from.row; r <= to.row; r++) out.add(`${r}:-1`);
    return out;
  }
  for (let r = from.row; r <= to.row; r++) {
    const start = r === from.row ? from.col : 0;
    const end = r === to.row ? to.col : Number.MAX_SAFE_INTEGER;
    for (let c = start; c <= end; c++) out.add(`${r}:${c}`);
  }
  return out;
}

export default function VimBuffer({
  lines,
  row,
  col,
  mode,
  visualAnchor,
  targetCursor,
  showCursor = true,
  filename,
  echo,
  tone = "live",
  active = false,
  modified = false,
  viewport,
}: VimBufferProps) {
  const sel = selectionCells(mode, visualAnchor, row, col);
  const gutterWidth = String(lines.length).length;

  const cells: Cell[][] = lines.map((line, r) => {
    const lineCells: Cell[] = [];
    const length = line.length;
    for (let c = 0; c < length; c++) {
      lineCells.push({
        ch: line[c],
        key: `${r}:${c}`,
        isCursor: showCursor && r === row && c === col,
        inSelection: sel.has(`${r}:${c}`) || sel.has(`${r}:-1`),
        isTarget: !!targetCursor && r === targetCursor.row && c === targetCursor.col,
        row: r,
        col: c,
      });
    }
    // render a cursor sitting at the end of the line (insert mode)
    if (showCursor && r === row && col === length) {
      lineCells.push({
        ch: " ",
        key: `${r}:${col}`,
        isCursor: true,
        inSelection: false,
        isTarget: !!targetCursor && r === targetCursor.row && col === targetCursor.col,
        row: r,
        col: length,
      });
    }
    return lineCells;
  });

  // empty line still needs a cursor block
  if (showCursor && row < lines.length && lines[row] === "" && cells[row].length === 0) {
    cells[row].push({
      ch: " ",
      key: `${row}:0`,
      isCursor: true,
      inSelection: false,
      isTarget: !!targetCursor && targetCursor.row === row && targetCursor.col === 0,
      row,
      col: 0,
    });
  }

  return (
    <div
      className={`flex min-h-0 flex-col rounded-lg border bg-panel font-mono text-[13px] leading-6 ${
        active ? "border-accent/70" : "border-border"
      }`}
    >
      {filename ? (
        <div
          className={`flex items-center justify-between border-b px-3 py-1.5 text-[11px] text-muted ${
            active ? "border-accent/30" : "border-border"
          }`}
        >
          <span>
            {filename}
            {modified ? <span className="text-orange"> +</span> : null}
          </span>
          <span className={MODE_COLOR[mode] ?? "text-accent"}>{MODE_LABEL[mode]}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-x-auto px-2 py-2">
        {cells.map((lineCells, r) => {
          const offscreen = viewport !== undefined && (r < viewport.top || r >= viewport.top + viewport.height);
          return (
          <div
            key={r}
            className={`flex min-h-6 items-stretch ${offscreen ? "opacity-35" : ""}`}
          >
            <span
              className="mr-2 shrink-0 select-none pr-1 text-right text-muted/60 tabular-nums"
              style={{ minWidth: `${gutterWidth + 1}ch` }}
            >
              {r + 1}
            </span>
            <span className="whitespace-pre">
              {lineCells.length === 0 ? (
                <span className="inline-block h-6 min-w-2">&nbsp;</span>
              ) : (
                lineCells.map((cell) => {
                  let cls = "";
                  if (cell.isCursor) {
                    cls =
                      mode === "insert" && tone === "live"
                        ? "bg-transparent border-l-2 border-accent text-foreground"
                        : "bg-accent text-background";
                  } else if (cell.isTarget) {
                    cls = "bg-orange/25 text-orange";
                  } else if (cell.inSelection) {
                    cls = "bg-purple/30 text-foreground";
                  }
                  return (
                    <span key={cell.key} className={`inline-block min-w-[1ch] ${cls}`}>
                      {cell.ch === " " && !cls ? " " : cell.ch}
                    </span>
                  );
                })
              )}
            </span>
          </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[11px] text-muted">
        <span className={MODE_COLOR[mode] ?? "text-accent"}>{MODE_LABEL[mode]}</span>
        <span className="font-mono text-foreground/80">{echo ?? ""}</span>
      </div>
    </div>
  );
}
