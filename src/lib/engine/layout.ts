import type { SplitNode } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Assign every leaf window a normalized rectangle within the layout. */
export function computeRects(layout: SplitNode): Map<number, Rect> {
  const out = new Map<number, Rect>();
  walk(layout, { x: 0, y: 0, w: 1, h: 1 }, out);
  return out;
}

function walk(node: SplitNode, rect: Rect, out: Map<number, Rect>): void {
  if (node.kind === "leaf") {
    out.set(node.windowId, rect);
    return;
  }
  const n = node.children.length || 1;
  if (node.dir === "row") {
    let x = rect.x;
    const w = rect.w / n;
    for (const child of node.children) {
      walk(child, { x, y: rect.y, w, h: rect.h }, out);
      x += w;
    }
  } else {
    let y = rect.y;
    const h = rect.h / n;
    for (const child of node.children) {
      walk(child, { x: rect.x, y, w: rect.w, h }, out);
      y += h;
    }
  }
}

export function allWindowIds(layout: SplitNode): number[] {
  if (layout.kind === "leaf") return [layout.windowId];
  return layout.children.flatMap(allWindowIds);
}

/**
 * Split `targetId` in direction `dir`, inserting `newId`.
 * New windows are placed before the target (left for `row`, top for `col`),
 * matching Vim's default `nosplitright` / `nosplitbelow`. Same-direction
 * splits flatten into the existing row/column.
 */
export function splitWindow(
  layout: SplitNode,
  targetId: number,
  dir: "row" | "col",
  newId: number,
): SplitNode {
  function rec(node: SplitNode): SplitNode | null {
    if (node.kind === "leaf") {
      if (node.windowId === targetId) {
        return {
          kind: "split",
          dir,
          children: [
            { kind: "leaf", windowId: newId },
            { kind: "leaf", windowId: targetId },
          ],
        };
      }
      return node;
    }
    const idx = node.children.findIndex((c) => c.kind === "leaf" && c.windowId === targetId);
    if (idx !== -1 && node.dir === dir) {
      const children = [...node.children];
      children.splice(idx, 0, { kind: "leaf", windowId: newId });
      return { ...node, children };
    }
    const children = [...node.children];
    let changed = false;
    for (let i = 0; i < children.length; i++) {
      const res = rec(children[i]);
      if (res && res !== children[i]) {
        children[i] = res;
        changed = true;
        break;
      }
    }
    return changed ? { ...node, children } : node;
  }
  return rec(layout) ?? layout;
}

/** Remove a window; collapse single-child splits. Returns null when empty. */
export function removeWindow(layout: SplitNode, id: number): SplitNode | null {
  function rec(node: SplitNode): SplitNode | null {
    if (node.kind === "leaf") return node.windowId === id ? null : node;
    const children = node.children
      .map((c) => rec(c))
      .filter((c): c is SplitNode => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { ...node, children };
  }
  return rec(layout);
}

export type MoveDir = "h" | "j" | "k" | "l";

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/** Geometry-based window movement, like `<C-w>h/j/k/l`. */
export function moveWindow(layout: SplitNode, fromId: number, dir: MoveDir): number {
  const rects = computeRects(layout);
  const cur = rects.get(fromId);
  if (!cur) return fromId;
  const cx = cur.x + cur.w / 2;
  const cy = cur.y + cur.h / 2;
  const eps = 1e-6;

  let best: number | null = null;
  let bestPrimary = Infinity;
  let bestSecondary = -1;

  for (const [id, r] of rects) {
    if (id === fromId) continue;
    let inDirection = false;
    let primary = 0;
    let secondary = 0;

    if (dir === "h") {
      inDirection = r.x + r.w <= cur.x + eps;
      primary = cur.x - (r.x + r.w);
      secondary = overlap(cur.y, cur.y + cur.h, r.y, r.y + r.h);
    } else if (dir === "l") {
      inDirection = r.x >= cur.x + cur.w - eps;
      primary = r.x - (cur.x + cur.w);
      secondary = overlap(cur.y, cur.y + cur.h, r.y, r.y + r.h);
    } else if (dir === "k") {
      inDirection = r.y + r.h <= cur.y + eps;
      primary = cur.y - (r.y + r.h);
      secondary = overlap(cur.x, cur.x + cur.w, r.x, r.x + r.w);
    } else {
      inDirection = r.y >= cur.y + cur.h - eps;
      primary = r.y - (cur.y + cur.h);
      secondary = overlap(cur.x, cur.x + cur.w, r.x, r.x + r.w);
    }
    if (!inDirection) continue;
    if (primary < bestPrimary - eps || (Math.abs(primary - bestPrimary) <= eps && secondary > bestSecondary)) {
      best = id;
      bestPrimary = primary;
      bestSecondary = secondary;
    }
  }

  // Fallback: nearest window whose center lies in the direction.
  if (best === null) {
    let dist = Infinity;
    for (const [id, r] of rects) {
      if (id === fromId) continue;
      const dx = r.x + r.w / 2 - cx;
      const dy = r.y + r.h / 2 - cy;
      let ok = false;
      let d = 0;
      if (dir === "h" && dx < -eps) {
        ok = true;
        d = -dx + Math.abs(dy);
      } else if (dir === "l" && dx > eps) {
        ok = true;
        d = dx + Math.abs(dy);
      } else if (dir === "k" && dy < -eps) {
        ok = true;
        d = -dy + Math.abs(dx);
      } else if (dir === "j" && dy > eps) {
        ok = true;
        d = dy + Math.abs(dx);
      }
      if (ok && d < dist) {
        dist = d;
        best = id;
      }
    }
  }

  return best ?? fromId;
}

export function cycleWindow(layout: SplitNode, fromId: number, reverse = false): number {
  const ids = allWindowIds(layout);
  if (ids.length <= 1) return fromId;
  const i = ids.indexOf(fromId);
  if (i === -1) return ids[0];
  const next = reverse ? (i - 1 + ids.length) % ids.length : (i + 1) % ids.length;
  return ids[next];
}
