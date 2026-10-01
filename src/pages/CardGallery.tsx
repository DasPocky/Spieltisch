import type { ReactNode } from "react";
import { DECKS, fullDeck } from "@shared/cards/deck";
import { CARDS } from "@shared/games/tutto/cards";
import { buildDeck as unoDeck } from "@shared/games/uno/logic";
import { buildDeck as f7Deck } from "@shared/games/flip7/logic";
import { UnoBack, UnoCardView } from "@/games/uno/Board";
import { SbCardView } from "@/games/skipbo/Board";
import { SkCard } from "@/games/skyjo/Board";
import { P10CardView } from "@/games/phase10/Board";
import { Tile } from "@/games/flip7/Board";
import { CardFace } from "@/games/tutto/CardFace";
import { PlayingCard } from "@/platform/cards/PlayingCard";

/** Nur für die Entwicklung: alle Karten aller Spiele auf einen Blick – groß, klein und im Fächer */
const uniq = <T,>(a: T[]) => [...new Set(a)];

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1 text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-end gap-1.5">{children}</div>
    </section>
  );
}

function Fan({ children }: { children: ReactNode[] }) {
  return <div className="fan flex items-end [--fan-ml:-45%]">{children.map((c, i) => <div key={i} className="w-12 shrink-0" style={{ marginLeft: i ? "-1.4rem" : 0 }}>{c}</div>)}</div>;
}

export function CardGallery() {
  const uno = uniq(unoDeck());
  const p10 = [...["r", "b", "g", "y"].flatMap((c) => [1, 5, 9, 10, 11, 12].map((n) => `${c}-${n}`)), "W", "S"];
  const sb = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const sky = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const f7 = uniq([...f7Deck("classic"), ...f7Deck("fies")]);
  return (
    <main className="min-h-dvh bg-background p-3 text-foreground" data-testid="gallery">
      <Row title="Uno groß">{uno.map((c) => <div key={c} className="w-16"><UnoCardView card={c} /></div>)}<div className="w-16"><UnoBack count={93} /></div></Row>
      <Row title="Uno klein / Fächer / gedimmt"><Fan>{uno.slice(0, 14).map((c) => <UnoCardView key={c} card={c} />)}</Fan><Fan>{uno.slice(-8).map((c) => <UnoCardView key={c} card={c} dim />)}</Fan></Row>
      <Row title="Skip-Bo">{sb.map((c) => <div key={c} className="w-14"><SbCardView card={c} /></div>)}<div className="w-14"><SbCardView card={0} shown={7} /></div><div className="w-8"><SbCardView card={5} small /></div><div className="w-8"><SbCardView card={0} small /></div></Row>
      <Row title="Skyjo">{sky.map((v) => <div key={v} className="aspect-[5/7] w-14"><SkCard cell={{ v, up: true }} /></div>)}<div className="aspect-[5/7] w-14"><SkCard cell={{ v: 3, up: false }} /></div></Row>
      <Row title="Skyjo klein">{sky.map((v) => <div key={v} className="aspect-[5/7] w-6"><SkCard cell={{ v, up: true }} small /></div>)}<div className="aspect-[5/7] w-6"><SkCard cell={{ v: 3, up: false }} small /></div></Row>
      <Row title="Phase 10">{p10.map((c) => <div key={c} className="w-12"><P10CardView card={c} /></div>)}</Row>
      <Row title="Phase 10 Fächer"><Fan>{p10.slice(0, 12).map((c) => <P10CardView key={c} card={c} />)}</Fan><Fan>{["r-10", "b-11", "g-12", "y-11", "W", "S"].map((c) => <P10CardView key={c} card={c} dim />)}</Fan></Row>
      <Row title="Flip 7">{f7.map((c) => <Tile key={c} card={c} />)}</Row>
      <Row title="Tutto">{CARDS.map((c) => <div key={c.name} className="aspect-[5/7] w-24"><CardFace card={c} /></div>)}</Row>
      <Row title="Spielkarten FR / DE">{[...fullDeck(DECKS.fr32).slice(0, 8), ...fullDeck(DECKS.de32).filter((_, i) => i % 4 === 0)].map((c) => <div key={c} className="w-12"><PlayingCard card={c} /></div>)}</Row>
    </main>
  );
}
