/**
 * Shared keystroke token helpers. Solution strings are written in a
 * Vim/tmux-style notation (`<C-w>`, `<CR>`, `<Space>`, `<Up>`) and split into
 * individual input tokens that a tool's reducer understands.
 */

const TOKEN_RE = /<[^>]+>|[\s\S]/g;

const NAMED: Record<string, string> = {
  "<Esc>": "Escape",
  "<C-r>": "ctrl+r",
  "<C-w>": "ctrl+w",
  "<C-b>": "ctrl+b",
  "<C-a>": "ctrl+a",
  "<C-d>": "ctrl+d",
  "<Tab>": "Tab",
  "<Enter>": "Enter",
  "<CR>": "Enter",
  "<BS>": "Backspace",
  "<Space>": " ",
  "<Up>": "ArrowUp",
  "<Down>": "ArrowDown",
  "<Left>": "ArrowLeft",
  "<Right>": "ArrowRight",
};

/** Split a canonical solution string into individual input tokens. */
export function parseKeys(s: string): string[] {
  const tokens = s.match(TOKEN_RE) ?? [];
  return tokens.map((t) => NAMED[t] ?? t);
}

/** Number of physical keystrokes a canonical solution needs. */
export function solutionLength(s: string): number {
  return (s.match(TOKEN_RE) ?? []).length;
}
