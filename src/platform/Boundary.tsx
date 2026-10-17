import { Component, type ReactNode } from "react";

/** Fängt Fehler beim Zeichnen ab und zeigt stattdessen `fallback` – z. B. ein Spiel, das sich beim Zuschauen nicht anzeigen lässt */
export class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
