/** Symbol für Spielauswahl und Kopfzeile – klein, damit es ohne das ganze Spiel geladen werden kann */
export function Icon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <ellipse cx="20" cy="33" rx="17" ry="5" fill="#e9dcc4" />
      <ellipse cx="20" cy="32" rx="13" ry="3.6" fill="none" stroke="#a84a57" strokeOpacity="0.5" strokeWidth="1" />
      <path d="M6 4 H20 L22.5 27 Q22.5 30 20 30 H6 Q3.5 30 3.5 27 Z" fill="#2c5aa6" transform="rotate(-8 13 17)" />
      <rect x="5" y="2.5" width="16" height="4" rx="2" fill="#86aee8" transform="rotate(-8 13 17)" />
      {[[22, 18], [29, 23], [22, 25.5]].map(([x, y], i) => (
        <g key={i} transform={`rotate(${[10, -12, 4][i]} ${x + 4} ${y + 4})`}>
          <rect x={x} y={y} width="8.5" height="8.5" rx="2" fill="#fdfdfb" stroke="#1f437f" strokeOpacity="0.25" strokeWidth="0.5" />
          <circle cx={x + 4.25} cy={y + 4.25} r="1.4" fill={i === 1 ? "#1f437f" : "#a84a57"} />
        </g>
      ))}
    </svg>
  );
}
