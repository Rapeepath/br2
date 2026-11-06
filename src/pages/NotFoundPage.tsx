import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useLang, useT } from '../i18n'
import { useTitle } from '../lib/a11y'

/* A dead end on the dark showroom stage: the error code set large and light, the message, one way home */
export function NotFoundPage() {
  const t = useT()
  const lang = useLang()
  useTitle(t('notFound.title'))
  return (
    <section className="stage end-band on-navy" style={{ display: 'grid', alignItems: 'center', minHeight: 'min(78svh, 720px)' }}>
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <p
          className="figure-display"
          aria-hidden="true"
          style={{
            color: 'var(--on-navy-muted)',
            fontSize: 'clamp(4.5rem, 2rem + 10vw, 10rem)',
            fontWeight: 300,
            lineHeight: 0.9,
          }}
        >
          404
        </p>
        {/* Two whole phrases, so a narrow screen breaks it as "ไม่พบหน้า / ที่ต้องการ", never after "ไม่พบ" */}
        <h1 style={{ marginTop: 'var(--space-5)', fontSize: 'var(--fs-page)' }}>
          <span className="nowrap">{t('notFound.heading1')}</span>
          {lang === 'en' && ' '}
          <wbr />
          <span className="nowrap">{t('notFound.heading2')}</span>
        </h1>
        <p
          style={{
            maxWidth: '36ch',
            marginTop: 'var(--space-3)',
            color: 'var(--on-navy-muted)',
            fontSize: 'var(--fs-lg)',
          }}
        >
          {lang === 'en' ? (
            t('notFound.body')
          ) : (
            <>
              ลิงก์อาจไม่ถูกต้อง หรือ<wbr />
              <span className="nowrap">รุ่นนี้</span>
              <wbr />
              ไม่มีใน<wbr />
              <span className="nowrap">แค็ตตาล็อก</span>
            </>
          )}
        </p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-6)' }}>
          <ArrowLeft size={18} aria-hidden />
          {t('notFound.home')}
        </Link>
      </div>
    </section>
  )
}
