/**
 * Steuern mit den Pfeiltasten (Fernbedienung am Fernseher, Tastatur am Rechner): der Fokus springt zum nächsten
 * bedienbaren Element in der gedrückten Richtung, Enter löst es aus (macht der Browser selbst).
 * In Eingabefeldern und Reglern bleiben die Pfeiltasten beim Feld.
 */
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const DIRS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** Elemente, die die Pfeiltasten selbst brauchen */
function keepsArrows(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["button", "submit", "checkbox", "radio"].includes(el.type);
  const role = el.getAttribute("role");
  return role === "slider" || role === "radio" || role === "tab" || role === "menuitem";
}

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.pointerEvents !== "none" && !el.closest("[aria-hidden='true'], [inert]");
}

/** Nächstes Ziel: in Richtung, nah, möglichst auf derselben Linie */
export function nextInDirection(from: DOMRect | null, dir: Dir, candidates: { el: HTMLElement; r: DOMRect }[]): HTMLElement | null {
  if (!from) return candidates[0]?.el ?? null;
  const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const { el, r } of candidates) {
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    // Abstand in der Hauptrichtung (Kante zu Kante, überlappend zählt als 0) – die Mitte muss in Richtung liegen
    const main = dir === "ArrowRight" ? r.left - from.right + 1 : dir === "ArrowLeft" ? from.left - r.right + 1 : dir === "ArrowDown" ? r.top - from.bottom + 1 : from.top - r.bottom + 1;
    if ((dir === "ArrowRight" && dx <= 0) || (dir === "ArrowLeft" && dx >= 0) || (dir === "ArrowDown" && dy <= 0) || (dir === "ArrowUp" && dy >= 0)) continue;
    const cross = dir === "ArrowRight" || dir === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
    const score = Math.max(0, main) + cross * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

/** Pfeiltasten-Steuerung einschalten – gibt eine Funktion zum Ausschalten zurück */
export function enableSpatialNav(root: Document = document): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!DIRS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    const active = root.activeElement as HTMLElement | null;
    if (keepsArrows(active)) return;
    // In einem offenen Dialog bleibt der Fokus im Dialog
    const scope = (root.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']") as HTMLElement | null) ?? root.body;
    const list = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el !== active && visible(el)).map((el) => ({ el, r: el.getBoundingClientRect() }));
    const from = active && active !== root.body && scope.contains(active) ? active.getBoundingClientRect() : null;
    const next = nextInDirection(from, e.key as Dir, list);
    if (!next) return;
    e.preventDefault();
    next.focus({ preventScroll: false });
  };
  root.addEventListener("keydown", onKey);
  return () => root.removeEventListener("keydown", onKey);
}
