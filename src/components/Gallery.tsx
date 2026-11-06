import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { useLang } from '../i18n'
import { langOf } from '../lib/a11y'
import { asset } from '../lib/asset'
import { pick } from '../lib/bilingual'
import { photoStyle } from '../lib/photo'
import type { ModelImage } from '../lib/types'
import { licenceUrl } from '../pages/SourcesPage.credits'
import { Picture } from './Picture'
import './Gallery.css'

/** One photo (or a video clip with its poster) in a model's gallery. */
export interface Slide {
  kind: 'image' | 'video'
  /** Full-size photo, or the video's poster */
  src: string
  srcSmall: string
  alt: string
  author: string
  license: string
  page: string
  focus?: string
  zoom?: number
  video?: { url: string; duration: number; start: number }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/**
 * The model's photos and clips: a strip of thumbnails that opens a lightbox (a native modal <dialog>):
 * arrows, Home and End move, Escape closes, a swipe moves on touch screens, and focus goes back to the
 * thumbnail that opened it. Clips never autoplay; they start where the robot appears.
 */
export function Gallery({ name, slides }: { name: string; slides: Slide[] }) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])
  const [index, setIndex] = useState(0)
  const [isOpen, setOpen] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const n = slides.length
  if (n === 0) return null
  const slide = slides[Math.min(index, n - 1)]

  const open = (i: number) => {
    setIndex(i)
    setOpen(true)
    const d = dialog.current
    if (!d || d.open) return
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
  }

  const close = () => {
    const d = dialog.current
    if (d?.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }

  // Native close (Escape, the close button, or close()): return to the thumbnail of the slide on show
  const onClose = () => {
    setOpen(false)
    thumbs.current[index]?.focus()
  }

  const go = (i: number) => setIndex(((i % n) + n) % n)

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    // A playing clip keeps its own arrow-key seeking
    if (e.target instanceof HTMLVideoElement) return
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(n - 1)
    else return
    e.preventDefault()
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') touch.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(index + (dx < 0 ? 1 : -1))
  }

  const deed = licenceUrl(slide.license)
  const credit = slide.kind === 'video' ? tx('วิดีโอ', 'Video') : tx('ภาพ', 'Photo')

  return (
    <section className="gal" aria-labelledby={`${id}-title`}>
      <div className="gal__head">
        <h2 id={`${id}-title`} className="gal__title">
          {tx('ภาพและวิดีโอ', 'Photos and video')}
        </h2>
        <p className="gal__meta">
          {tx(`${n} รายการ จาก Wikimedia Commons`, `${n} from Wikimedia Commons`)}
        </p>
      </div>

      <ul className="gal__strip">
        {slides.map((s, i) => (
          <li key={s.src}>
            <button
              type="button"
              className="gal__thumb"
              ref={(el) => {
                thumbs.current[i] = el
              }}
              onClick={() => open(i)}
            >
              <Picture src={s.srcSmall} alt="" sizes="(max-width: 560px) 45vw, 240px" style={photoStyle({ focus: s.focus, zoom: s.zoom } as ModelImage)} />
              {s.kind === 'video' && (
                <span className="gal__badge" aria-hidden="true">
                  <Play size={14} fill="currentColor" />
                  {s.video ? clock(s.video.duration) : tx('วิดีโอ', 'Video')}
                </span>
              )}
              <span className="visually-hidden">
                {s.kind === 'video' ? tx('เปิดวิดีโอ', 'Play video') : tx('เปิดภาพ', 'Open photo')} {i + 1} {tx('จาก', 'of')} {n}:{' '}
                {s.alt}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="gal__dialog"
        aria-label={tx(`ภาพและวิดีโอของ ${name}`, `Photos and video of ${name}`)}
        onClose={onClose}
        onCancel={() => setOpen(false)}
        onKeyDown={onKeyDown}
      >
        {isOpen && (
          <div className="gal__box">
            <div className="gal__frame" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              {slide.kind === 'video' && slide.video ? (
                <video
                  key={slide.src}
                  className="gal__media"
                  controls
                  playsInline
                  preload="none"
                  poster={asset(slide.src)}
                  aria-label={slide.alt}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget
                    if (slide.video && v.currentTime < slide.video.start) v.currentTime = slide.video.start
                  }}
                >
                  <source src={`${slide.video.url}#t=${slide.video.start}`} type="video/webm" />
                </video>
              ) : (
                <Picture key={slide.src} className="gal__media" src={slide.src} alt={slide.alt} sizes="100vw" loading="eager" />
              )}
            </div>

            <div className="gal__bar">
              <div className="gal__text">
                <p className="gal__caption" lang={langOf(slide.alt)}>
                  {slide.alt}
                </p>
                <p className="gal__credit">
                  {credit}: <span lang={langOf(slide.author)}>{slide.author}</span> (
                  {deed ? (
                    <a href={deed} target="_blank" rel="noopener noreferrer" lang="en">
                      {slide.license}
                    </a>
                  ) : (
                    <span lang="en">{slide.license}</span>
                  )}
                  ){' '}
                  <a href={slide.page} target="_blank" rel="noopener noreferrer">
                    {tx('ต้นฉบับ', 'Source')}
                    <span className="visually-hidden">{tx(' (เปิดในแท็บใหม่)', ' (opens in a new tab)')}</span>
                  </a>
                </p>
              </div>
              <div className="gal__nav">
                <button type="button" className="gal__btn" onClick={() => go(index - 1)} disabled={n < 2}>
                  <ChevronLeft size={20} aria-hidden />
                  <span className="visually-hidden">{tx('ภาพก่อนหน้า', 'Previous')}</span>
                </button>
                <p className="gal__counter" aria-live="polite">
                  {index + 1} / {n}
                </p>
                <button type="button" className="gal__btn" onClick={() => go(index + 1)} disabled={n < 2}>
                  <ChevronRight size={20} aria-hidden />
                  <span className="visually-hidden">{tx('ภาพถัดไป', 'Next')}</span>
                </button>
                <button type="button" className="gal__btn gal__btn--close" onClick={close}>
                  <X size={20} aria-hidden />
                  <span className="visually-hidden">{tx('ปิด', 'Close')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}
