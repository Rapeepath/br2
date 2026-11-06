import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  CalendarDays,
  ChartColumn,
  ExternalLink,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Star,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { useTheme } from '../lib/theme'
import { ROLE_LABEL } from './format'
import { api } from './api'
import { useSession } from './session'
import { Avatar } from './ui'
import './shell.css'

type BadgeKey = 'leads' | 'reviews'

interface NavItem {
  to: string
  label: string
  Icon: typeof LayoutDashboard
  end: boolean
  also?: string[]
  /** A live count shown beside the label */
  badge?: BadgeKey
}

/** The menu in three groups: selling, the website's contacts, and running the shop */
export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'การขาย',
    items: [
      { to: '/', label: 'ภาพรวม', Icon: LayoutDashboard, end: true },
      { to: '/pos', label: 'ขายหน้าร้าน', Icon: ShoppingCart, end: false },
      { to: '/orders', label: 'รายการขาย', Icon: ReceiptText, end: false },
      { to: '/quotes', label: 'ใบเสนอราคา', Icon: FileText, end: false },
    ],
  },
  {
    label: 'ลูกค้าจากเว็บไซต์',
    items: [
      { to: '/leads', label: 'ลูกค้าที่สนใจ', Icon: Inbox, end: false, badge: 'leads' },
      { to: '/bookings', label: 'นัดหมาย', Icon: CalendarDays, end: false },
      { to: '/reviews', label: 'รีวิว', Icon: Star, end: false, badge: 'reviews' },
    ],
  },
  {
    label: 'ร้าน',
    items: [
      { to: '/products', label: 'สินค้าและสต็อก', Icon: Package, end: false, also: ['/stock'] },
      { to: '/customers', label: 'ลูกค้า', Icon: Users, end: false },
      { to: '/shifts', label: 'กะและเงินสด', Icon: Wallet, end: false },
      { to: '/reports', label: 'รายงาน', Icon: ChartColumn, end: false },
      { to: '/activity', label: 'บันทึกกิจกรรม', Icon: ScrollText, end: false },
      { to: '/settings', label: 'ตั้งค่า', Icon: Settings, end: false },
    ],
  },
]

const BADGE_TEXT: Record<BadgeKey, (n: number) => string> = {
  leads: (n) => `รายใหม่ ${n} ราย`,
  reviews: (n) => `รอตรวจ ${n} รีวิว`,
}

/** New leads and reviews waiting for a manager, refreshed as staff move between screens */
function useBadges(pathname: string): Record<BadgeKey, number> {
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ leads: 0, reviews: 0 })
  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all([
      api<{ counts: Record<string, number> }>('/leads?limit=1', { signal: ctrl.signal }),
      api<{ rows: unknown[] }>('/reviews?status=pending', { signal: ctrl.signal }),
    ]).then(
      ([leads, reviews]) => setCounts({ leads: leads.counts.new ?? 0, reviews: reviews.rows.length }),
      () => {},
    )
    return () => ctrl.abort()
  }, [pathname])
  return counts
}

function NavList({ onNavigate, badges }: { onNavigate?: () => void; badges: Record<BadgeKey, number> }) {
  const { pathname } = useLocation()
  return (
    <div className="side-nav__groups">
      {NAV.map((group) => (
        <div key={group.label} className="side-nav__group">
          <p className="side-nav__heading" aria-hidden="true">
            {group.label}
          </p>
          <ul className="side-nav" aria-label={group.label}>
            {group.items.map(({ to, label, Icon, end, also, badge }) => {
              const n = badge ? badges[badge] : 0
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) => (isActive || also?.some((p) => pathname.startsWith(p)) ? 'active' : undefined)}
                  >
                    <Icon size={18} strokeWidth={1.9} aria-hidden />
                    <span>{label}</span>
                    {badge && n > 0 && (
                      <span className="side-nav__badge">
                        <span aria-hidden="true">{n}</span>
                        <span className="visually-hidden"> ({BADGE_TEXT[badge](n)})</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
function Wordmark() {
  return (
    <Link to="/" className="admin-mark">
      <BrandMark size={34} />
      <span className="admin-mark__text">
        <span className="admin-mark__name" lang="en">
          SERVO
        </span>
        <span className="admin-mark__sub">หลังร้าน</span>
      </span>
    </Link>
  )
}

/** Moves focus to the new page's heading on navigation, like the brochure does. */
function FocusOnRoute() {
  const { pathname } = useLocation()
  const last = useRef(pathname)
  useEffect(() => {
    if (last.current === pathname) return
    last.current = pathname
    window.scrollTo({ top: 0 })
    const h1 = document.querySelector<HTMLElement>('#main h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
    }
  }, [pathname])
  return null
}

export function Shell() {
  const { staff, meta, shift, logout, refreshShift } = useSession()
  const { theme, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const drawer = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const badges = useBadges(pathname)

  // Keep the shift badge honest as people move between screens
  useEffect(() => {
    refreshShift()
  }, [pathname, refreshShift])

  useEffect(() => {
    const d = drawer.current
    if (!d) return
    if (menuOpen && !d.open) d.showModal()
    if (!menuOpen && d.open) d.close()
  }, [menuOpen])

  const skip = (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <div className="admin">
      <a className="skip-link" href="#main" onClick={skip}>
        ข้ามไปยังเนื้อหา
      </a>
      <FocusOnRoute />

      <div className="side on-navy">
        <Wordmark />
        <nav aria-label="เมนูหลัก">
          <NavList badges={badges} />
        </nav>
        <a className="side__site" href="../">
          <ExternalLink size={16} aria-hidden />
          ไปหน้าเว็บไซต์
        </a>
      </div>

      <div className="admin__main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar__menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู" aria-expanded={menuOpen}>
            <Menu size={22} aria-hidden />
          </button>
          <div className="topbar__store">
            <p className="topbar__name">{meta?.settings.storeName ?? 'Servo'}</p>
            <p className="topbar__branch">{meta?.settings.branch ?? ''}</p>
          </div>
          <Link to="/shifts" className={`shift-pill ${shift ? 'shift-pill--open' : 'shift-pill--closed'}`}>
            <span className="shift-pill__dot" aria-hidden="true" />
            {shift === undefined ? 'กำลังตรวจกะ' : shift ? `กะ #${shift.no} เปิดอยู่` : 'ยังไม่เปิดกะ'}
          </Link>
          <div className="topbar__user">
            <Avatar name={staff.name} tone={staff.tone} />
            <span className="topbar__who">
              <span className="topbar__staff">{staff.name}</span>
              <span className="topbar__role">
                {ROLE_LABEL[staff.role]} {staff.title !== ROLE_LABEL[staff.role] ? `(${staff.title})` : ''}
              </span>
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด'}>
            {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm topbar__out" onClick={logout}>
            <LogOut size={16} aria-hidden />
            <span>ออกจากระบบ</span>
          </button>
        </header>

        <main id="main" tabIndex={-1} className="content">
          <Outlet />
        </main>
      </div>

      <dialog
        ref={drawer}
        className="drawer on-navy"
        aria-label="เมนูหลังร้าน"
        onCancel={(e) => {
          e.preventDefault()
          setMenuOpen(false)
        }}
        onClick={(e) => {
          if (e.target === drawer.current) setMenuOpen(false)
        }}
      >
        {menuOpen && (
          <div className="drawer__panel">
            <div className="drawer__head">
              <Wordmark />
              <button type="button" className="icon-btn icon-btn--on-navy" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู">
                <X size={22} aria-hidden />
              </button>
            </div>
            <nav aria-label="เมนูหลัก (มือถือ)">
              <NavList onNavigate={() => setMenuOpen(false)} badges={badges} />
            </nav>
            <div className="drawer__foot">
              <p>
                {staff.name} ({ROLE_LABEL[staff.role]})
              </p>
              <a className="side__site" href="../">
                <ExternalLink size={16} aria-hidden />
                ไปหน้าเว็บไซต์
              </a>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
