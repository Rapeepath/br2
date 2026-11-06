import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { ACTIVITY_LABEL, dateTime } from '../format'
import { useDebounced, useLoad } from '../hooks'
import type { Activity, ActivityType, Paged } from '../types'
import { Card, Empty, ErrorNote, Field, Loading, PageHead, Pagination, TableWrap } from '../ui'

const PAGE = 50

/** Turns the id an entry is about into a link to its screen. */
function refLink(a: Activity) {
  if (!a.ref) return '–'
  const r = a.ref
  if (a.type === 'sale' || a.type === 'refund') return <Link to={`/orders/${r}`} className="mono-link">{r}</Link>
  if (a.type === 'stock' || a.type === 'product') return <Link to={`/products/${r}`}>ดูสินค้า</Link>
  if (a.type === 'customer') return <Link to={`/customers/${r}`}>ดูลูกค้า</Link>
  if (a.type === 'shift') return <Link to="/shifts">ดูกะ</Link>
  return r
}

export function ActivityPage() {
  const [type, setType] = useState<'' | ActivityType>('')
  const [qText, setQText] = useState('')
  const [page, setPage] = useState(0)
  const q = useDebounced(qText, 300)
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
  if (type) params.set('type', type)
  if (q) params.set('q', q)
  const list = useLoad((signal) => api<Paged<Activity>>(`/activity?${params}`, { signal }), [params.toString()])

  return (
    <>
      <PageHead title="บันทึกกิจกรรม" lead="ทุกการกระทำในระบบ ใครทำอะไร เมื่อไร เรียงจากล่าสุด" />
      <div className="filters">
        <div className="filters__row">
          <Field label="ค้นหา" className="filters__search">
            {(id) => (
              <input
                id={id}
                type="search"
                value={qText}
                placeholder="ข้อความหรือชื่อพนักงาน"
                onChange={(e) => {
                  setQText(e.target.value)
                  setPage(0)
                }}
              />
            )}
          </Field>
          <Field label="ประเภท">
            {(id) => (
              <select
                id={id}
                value={type}
                onChange={(e) => {
                  setType(e.target.value as '' | ActivityType)
                  setPage(0)
                }}
              >
                <option value="">ทุกประเภท</option>
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </div>
      <Card className={list.loading ? 'is-refreshing' : ''}>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {!list.data && !list.error && <Loading />}
        {list.data && (
          <>
            <p className="list-summary" aria-live="polite">
              พบ {list.data.total.toLocaleString('th-TH')} รายการ
            </p>
            {list.data.rows.length === 0 ? (
              <Empty>ไม่มีกิจกรรมตามเงื่อนไขนี้</Empty>
            ) : (
              <TableWrap label="ตารางบันทึกกิจกรรม">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">วันเวลา</th>
                      <th scope="col">ประเภท</th>
                      <th scope="col">รายละเอียด</th>
                      <th scope="col">พนักงาน</th>
                      <th scope="col">อ้างอิง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((a) => (
                      <tr key={a.id}>
                        <td className="nowrap">{dateTime(a.at)}</td>
                        <td className="nowrap">
                          <span className={`badge badge--act-${a.type}`}>{ACTIVITY_LABEL[a.type]}</span>
                        </td>
                        <td className="cell-wide">{a.message}</td>
                        <td className="nowrap">{a.staffName ?? 'ระบบ'}</td>
                        <td className="nowrap">{refLink(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <Pagination page={page} pageSize={PAGE} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
