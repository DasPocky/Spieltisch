/** Symbol für Spielauswahl und Kopfzeile – ein Blatt mit vier Farbreihen und Kreuzen, davor ein Würfel */
export function Icon({ className }: { className?: string }) {
  const rows = ["#c8453d", "#e3b23c", "#3f8a57", "#2f5fa8"];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="4" width="30" height="27" rx="3" fill="#fbf7ef" stroke="#1f2a44" strokeOpacity="0.2" strokeWidth="0.8" transform="rotate(-6 18 17)" />
      <g transform="rotate(-6 18 17)">
        {rows.map((c, i) => (
          <g key={c}>
            <rect x="5" y={6.5 + i * 6} width="26" height="4.8" rx="1.2" fill={c} fillOpacity="0.9" />
            {[0, 1, 2].slice(0, 3 - (i % 2)).map((k) => (
              <path key={k} d={`M${7.2 + k * 4.4} ${7.6 + i * 6} l2.6 2.6 m0 -2.6 l-2.6 2.6`} stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
            ))}
          </g>
        ))}
      </g>
      <g transform="rotate(12 30 30)">
        <rect x="23" y="23" width="13" height="13" rx="3" fill="#fdfdfb" stroke="#1f2a44" strokeOpacity="0.3" strokeWidth="0.7" />
        {[[26.3, 26.3], [32.7, 32.7], [29.5, 29.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill="#1f2a44" />)}
      </g>
    </svg>
  );
}
