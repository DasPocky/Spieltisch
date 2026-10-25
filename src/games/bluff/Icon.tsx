/** Symbol für Spielauswahl und Kopfzeile – zwei Becher, einer angehoben, davor Würfel */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <ellipse cx="20" cy="34" rx="18" ry="4.5" fill="#e9dcc4" />
      <path d="M4 12 H15 L17 31 Q17 33 15 33 H4 Q2 33 2 31 Z" fill="#a84a57" />
      <rect x="3" y="10.5" width="13" height="3.2" rx="1.6" fill="#d98c96" />
      <g transform="rotate(18 30 12)">
        <path d="M23 2 H34 L36 21 Q36 23 34 23 H23 Q21 23 21 21 Z" fill="#2c5aa6" />
        <rect x="22" y="0.5" width="13" height="3.2" rx="1.6" fill="#86aee8" />
      </g>
      {[[20, 26], [27.5, 27]].map(([x, y], i) => (
        <g key={i} transform={`rotate(${[-8, 10][i]} ${x + 3.5} ${y + 3.5})`}>
          <rect x={x} y={y} width="7" height="7" rx="1.6" fill="#fdfdfb" stroke="#1f437f" strokeOpacity="0.25" strokeWidth="0.5" />
          <circle cx={x + 3.5} cy={y + 3.5} r="1.2" fill={i ? "#1f437f" : "#a84a57"} />
        </g>
      ))}
    </svg>
  );
}
