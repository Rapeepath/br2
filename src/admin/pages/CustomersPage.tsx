import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Pencil, UserPlus } from 'lucide-react'
import { api } from '../api'
import { CustomerForm } from '../forms'
import { baht, bahtText, dateOnly, dateTime, KIND_LABEL, PAYMENT_LABEL } from '../format'
import { useDebounced, useLoad } from '../hooks'
import { useToast } from '../session'
import type { CustomerDetail, CustomerKind, CustomerRow } from '../types'
import { Card, Dialog, Empty, ErrorNote, Field, Loading, PageHead, Segmented, Stat, StatusBadge, TableWrap } from '../ui'

export function CustomersPage() {
  const notify = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | CustomerKind>('all')
  const [adding, setAdding] = useState(false)
  const term = useDebounced(q, 250)
  const list = useLoad((signal) => api<CustomerRow[]>(`/customers?q=${encodeURIComponent(term)}`, { signal }), [term])
  const rows = (list.data ?? []).filter((c) => kind === 'all' || c.kind === kind)

  return (
    <>
      <PageHead
        title="ลูกค้า"
        lead="บุคคลและนิติบุคคลที่เคยซื้อ เรียงตามยอดซื้อสะสม นิติบุคคลได้ใบกำกับภาษีเต็มรูป"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlus size={18} aria-hidden />
            เพิ่มลูกค้า
          </button>
        }
      />
      <div className="filters">
        <div className="filters__row">
          <Field label="ค้นหาลูกค้า" className="filters__search">
            {(id) => <input id={id} type="search" value={q} placeholder="ชื่อ เบอร์โทร หรืออีเมล" onChange={(e) => setQ(e.target.value)} />}
          </Field>
          <Segmented<'all' | CustomerKind>
            legend="ประเภท"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'ทั้งหมด' },
              { value: 'company', label: KIND_LABEL.company },
              { value: 'person', label: KIND_LABEL.person },
            ]}
          />
        </div>
      </div>
      <Card className={list.loading ? 'is-refreshing' : ''}>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {!list.data && !list.error && <Loading />}
        {list.data && (
          <p className="list-summary" aria-live="polite">
            พบลูกค้า {rows.length.toLocaleString('th-TH')} ราย
          </p>
        )}
        {list.data && !rows.length && <Empty>ไม่พบลูกค้าตามคำค้น กด "เพิ่มลูกค้า" เพื่อสร้างรายใหม่</Empty>}
        {rows.length > 0 && (
          <TableWrap label="ตารางลูกค้า">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">ชื่อ</th>
                  <th scope="col">ประเภท</th>
                  <th scope="col">โทร</th>
                  <th scope="col">อีเมล</th>
                  <th scope="col" className="num">
                    บิล
                  </th>
                  <th scope="col" className="num">
                    ยอดซื้อสะสม (บาท)
                  </th>
                  <th scope="col">ซื้อล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-wide">
                      <Link to={`/customers/${c.id}`}>{c.name}</Link>
                      {c.taxId && <span className="cell-sub">เลขผู้เสียภาษี {c.taxId}</span>}
                    </td>
                    <td className="nowrap">{KIND_LABEL[c.kind]}</td>
                    <td className="nowrap">{c.phone}</td>
                    <td>{c.email ?? '–'}</td>
                    <td className="num">{c.orders}</td>
                    <td className="num">{baht(c.spent)}</td>
                    <td className="nowrap">{c.lastOrderAt ? dateOnly(c.lastOrderAt) : 'ยังไม่เคยซื้อ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Dialog open={adding} onClose={() => setAdding(false)} title="เพิ่มลูกค้า">
        <CustomerForm
          onSaved={(c) => {
            setAdding(false)
            notify(`เพิ่มลูกค้า ${c.name} แล้ว`)
            navigate(`/customers/${c.id}`)
          }}
        />
      </Dialog>
    </>
  )
}

export function CustomerPage() {
  const { id = '' } = useParams()
  const notify = useToast()
  const [editing, setEditing] = useState(false)
  const detail = useLoad((signal) => api<CustomerDetail>(`/customers/${encodeURIComponent(id)}`, { signal }), [id])

  if (!detail.data) return detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} /> : <Loading />
  const { customer: c, orders } = detail.data

  return (
    <>
      <PageHead
        back={{ to: '/customers', label: 'ลูกค้า' }}
        title={c.name}
        lead={`${KIND_LABEL[c.kind]} เป็นลูกค้าตั้งแต่ ${dateOnly(c.createdAt)}`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={18} aria-hidden />
            แก้ไขข้อมูล
          </button>
        }
      />
      <div className="stats">
        <Stat label="บิลที่ชำระแล้ว" value={c.orders.toLocaleString('th-TH')} />
        <Stat label="ยอดซื้อสะสม" value={bahtText(c.spent)} />
        <Stat label="ซื้อล่าสุด" value={c.lastOrderAt ? dateOnly(c.lastOrderAt) : 'ยังไม่เคยซื้อ'} />
      </div>
      <div className="customer-grid">
        <Card title="ข้อมูลติดต่อและภาษี">
          <dl className="kv">
            <div>
              <dt>ประเภท</dt>
              <dd>{KIND_LABEL[c.kind]}</dd>
            </div>
            <div>
              <dt>โทร</dt>
              <dd>{c.phone}</dd>
            </div>
            <div>
              <dt>อีเมล</dt>
              <dd>{c.email ?? '–'}</dd>
            </div>
            <div>
              <dt>เลขประจำตัวผู้เสียภาษี</dt>
              <dd>{c.taxId ?? '–'}</dd>
            </div>
            <div>
              <dt>ที่อยู่</dt>
              <dd>{c.address ?? '–'}</dd>
            </div>
            <div>
              <dt>หมายเหตุ</dt>
              <dd>{c.note ?? '–'}</dd>
            </div>
            <div>
              <dt>รหัสลูกค้า</dt>
              <dd className="mono">{c.id}</dd>
            </div>
          </dl>
        </Card>
        <Card title="ประวัติการซื้อ">
          {orders.length ? (
            <TableWrap label="ประวัติการซื้อ">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">เลขที่บิล</th>
                    <th scope="col">วันเวลา</th>
                    <th scope="col">รายการ</th>
                    <th scope="col">ชำระโดย</th>
                    <th scope="col" className="num">
                      ยอดสุทธิ (บาท)
                    </th>
                    <th scope="col">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="mono-link">
                          {o.no}
                        </Link>
                      </td>
                      <td className="nowrap">{dateTime(o.createdAt)}</td>
                      <td className="cell-wide">
                        {o.lines.map((l) => `${l.name} × ${l.qty}`).join(', ')}
                      </td>
                      <td>{PAYMENT_LABEL[o.payment.method]}</td>
                      <td className="num">{baht(o.total)}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <p className="muted">ยังไม่มีประวัติการซื้อ</p>
          )}
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title={`แก้ไขข้อมูล ${c.name}`}>
        <CustomerForm
          initial={c}
          onSaved={() => {
            setEditing(false)
            notify('บันทึกข้อมูลลูกค้าแล้ว')
            detail.reload()
          }}
        />
      </Dialog>
    </>
  )
}
