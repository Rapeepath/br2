import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Download } from 'lucide-react'
import { api, download, errorMessage } from '../api'
import { BarList, ColumnChart } from '../Charts'
import { addDays, baht, bahtText, compact, dayLong, dayShort, PAYMENT_LABEL, percent, todayKey } from '../format'
import { useLoad } from '../hooks'
import { useSession } from '../session'
import type { SalesReport } from '../types'
import { Card, ErrorNote, Loading, PageHead, RangeFilter, rangeOf, Stat, TableWrap, type RangePreset } from '../ui'
import './reports.css'

export function ReportsPage() {
  const { meta } = useSession()
  const [sp, setSp] = useSearchParams()
  const preset = (sp.get('range') as RangePreset | null) ?? '30'
  const { from, to } = rangeOf(preset, { from: sp.get('from') ?? addDays(todayKey(), -29), to: sp.get('to') ?? todayKey() })
  const report = useLoad((signal) => api<SalesReport>(`/reports/sales?from=${from}&to=${to}`, { signal }), [from, to])
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await download(`/export/orders.csv?from=${from}&to=${to}`, `servo-orders-${from}-to-${to}.csv`)
    } catch (err) {
      setExportError(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const r = report.data
  const unit = (categoryId: string) => meta?.categories.find((c) => c.id === categoryId)?.unit ?? 'ชิ้น'
  const net = r ? r.summary.revenue - r.summary.vat : 0
  const hours = r ? trimHours(r.byHour) : []

  return (
    <>
      <PageHead
        title="รายงานยอดขาย"
        lead={r ? `${dayLong(r.from)} ถึง ${dayLong(r.to)}` : 'เลือกช่วงวันที่เพื่อดูรายงาน'}
        actions={
          <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={exporting}>
            <Download size={18} aria-hidden />
            {exporting ? 'กำลังเตรียมไฟล์' : 'ส่งออกบิลเป็น CSV'}
          </button>
        }
      />
      {exportError && <ErrorNote message={exportError} />}
      <div className="filters">
        <RangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => setSp(p === 'custom' ? { range: p, from: f, to: t } : { range: p }, { replace: true })} />
      </div>

      {report.error && <ErrorNote message={report.error} onRetry={report.reload} />}
      {!r && !report.error && <Loading />}
      {r && (
        <div className={report.loading ? 'is-refreshing' : ''}>
          <div className="stats stats--report">
            <Stat label="ยอดขาย (รวม VAT)" value={`${compact(r.summary.revenue)} บาท`} sub={bahtText(r.summary.revenue)} />
            <Stat label="บิลที่ชำระแล้ว" value={r.summary.orders.toLocaleString('th-TH')} sub={`${r.summary.items.toLocaleString('th-TH')} ชิ้น`} />
            <Stat label="เฉลี่ยต่อบิล" value={`${compact(r.summary.avgTicket)} บาท`} sub={bahtText(r.summary.avgTicket)} />
            <Stat label="ส่วนลด" value={`${compact(r.summary.discounts)} บาท`} sub={bahtText(r.summary.discounts)} />
            <Stat label="ภาษีขาย (VAT)" value={`${compact(r.summary.vat)} บาท`} sub={bahtText(r.summary.vat)} />
            <Stat label="ต้นทุนสินค้า" value={`${compact(r.summary.cost)} บาท`} sub={bahtText(r.summary.cost)} />
            <Stat label="กำไรขั้นต้น" value={`${compact(r.summary.grossProfit)} บาท`} sub={`อัตรากำไร ${percent(net ? (r.summary.grossProfit / net) * 100 : 0)}`} tone="gold" />
            <Stat label="คืนเงิน" value={`${r.summary.refunds} บิล`} sub={bahtText(r.summary.refundAmount)} />
          </div>

          <div className="report-grid">
            <Card title="ยอดขายรายวัน" className="report-grid__wide">
              <ColumnChart
                title="ยอดขายรายวัน (บาท รวม VAT)"
                valueHeader="ยอดขาย (บาท)"
                detailHeader="บิล"
                format={bahtText}
                points={r.byDay.map((d) => ({ key: d.day, label: dayShort(d.day), long: dayLong(d.day), value: d.revenue, detail: `${d.orders} บิล` }))}
              />
            </Card>
            <Card title="ยอดขายตามช่วงเวลาของวัน" className="report-grid__wide">
              <ColumnChart
                title="ยอดขายตามชั่วโมง (เวลาไทย)"
                valueHeader="ยอดขาย (บาท)"
                detailHeader="บิล"
                format={bahtText}
                height={200}
                points={hours.map((h) => ({ key: String(h.hour), label: `${h.hour}:00`, long: `${h.hour}:00–${h.hour}:59 น.`, value: h.revenue, detail: `${h.orders} บิล` }))}
              />
            </Card>
            <Card title="ตามหมวดสินค้า">
              <BarList label="ยอดขายตามหมวด" format={(v) => `${compact(v)} บาท`} rows={[...r.byCategory].sort((a, b) => b.revenue - a.revenue).map((c) => ({ key: c.categoryId, label: c.label, value: c.revenue, note: `${c.qty} ${unit(c.categoryId)}` }))} />
            </Card>
            <Card title="ตามช่องทางชำระเงิน">
              <BarList label="ยอดขายตามช่องทางชำระเงิน" format={(v) => `${compact(v)} บาท`} rows={[...r.byPayment].sort((a, b) => b.revenue - a.revenue).map((p) => ({ key: p.method, label: PAYMENT_LABEL[p.method], value: p.revenue, note: `${p.orders} บิล` }))} />
            </Card>
            <Card title="ตามพนักงานขาย">
              <BarList label="ยอดขายตามพนักงาน" format={(v) => `${compact(v)} บาท`} rows={[...r.byStaff].sort((a, b) => b.revenue - a.revenue).map((s) => ({ key: s.staffId, label: s.name, value: s.revenue, note: `${s.orders} บิล` }))} />
            </Card>
          </div>

          <Card title="ยอดขายรายสินค้า" className="section-gap">
            {r.byProduct.length ? (
              <TableWrap label="ตารางยอดขายรายสินค้า">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">สินค้า</th>
                      <th scope="col">SKU</th>
                      <th scope="col" className="num">
                        จำนวน
                      </th>
                      <th scope="col" className="num">
                        ยอดขาย (บาท)
                      </th>
                      <th scope="col" className="num">
                        ต้นทุน (บาท)
                      </th>
                      <th scope="col" className="num">
                        กำไรขั้นต้น (บาท)
                      </th>
                      <th scope="col" className="num">
                        อัตรากำไร
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byProduct.map((p) => {
                      const pNet = p.revenue / (1 + (meta?.settings.vatRate ?? 7) / 100)
                      return (
                        <tr key={p.productId}>
                          <td className="cell-wide">
                            <Link to={`/products/${p.productId}`}>{p.name}</Link>
                          </td>
                          <td className="mono nowrap">{p.sku}</td>
                          <td className="num">{p.qty}</td>
                          <td className="num">{baht(p.revenue)}</td>
                          <td className="num">{baht(p.cost)}</td>
                          <td className="num">{baht(p.profit)}</td>
                          <td className="num">{percent(pNet ? (p.profit / pNet) * 100 : 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={2}>
                        รวม
                      </th>
                      <td className="num">{r.byProduct.reduce((s, p) => s + p.qty, 0)}</td>
                      <td className="num">{baht(r.byProduct.reduce((s, p) => s + p.revenue, 0))}</td>
                      <td className="num">{baht(r.byProduct.reduce((s, p) => s + p.cost, 0))}</td>
                      <td className="num">{baht(r.byProduct.reduce((s, p) => s + p.profit, 0))}</td>
                      <td className="num">{percent(net ? (r.summary.grossProfit / net) * 100 : 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </TableWrap>
            ) : (
              <p className="muted">ยังไม่มียอดขายในช่วงนี้</p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

/** Opening hours only: from the first to the last hour with a sale (at least 10:00–19:00). */
function trimHours(rows: SalesReport['byHour']) {
  const traded = rows.filter((h) => h.orders > 0).map((h) => h.hour)
  const first = Math.min(10, ...traded)
  const last = Math.max(19, ...traded)
  return rows.filter((h) => h.hour >= first && h.hour <= last)
}
