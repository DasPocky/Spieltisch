const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** Ein Würfel als SVG – Papierweiß mit marineblauen Augen, die Eins rot. */
export function Die({ value, className }: { value: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-label={`Würfel ${value}`} role="img">
      <rect x="3" y="3" width="94" height="94" rx="20" fill="#fdfdfb" />
      {PIPS[value]?.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9.5" fill={value === 1 ? "#a84a57" : "#16305e"} />)}
    </svg>
  );
}
