import { Fragment, type ReactNode } from 'react'
import './commerce.css'

/**
 * Thai compounds the browser's line breaker splits ("ใบเสนอ|ราคา", "ตัว|จริง") — each is kept on one line.
 * Chrome breaks Thai between dictionary words and `word-break: keep-all` has no effect, so they get nowrap spans.
 */
const COMPOUNDS = [
  'ใบเสนอราคา',
  'ตัวจริง',
  'การสั่งงาน',
  'ล่วงหน้า',
  'โชว์รูม',
  'สำนักงานใหญ่',
  'หลังการขาย',
  'ทีมขาย',
  'ค่าใช้จ่าย',
  'ค่างวด',
  'ประมาณการ',
  'เช่ารายเดือน',
  'เช่าซื้อ',
  'ลีสซิ่ง',
  'บำรุงรักษา',
  'ผู้ผลิต',
  'ผู้จัดจำหน่าย',
  'การรับประกัน',
  'ข้อมูลส่วนบุคคล',
  'ความเป็นส่วนตัว',
  'เรียบเรียง',
  'ศูนย์วิจัย',
  'มหาวิทยาลัย',
  'คลังสินค้า',
  'ห้างสรรพสินค้า',
  'การศึกษา',
  'อุตสาหกรรม',
  'ค้าปลีก',
  'ซอฟต์แวร์',
  'การติดตั้ง',
  'ติดต่อกลับ',
]

const RE = new RegExp(`(${COMPOUNDS.join('|')})`, 'g')

/** Wraps the compounds of a Thai string in nowrap spans; other text (and English) passes through. */
export function tie(text: string): ReactNode {
  if (!/[฀-๿]/.test(text)) return text
  const parts = text.split(RE)
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="nowrap">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}

const tied = (n: ReactNode) => (typeof n === 'string' ? tie(n) : n)

/**
 * The dark stage head the new pages open with (as Compare and the guide do): the h1 on the left, the lede and
 * any actions on the right. It is the first thing in <main>, so the header floats over it on desktop.
 */
export function PageStage({ title, sub, lede, children }: { title: ReactNode; sub?: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pstage stage on-navy">
      <div className="container pstage__inner">
        <h1>
          {tied(title)}
          {sub && <span className="tint">{tied(sub)}</span>}
        </h1>
        {(lede || children) && (
          <div className="pstage__aside">
            {lede && <p className="pstage__lede">{tied(lede)}</p>}
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

/** The demo notice beside anything that looks like a commitment (prices, SLAs, bookings). */
export function SimNote({ children }: { children: ReactNode }) {
  return <p className="c-simnote">{tied(children)}</p>
}
