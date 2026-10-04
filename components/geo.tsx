// Geometric motifs, drawn from the reference sheet:
// the four-circle bloom (page background), the bar–circle–half-disc (cards), and an Art Deco arc lattice (banners).

/** The iKare mark: an eye built from a square, a lens and a pupil. */
export function Mark({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" fill="var(--accent-deep)" />
      <path d="M4 18 Q18 4 32 18 Q18 32 4 18 Z" fill="var(--on-accent)" />
      <circle cx="18" cy="18" r="6" fill="#9f7e4a" />
      <circle cx="20.5" cy="15.5" r="1.8" fill="var(--on-accent)" />
    </svg>
  );
}

/** One large bloom: four translucent circles whose overlaps darken toward the centre. */
function Bloom({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 340 330" className={className} style={style} aria-hidden="true">
      <g style={{ fillOpacity: "var(--bloom)" }}>
        <circle cx="170" cy="100" r="100" fill="#9f7e4a" />
        <circle cx="100" cy="165" r="100" fill="#394032" />
        <circle cx="240" cy="165" r="100" fill="#534332" />
        <circle cx="170" cy="230" r="100" fill="#797f3e" />
      </g>
    </svg>
  );
}

/** Two blooms spanning the page behind everything: one from the top-left, one from the bottom-right. */
export function BloomBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Bloom
        className="absolute"
        style={{ width: "min(110vw, 900px)", left: "max(-30vw, -260px)", top: "max(-22vw, -200px)" }}
      />
      <Bloom
        className="absolute rotate-45"
        style={{ width: "min(95vw, 760px)", right: "max(-28vw, -220px)", bottom: "max(-24vw, -200px)" }}
      />
    </div>
  );
}

/** Card corner: a bar, a circle cut out of it, and a half-disc (reference #9). */
export function CardMotif({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 40" className={`h-12 w-[68px] ${className}`} aria-hidden="true">
      <path d="M32 0 A20 20 0 0 1 32 40 Z" fill="var(--bark)" />
      <rect width="32" height="40" fill="var(--accent-deep)" />
      <circle cx="32" cy="20" r="12" fill="var(--paper)" />
      <circle cx="32" cy="20" r="4" fill="var(--ochre)" />
    </svg>
  );
}

/** Art Deco page banner: an arc lattice on forest with a solid ochre title box. */
export function PageBanner({
  eyebrow,
  title,
  children,
  align = "left",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  const right = align === "right";
  return (
    <section className="relative mb-8 overflow-hidden bg-brand-forest px-4 py-6 text-[#efe9d8] sm:px-8">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="deco" width="128" height="64" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#9f7e4a" strokeWidth="2">
              {/* left cell: quarter arcs from each corner make a four-point star */}
              <path d="M0 32 A32 32 0 0 0 32 0 M32 0 A32 32 0 0 0 64 32 M64 32 A32 32 0 0 0 32 64 M32 64 A32 32 0 0 0 0 32" />
              {/* right cell: a half circle facing left, on a bar */}
              <path d="M128 0 A32 32 0 0 0 128 64" />
              <path d="M64 0 V64" />
              <circle cx="96" cy="32" r="8" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#deco)" opacity="0.75" />
      </svg>
      <div className={`relative flex max-w-full flex-col ${right ? "items-end text-right" : "items-start"}`}>
        {eyebrow && <p className={`eyebrow mb-2 inline-block bg-brand-forest text-[#e5d6b6] ${right ? "pl-2 pr-1" : "pr-2"}`}>{eyebrow}</p>}
        <div className="w-fit max-w-full bg-brand-ochre px-6 py-4">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
        </div>
        {children && (
          <div className={`mt-2 w-fit max-w-full bg-brand-forest font-display text-lg italic text-[#efe9d8] ${right ? "pl-2 pr-1" : "pr-2"}`}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/** Section divider: circle — line — square. */
export function GeoRule({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`} aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-brand-moss" />
      <span className="h-px w-6 bg-ink/40" />
      <span className="h-2 w-2 bg-ochre" />
    </span>
  );
}

/** Empty-state illustration: a card motif and a clover, linked. */
export function EmptyArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 80" className={`h-20 w-48 ${className}`} aria-hidden="true">
      <line x1="48" y1="40" x2="152" y2="40" stroke="var(--ink)" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="4 4" />
      <path d="M40 16 A24 24 0 0 1 40 64 Z" fill="var(--bark)" />
      <rect x="8" y="16" width="32" height="48" fill="var(--accent-deep)" />
      <circle cx="40" cy="40" r="14" fill="var(--paper)" />
      <circle cx="40" cy="40" r="5" fill="var(--ochre)" />
      <rect x="88" y="32" width="16" height="16" fill="var(--ochre)" transform="rotate(45 96 40)" />
      <circle cx="142" cy="40" r="14" fill="#394032" />
      <circle cx="162" cy="40" r="14" fill="#454f2d" />
      <circle cx="152" cy="30" r="14" fill="#797f3e" fillOpacity="0.9" />
      <circle cx="152" cy="50" r="14" fill="#9f7e4a" fillOpacity="0.9" />
      <circle cx="152" cy="40" r="5" fill="#534332" />
    </svg>
  );
}
