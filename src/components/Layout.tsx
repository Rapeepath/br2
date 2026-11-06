import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Bot, ClipboardCheck, Columns3, LibraryBig, MapPin, MessageCircle, Moon, Phone, Sun } from 'lucide-react'
import { market } from '../data'
import { localePath, useLang, useT, type DictKey } from '../i18n'
import { useCompare } from '../lib/compare'
import { formatMonthTh } from '../lib/format'
import { useStoreInfo } from '../lib/live'
import { hoursSummary, telHref } from '../lib/localeFormat'
import { useScrolled } from '../lib/motion'
import { useRouteMeta } from '../lib/seo'
import { useTheme } from '../lib/theme'
import { BrandMark } from './BrandMark'
import { CompareTray } from './CompareTray'
import './Layout.css'

// Icons only show on phones, where the menu becomes an icon-over-label tab row (see Layout.css)
const NAV: { to: string; label: DictKey; end: boolean; Icon: typeof Bot }[] = [
  { to: '/', label: 'nav.models', end: true, Icon: Bot },
  { to: '/compare', label: 'nav.compare', end: false, Icon: Columns3 },
  { to: '/guide', label: 'nav.guide', end: false, Icon: ClipboardCheck },
  { to: '/sources', label: 'nav.sources', end: false, Icon: LibraryBig },
]

// The showroom's own pages, listed in the footer (copy kept here rather than in the shared dictionaries)
const SHOP = {
  th: {
    title: 'บริการลูกค้า',
    store: 'โชว์รูม',
    map: 'ดูแผนที่',
    call: 'โทร',
    line: 'LINE',
    links: [
      ['/contact', 'ติดต่อเรา'],
      ['/booking', 'นัดชมการสาธิต'],
      ['/solutions', 'โซลูชันตามงาน'],
      ['/finance', 'ค่างวดและค่าใช้จ่าย'],
      ['/service', 'บริการหลังการขาย'],
      ['/faq', 'คำถามที่พบบ่อย'],
      ['/privacy', 'นโยบายความเป็นส่วนตัว'],
    ],
  },
  en: {
    title: 'Customer service',
    store: 'Showroom',
    map: 'Open the map',
    call: 'Call',
    line: 'LINE',
    links: [
      ['/contact', 'Contact us'],
      ['/booking', 'Book a demonstration'],
      ['/solutions', 'Solutions by use'],
      ['/finance', 'Financing and costs'],
      ['/service', 'After-sales service'],
      ['/faq', 'FAQ'],
      ['/privacy', 'Privacy policy'],
    ],
  },
}

/** Pages that carry their own contact actions (or a bar at the foot), so the floating buttons stay away */
const NO_FAB = ['/contact', '/booking', '/configure/', '/quote/']

/** Phones only: LINE and call, floating above the compare tray, never over it */
function ContactFab() {
  const lang = useLang()
  const s = SHOP[lang]
  const store = useStoreInfo()
  const { pathname } = useLocation()
  if (NO_FAB.some((p) => pathname.startsWith(p))) return null
  return (
    <div className="contact-fab">
      <a className="contact-fab__btn" href={store.lineUrl} target="_blank" rel="noopener" aria-label={`LINE ${store.lineId}`}>
        <MessageCircle size={20} aria-hidden />
        <span aria-hidden="true">{s.line}</span>
      </a>
      <a className="contact-fab__btn contact-fab__btn--call" href={telHref(store.phone)} aria-label={`${s.call} ${store.phone}`}>
        <Phone size={20} aria-hidden />
        <span aria-hidden="true">{s.call}</span>
      </a>
    </div>
  )
}

const monthEn = (yyyyMm: string) =>
  new Date(`${yyyyMm}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The same page in the other language: a plain link, since the language is set when a page loads. */
function LangSwitch() {
  const lang = useLang()
  const t = useT()
  const { pathname, search } = useLocation()
  const other = lang === 'en' ? 'th' : 'en'
  return (
    <a className="lang-switch" href={localePath(pathname, other) + search} hrefLang={other} lang={other} title={t('shell.langSwitchLabel')}>
      {t('shell.langSwitch')}
    </a>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  // Compare with the last path rather than skipping a first run: StrictMode runs effects twice in
  // development, which would otherwise move focus to the heading on the very first load.
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    window.scrollTo({ top: 0 })
    // Start keyboard and screen reader users at the new page's heading (falls back to <main>).
    const main = document.getElementById('main')
    const h1 = main?.querySelector<HTMLElement>('h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
    } else {
      main?.focus({ preventScroll: true })
    }
  }, [pathname])
  return null
}

/**
 * True while the page opens on a dark showroom stage (.stage first in <main>): the header then floats
 * over it, transparent, until the visitor scrolls. Read from the DOM so a page opts in by its markup.
 */
function useOverStage(pathname: string): boolean {
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    setOver(!!document.querySelector('#main > .stage:first-child'))
  }, [pathname])
  // While a showroom stage is on screen, html[data-at-stage] keeps the phone contact buttons out of its way
  useEffect(() => {
    // Only the tall stages with a price and buttons (home, model pages), not the short heads of other pages
    const first = document.querySelector('#main > .stage:first-child')
    const stage = first && (first.matches('.mstage') || first.querySelector('.stage__panel')) ? first : null
    const root = document.documentElement
    if (!stage || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) root.dataset.atStage = ''
      else delete root.dataset.atStage
    }, { threshold: 0.25 })
    io.observe(stage)
    return () => {
      io.disconnect()
      delete root.dataset.atStage
    }
  }, [pathname])
  return over
}

export function Layout() {
  const { theme, toggle } = useTheme()
  const { ids } = useCompare()
  const { pathname } = useLocation()
  const lang = useLang()
  const t = useT()
  const store = useStoreInfo()
  const shop = SHOP[lang]
  useRouteMeta()
  const overStage = useOverStage(pathname)
  const scrolled = useScrolled(24)

  const skipToMain = (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <>
      <a className="skip-link" href="#main" onClick={skipToMain}>
        {t('shell.skip')}
      </a>
      <ScrollToTop />

      <header className="site-header" data-over={overStage && !scrolled ? '' : undefined}>
        <div className="container site-header__inner">
          <Link to="/" className="wordmark">
            <BrandMark />
            <span className="wordmark__text">
              <span className="wordmark__name" lang="en">SERVO</span>
              <span className="wordmark__sub" lang="en">{t('site.wordmarkSub')}</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label={t('shell.menu')}>
            <ul>
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    // Model pages belong to the lineup section, so keep "หุ่นยนต์" marked there.
                    className={({ isActive }) =>
                      isActive || (item.to === '/' && pathname.startsWith('/models/')) ? 'active' : undefined
                    }
                  >
                    <span className="site-nav__icon" aria-hidden="true">
                      <item.Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="site-nav__label">{t(item.label)}</span>
                    {/* After the label in reading order; phones draw it on the icon's corner */}
                    {item.to === '/compare' && ids.length > 0 && (
                      <span className="site-nav__count" aria-label={t('shell.compareCount', { count: ids.length })}>
                        {ids.length}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('shell.themeToLight') : t('shell.themeToDark')}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>

          <LangSwitch />

          <Link to="/contact" className="btn btn-primary btn-sm site-header__cta">
            {t('shell.cta')}
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer on-navy">
        <div className="container">
          <div className="site-footer__inner">
            <div className="site-footer__brand">
              <Link to="/" className="wordmark wordmark--footer">
                <BrandMark size={40} />
                <span className="wordmark__text">
                  <span className="wordmark__name" lang="en">SERVO</span>
                  <span className="wordmark__sub" lang="en">{t('site.wordmarkSub')}</span>
                </span>
              </Link>
              {/* One line: what Servo is and the one caveat that matters (prices are estimates) */}
              <p className="site-footer__blurb">
                {lang === 'en' ? (
                  'Humanoid robots you can order in Thailand. Converted prices are estimates; check with the seller.'
                ) : (
                  <>
                    หุ่นยนต์ฮิวแมนนอยด์ที่สั่งซื้อได้ในไทย ราคาที่แปลงจาก<span className="nowrap">สกุลเงิน</span>
                    <span className="nowrap">ต่างประเทศ</span>เป็นราคาโดยประมาณ
                  </>
                )}
              </p>
            </div>
            <nav aria-labelledby="footer-nav-title">
              <p id="footer-nav-title" className="site-footer__title">
                {t('footer.menu')}
              </p>
              <ul className="site-footer__links">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to}>
                      <span className="site-footer__icon" aria-hidden="true">
                        <item.Icon size={16} strokeWidth={2} />
                      </span>
                      {t(item.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-labelledby="footer-shop-title">
              <p id="footer-shop-title" className="site-footer__title">
                {shop.title}
              </p>
              <ul className="site-footer__plain">
                {shop.links.map(([to, label]) => (
                  <li key={to}>
                    <Link to={to}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="site-footer__store">
              <p className="site-footer__title">{shop.store}</p>
              <address>
                <p className="site-footer__store-name">
                  {store.storeName} <span className="nowrap">{store.branch}</span>
                </p>
                <p>{store.address}</p>
                <p>
                  <a href={telHref(store.phone)} className="site-footer__contact">
                    <Phone size={15} aria-hidden />
                    {store.phone}
                  </a>
                </p>
                <p>
                  <a href={store.lineUrl} target="_blank" rel="noopener" className="site-footer__contact" lang="en">
                    <MessageCircle size={15} aria-hidden />
                    LINE {store.lineId}
                  </a>
                </p>
                <p>
                  <a href={store.mapUrl} target="_blank" rel="noopener" className="site-footer__contact">
                    <MapPin size={15} aria-hidden />
                    {shop.map}
                  </a>
                </p>
              </address>
              {hoursSummary(store.hours, lang) && <p className="site-footer__hours">{hoursSummary(store.hours, lang)}</p>}
            </div>
          </div>
          <p className="site-footer__note">{t('footer.simulation')}</p>
          <div className="site-footer__bottom">
            <p>{t('footer.bottom')}</p>
            <p>
              {lang === 'en' ? 'Photos: Wikimedia Commons, credits on the ' : 'ภาพจาก Wikimedia Commons ดูเครดิตที่หน้า'}
              <Link to="/sources">{t('nav.sources')}</Link>
            </p>
            <p>{t('footer.updated', { date: lang === 'en' ? monthEn(market.asOf) : formatMonthTh(market.asOf) })}</p>
          </div>
        </div>
      </footer>

      <CompareTray />
      <ContactFab />
    </>
  )
}
