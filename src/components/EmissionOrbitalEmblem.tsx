interface EmissionOrbitalEmblemProps {
  number: number | null;
  slug: string;
  compact?: boolean;
}

export function EmissionOrbitalEmblem({
  number,
  slug,
  compact = false,
}: EmissionOrbitalEmblemProps) {
  const seed = number ?? slug.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const angle1 = (seed * 37) % 360;
  const angle2 = (seed * 73 + 110) % 360;
  const ringRadius = 28 + (seed % 10);

  return (
    <div
      className="w-full h-full bg-gradient-to-br from-[#030925] via-[#0B224B] to-[#144980] relative flex items-center justify-center overflow-hidden select-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 160 120"
        className="w-full h-full opacity-90"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle
          cx="80"
          cy="60"
          r={ringRadius + 18}
          fill="none"
          stroke="#9ECAC2"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        <circle
          cx="80"
          cy="60"
          r={ringRadius}
          fill="none"
          stroke="#9ECAC2"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <ellipse
          cx="80"
          cy="60"
          rx="54"
          ry="20"
          fill="none"
          stroke="#9ECAC2"
          strokeOpacity="0.28"
          strokeWidth="1"
          transform={`rotate(${angle1} 80 60)`}
        />
        <circle
          cx={80 + Math.cos((angle2 * Math.PI) / 180) * ringRadius}
          cy={60 + Math.sin((angle2 * Math.PI) / 180) * ringRadius}
          r="2.5"
          fill="#9ECAC2"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <span
          className={`font-display font-bold tracking-tight text-[#FAF8F5] tabular-nums ${
            compact ? 'text-2xl' : 'text-3xl'
          }`}
        >
          {number ? `nº ${number}` : slug}
        </span>
      </div>
    </div>
  );
}
