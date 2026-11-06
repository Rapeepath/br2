import { Link } from 'react-router'
import { ArrowDownRight, ArrowUpRight, CalendarDays, FileText, Inbox, ShoppingCart, Star } from 'lucide-react'
import { api } from '../api'
import { BarList, ColumnChart } from '../Charts'
import { baht, bahtText, compact, dateTime, dayLong, dayShort, delta, PAYMENT_LABEL, percent, shortDateTime, timeOnly } from '../format'
import { useLoad } from '../hooks'
import { useSession } from '../session'
import type { Dashboard } from '../types'
import { Card, ErrorNote, Loading, PageHead, ProductThumb, Stat, StatusBadge, StockBadge, TableWrap } from '../ui'
import './crm.css'
import './dashboard.css'

export function DashboardPage() {
  const { meta } = useSession()
  const { data, error, loading, reload } = useLoad((signal) => api<Dashboard>('/dashboard', { signal }), [])

  if (!data) return error ? <ErrorNote message={error} onRetry={reload} /> : <Loading />

  const t = data.today
  const y = data.yesterdaySoFar
  const change = delta(t.revenue, y.revenue)
  const m = data.last30
  const unit = (categoryId: string) => meta?.categories.find((c) => c.id === categoryId)?.unit ?? 'ชิ้น'
  const margin = m.revenue ? ((m.grossProfit / (m.revenue - m.vat)) * 100) : 0

  return (
    <div className={`dash ${loading ? 'is-refreshing' : ''}`}>
      <PageHead
        title="ภาพรวมโชว์รูม"
        lead={`ข้อมูล ณ ${dateTime(data.now)}`}
        actions={
          <Link className="btn btn-primary" to="/pos">
            <ShoppingCart size={18} aria-hidden />
            เปิดหน้าขาย
          </Link>
        }
      />

      <section className="ledger on-navy" aria-labelledby="today-title">
        <div className="ledger__hero">
          <h2 id="today-title" className="ledger__label">
            ยอดขายวันนี้
          </h2>
          <p className="ledger__figure">
            {baht(t.revenue)}
            <span className="ledger__unit">บาท</span>
          </p>
          <p className="ledger__delta">
            {change ? (
              <>
                {change.dir === 'down' ? <ArrowDownRight size={18} aria-hidden /> : <ArrowUpRight size={18} aria-hidden />}
                {change.dir === 'flat' ? 'เท่ากับ' : change.dir === 'up' ? `สูงกว่า ${percent(change.pct)} จาก` : `ต่ำกว่า ${percent(change.pct)} จาก`}
                เมื่อวานช่วงเวลาเดียวกัน ({bahtText(y.revenue)})
              </>
            ) : (
              'เมื่อวานช่วงเวลาเดียวกันยังไม่มียอดขายให้เทียบ'
            )}
          </p>
        </div>
        <dl className="ledger__facts">
          <div>
            <dt>บิลวันนี้</dt>
            <dd>{t.orders.toLocaleString('th-TH')}</dd>
          </div>
          <div>
            <dt>เฉลี่ยต่อบิล</dt>
            <dd>{compact(t.avgTicket)}</dd>
          </div>
          <div>
            <dt>สินค้าที่ขาย</dt>
            <dd>{t.items.toLocaleString('th-TH')} ชิ้น</dd>
          </div>
          <div>
            <dt>คืนเงินวันนี้</dt>
            <dd>{t.refunds ? `${t.refunds} บิล` : 'ไม่มี'}</dd>
          </div>
        </dl>
      </section>

      {data.crm && (
        <section className="dash__month" aria-labelledby="crm-title">
          <h2 id="crm-title" className="section-title">
            ลูกค้าจากเว็บไซต์
          </h2>
          <div className="crm-tiles">
            <Link to="/leads?status=new" className={`crm-tile ${data.crm.newLeads ? 'is-hot' : ''}`}>
              <span className="crm-tile__label">
                <Inbox size={16} aria-hidden />
                ลูกค้าที่สนใจรายใหม่
              </span>
              <span className="crm-tile__value">{data.crm.newLeads.toLocaleString('th-TH')} ราย</span>
              <span className="crm-tile__sub">กำลังติดตามทั้งหมด {data.crm.openLeads.toLocaleString('th-TH')} ราย</span>
            </Link>
            <Link to="/bookings" className={`crm-tile ${data.crm.bookingsToday ? 'is-hot' : ''}`}>
              <span className="crm-tile__label">
                <CalendarDays size={16} aria-hidden />
                นัดสาธิตวันนี้
              </span>
              <span className="crm-tile__value">{data.crm.bookingsToday.toLocaleString('th-TH')} นัด</span>
              <span className="crm-tile__sub">นัดล่วงหน้าอีก {data.crm.bookingsUpcoming.toLocaleString('th-TH')} นัด</span>
            </Link>
            <Link to="/quotes" className="crm-tile">
              <span className="crm-tile__label">
                <FileText size={16} aria-hidden />
                ใบเสนอราคาที่เปิดอยู่
              </span>
              <span className="crm-tile__value">{data.crm.quotesOpen.toLocaleString('th-TH')} ใบ</span>
              <span className="crm-tile__sub">ยังไม่หมดอายุและยังไม่ออกบิล</span>
            </Link>
            <Link to="/reviews" className={`crm-tile ${data.crm.pendingReviews ? 'is-hot' : ''}`}>
              <span className="crm-tile__label">
                <Star size={16} aria-hidden />
                รีวิวรอตรวจ
              </span>
              <span className="crm-tile__value">{data.crm.pendingReviews.toLocaleString('th-TH')} รีวิว</span>
              <span className="crm-tile__sub">แสดงบนเว็บหลังผู้จัดการอนุมัติ</span>
            </Link>
          </div>
        </section>
      )}

      <section className="dash__month" aria-labelledby="month-title">
        <h2 id="month-title" className="section-title">
          30 วันล่าสุด
        </h2>
        <div className="stats">
          <Stat label="ยอดขาย" value={`${compact(m.revenue)} บาท`} sub={`${bahtText(m.revenue)} รวม VAT`} />
          <Stat label="กำไรขั้นต้น" value={`${compact(m.grossProfit)} บาท`} sub={`อัตรากำไร ${percent(margin)} ของยอดก่อน VAT`} />
          <Stat label="บิลที่ชำระแล้ว" value={m.orders.toLocaleString('th-TH')} sub={`เฉลี่ย ${compact(m.avgTicket)} บาทต่อบิล`} />
          <Stat label="ส่วนลดที่ให้" value={`${compact(m.discounts)} บาท`} sub={`คืนเงิน ${m.refunds} บิล (${compact(m.refundAmount)} บาท)`} />
        </div>
      </section>

      <div className="dash__grid">
        <Card title="ยอดขายรายวัน" className="dash__chart">
          <ColumnChart
            title="ยอดขายรายวัน 30 วันล่าสุด (บาท รวม VAT)"
            valueHeader="ยอดขาย (บาท)"
            detailHeader="บิล"
            format={(v) => bahtText(v)}
            points={data.days.map((d) => ({ key: d.day, label: dayShort(d.day), long: dayLong(d.day), value: d.revenue, detail: `${d.orders} บิล` }))}
          />
        </Card>

        <Card
          title="กะปัจจุบัน"
          className="dash__shift"
          actions={
            <Link className="text-link" to="/shifts">
              จัดการกะ
            </Link>
          }
        >
          {data.shift ? (
            <dl className="kv">
              <div>
                <dt>กะ</dt>
                <dd>#{data.shift.no}</dd>
              </div>
              <div>
                <dt>เปิดโดย</dt>
                <dd>
                  {data.shift.openedBy} เวลา {timeOnly(data.shift.openedAt)} น.
                </dd>
              </div>
              <div>
                <dt>เงินทอนตั้งต้น</dt>
                <dd>{bahtText(data.shift.openingCash)}</dd>
              </div>
              <div>
                <dt>ขายเป็นเงินสด</dt>
                <dd>{bahtText(data.shift.cashSales)}</dd>
              </div>
              <div className="kv__strong">
                <dt>เงินสดที่ควรมีในลิ้นชัก</dt>
                <dd>{bahtText(data.shift.expectedNow)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">
              ยังไม่ได้เปิดกะ <Link to="/shifts">เปิดกะ</Link> ก่อนเริ่มขาย
            </p>
          )}
        </Card>

        <Card title="สินค้าขายดี 30 วัน" className="dash__top">
          <BarList
            label="สินค้าขายดี 30 วัน เรียงตามยอดขาย"
            format={(v) => `${compact(v)} บาท`}
            rows={data.topProducts.map((p) => ({ key: p.productId, label: p.name, value: p.revenue, note: `จำนวน ${p.qty}`, to: `/products/${p.productId}` }))}
          />
        </Card>

        <Card title="ช่องทางชำระเงิน 30 วัน" className="dash__pay">
          <BarList
            label="ยอดขายตามช่องทางชำระเงิน 30 วัน"
            format={(v) => `${compact(v)} บาท`}
            rows={[...data.byPayment].sort((a, b) => b.revenue - a.revenue).map((p) => ({ key: p.method, label: PAYMENT_LABEL[p.method], value: p.revenue, note: `${p.orders} บิล` }))}
          />
        </Card>

        <Card title="ยอดขายตามหมวด 30 วัน" className="dash__cat">
          <BarList
            label="ยอดขายตามหมวดสินค้า 30 วัน"
            format={(v) => `${compact(v)} บาท`}
            rows={[...data.byCategory].sort((a, b) => b.revenue - a.revenue).map((c) => ({ key: c.categoryId, label: c.label, value: c.revenue, note: `${c.qty} ${unit(c.categoryId)}` }))}
          />
        </Card>

        <Card
          title="สินค้าใกล้หมด"
          className="dash__low"
          actions={
            <Link className="text-link" to="/products?stock=low">
              ดูทั้งหมด
            </Link>
          }
        >
          {data.lowStock.length ? (
            <ul className="low-list">
              {data.lowStock.map((p) => (
                <li key={p.id}>
                  <ProductThumb product={p} />
                  <span className="low-list__name">
                    <Link to={`/products/${p.id}`}>{p.name}</Link>
                    <span className="low-list__sku">
                      <span className="nowrap">{p.sku}</span> <span className="nowrap">จุดสั่งซื้อ {p.reorderLevel}</span>
                    </span>
                  </span>
                  <StockBadge product={p} unit={unit(p.categoryId)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">สต็อกทุกรายการยังสูงกว่าจุดสั่งซื้อ</p>
          )}
        </Card>

        <Card
          title="บิลล่าสุด"
          className="dash__recent"
          actions={
            <Link className="text-link" to="/orders">
              ดูรายการขาย
            </Link>
          }
        >
          <TableWrap label="บิลล่าสุด">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th scope="col">เลขที่บิล</th>
                  <th scope="col">เวลา</th>
                  <th scope="col">ลูกค้า</th>
                  <th scope="col" className="num">
                    ยอดสุทธิ (บาท)
                  </th>
                  <th scope="col">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} className="mono-link">
                        {o.no}
                      </Link>
                    </td>
                    <td className="nowrap">{shortDateTime(o.createdAt)}</td>
                    <td className="cell-name">{o.customerName ?? 'ลูกค้าทั่วไป'}</td>
                    <td className="num">{baht(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <section className="dash__counts" aria-labelledby="counts-title">
        <h2 id="counts-title" className="section-title">
          ข้อมูลในระบบ
        </h2>
        <dl className="counts">
          <div>
            <dt>สินค้าที่เปิดขาย</dt>
            <dd>{data.counts.products.toLocaleString('th-TH')} รายการ</dd>
          </div>
          <div>
            <dt>ลูกค้า</dt>
            <dd>{data.counts.customers.toLocaleString('th-TH')} ราย</dd>
          </div>
          <div>
            <dt>บิลทั้งหมด</dt>
            <dd>{data.counts.orders.toLocaleString('th-TH')} บิล</dd>
          </div>
          <div>
            <dt>สต็อกคงเหลือ</dt>
            <dd>{data.counts.stockUnits.toLocaleString('th-TH')} ชิ้น</dd>
          </div>
          <div>
            <dt>มูลค่าสต็อก (ราคาทุน)</dt>
            <dd>{compact(data.counts.stockValue)} บาท</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
