import { FruitShape } from "./Fruit";

/** Symbol: Obstkarte mit Klingel davor */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="4" y="3" width="17" height="23" rx="2.5" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.2" transform="rotate(-10 12.5 14.5)" />
      <g transform="rotate(-10 12.5 14.5)"><FruitShape fruit="banane" x={6.5} y={4.5} size={9} /><FruitShape fruit="banane" x={10.5} y={14} size={9} /></g>
      <rect x="18" y="4" width="17" height="23" rx="2.5" fill="#fffdf8" stroke="#2b2118" strokeWidth="1.2" transform="rotate(8 26.5 15.5)" />
      <g transform="rotate(8 26.5 15.5)"><FruitShape fruit="erdbeere" x={20.5} y={9} size={12} /></g>
      <ellipse cx="20" cy="37" rx="15" ry="2" fill="#000" opacity="0.2" />
      <rect x="6" y="32" width="28" height="4.5" rx="2.2" fill="#3a2a1e" />
      <path d="M8.5 32c0-8 5-12.5 11.5-12.5S31.5 24 31.5 32z" fill="#f2c84b" stroke="#8a6414" strokeWidth="1" />
      <rect x="18.3" y="16" width="3.4" height="3.8" rx="1" fill="#3a2a1e" />
      <path d="M12.5 27.5c1-3 3-4.8 5.5-5.4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
