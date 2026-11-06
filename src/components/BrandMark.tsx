/** Servo's mark: a square black tile carrying a white robot head with a visor slot cut through it.
    Decorative; the wordmark carries the name. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect width="36" height="36" rx="2" fill="var(--mark-bg, #000000)" />
      {/* Antenna, head, visor slot and neck */}
      <path d="M18 6.5v3.2" stroke="var(--mark-ink, #f2f4f7)" strokeWidth="1.8" strokeLinecap="square" />
      <rect x="16.4" y="4.6" width="3.2" height="3.2" fill="var(--mark-ink, #f2f4f7)" />
      <path d="M11 10.5h14a2 2 0 0 1 2 2v9.4a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-9.4a2 2 0 0 1 2-2Z" fill="var(--mark-ink, #f2f4f7)" />
      <rect className="brand-mark__visor" x="11.6" y="15.2" width="12.8" height="2.6" fill="var(--mark-bg, #000000)" />
      <path d="M14.6 25.4h6.8l1.4 4.1h-9.6l1.4-4.1Z" fill="var(--mark-ink, #f2f4f7)" />
    </svg>
  )
}
