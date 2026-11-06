import type { CSSProperties, ImgHTMLAttributes } from 'react'
import { asset } from '../lib/asset'

/**
 * Responsive photo: AVIF and WebP at several widths (made by `npm run images` into public/images/r/,
 * listed in src/generated/images.json) with the original JPG as the fallback. Without a manifest entry it
 * is a plain <img>. The <picture> wrapper is `display: contents`, so the <img> lays out (and is styled)
 * exactly as if it stood alone.
 */
interface Entry {
  w: number
  h: number
  widths: number[]
}

const files = import.meta.glob<Record<string, Entry>>('../generated/images.json', { eager: true, import: 'default' })
const MANIFEST: Record<string, Entry> = Object.values(files)[0] ?? {}

/** "images/unitree-g1-sm.jpg" → "unitree-g1" (the small copy shares its full photo's sources) */
// <source> children of a display: contents <picture> would otherwise be laid out as empty grid/flex items
const HIDDEN: CSSProperties = { display: 'none' }

export function imageKey(src: string): string {
  return src
    .replace(/^\/?(?:images\/)?/, '')
    .replace(/\.(?:jpe?g|png|webp)$/i, '')
    .replace(/-sm$/, '')
}

/** srcset for one format, or null when the photo has no responsive copies */
export function srcSetFor(src: string, format: 'avif' | 'webp'): string | null {
  const key = imageKey(src)
  const e = MANIFEST[key]
  return e ? e.widths.map((w) => `/images/r/${key}-${w}.${format} ${w}w`).join(', ') : null
}

export const imageSize = (src: string): { w: number; h: number } | null => {
  const e = MANIFEST[imageKey(src)]
  return e ? { w: e.w, h: e.h } : null
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  alt: string
  /** How wide the photo is drawn, for the browser to pick a file (default: the full viewport) */
  sizes?: string
  /** Above-the-fold hero: load eagerly at high priority */
  priority?: boolean
  style?: CSSProperties
}

export function Picture({ src, alt, sizes = '100vw', priority = false, loading, width, height, ...rest }: Props) {
  const url = asset(src)
  const entry = MANIFEST[imageKey(src)]
  const img = (
    <img
      src={url}
      alt={alt}
      width={width ?? entry?.w}
      height={height ?? entry?.h}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      {...rest}
    />
  )
  if (!entry) return img
  return (
    <picture style={{ display: 'contents' }}>
      <source type="image/avif" srcSet={srcSetFor(src, 'avif')!} sizes={sizes} style={HIDDEN} />
      <source type="image/webp" srcSet={srcSetFor(src, 'webp')!} sizes={sizes} style={HIDDEN} />
      {img}
    </picture>
  )
}
