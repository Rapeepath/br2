import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownRight } from 'lucide-react'
import { api } from '../api'
import { baht, compact, dateTime, MOVEMENT_LABEL, percent } from '../format'
import { useLoad } from '../hooks'
import { useSession } from '../session'
import type { MovementRow, MovementType, Paged, ProductRow } from '../types'
import { Card, Empty, ErrorNote, Field, Loading, PageHead, ProductThumb, Segmented, StockBadge, TableWrap } from '../ui'
import './products.css'

type StockFilter = 'all' | 'low' | 'out'

/** Gross margin per unit on the price before VAT. */
export const marginOf = (price: number, cost: number, vatRate: number) => {
  const net = price / (1 + vatRate / 100)
  return net > 0 ? ((net - cost) / net) * 100 : 0
}

export function ProductsPage() {
  const { meta } = useSession()
  const [sp, setSp] = useSearchParams()
  const cat = sp.get('category') ?? 'all'
  const stock = (sp.get('stock') as StockFilter | null) ?? 'all'
  const [q, setQ] = useState('')
  const list = useLoad((signal) => api<ProductRow[]>('/products', { signal }), [])
  const vat = meta?.settings.vatRate ?? 7

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp)
    if (v === 'all') next.delete(k)
    else next.set(k, v)
    setSp(next, { replace: true })
  }

  const rows = (list.data ?? [])
    .filter((p) => cat === 'all' || p.categoryId === cat)
    .filter((p) => stock === 'all' || (p.trackStock && (stock === 'out' ? p.stock <= 0 : p.stock <= p.reorderLevel)))
    .filter((p) => {
      const s = q.trim().toLowerCase()
      return !s || `${p.name} ${p.subtitle} ${p.sku}`.toLowerCase().includes(s)
    })

  const tracked = (list.data ?? []).filter((p) => p.trackStock)
  const stockValue = tracked.reduce((s, p) => s + p.stock * p.cost, 0)

  return (
    <>
      <PageHead
        title="สินค้าและสต็อก"
        lead="หุ่นยนต์ทุกรุ่นย่อยจากแค็ตตาล็อก พร้อมอุปกรณ์เสริมและบริการ ราคา ต้นทุน สต็อก และยอดขายสะสม"
        actions={
          <Link className="btn btn-ghost" to="/stock">
            <ArrowDownRight size={18} aria-hidden />
            ความเคลื่อนไหวสต็อก
          </Link>
        }
      />

      {list.data && (
        <div className="stats stats--inline">
          <div className="stat">
            <p className="stat__label">สินค้าทั้งหมด</p>
            <p className="stat__value">{list.data.length} รายการ</p>
          </div>
          <div className="stat">
            <p className="stat__label">ใกล้หมดหรือหมด</p>
            <p className="stat__value">{tracked.filter((p) => p.stock <= p.reorderLevel).length} รายการ</p>
          </div>
          <div className="stat">
            <p className="stat__label">มูลค่าสต็อก (ราคาทุน)</p>
            <p className="stat__value">{compact(stockValue)} บาท</p>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filters__row">
          <Field label="ค้นหาสินค้า" className="filters__search">
            {(id) => <input id={id} type="search" value={q} placeholder="ชื่อ รุ่น หรือ SKU" onChange={(e) => setQ(e.target.value)} />}
          </Field>
          <Segmented
            legend="หมวด"
            value={cat}
            onChange={(v) => set('category', v)}
            options={[{ value: 'all', label: 'ทุกหมวด' }, ...(meta?.categories ?? []).map((c) => ({ value: c.id, label: c.label }))]}
          />
          <Segmented<StockFilter>
            legend="สต็อก"
            value={stock}
            onChange={(v) => set('stock', v)}
            options={[
              { value: 'all', label: 'ทั้งหมด' },
              { value: 'low', label: 'ใกล้หมด' },
              { value: 'out', label: 'หมด' },
            ]}
          />
        </div>
      </div>

      <Card>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {!list.data && !list.error && <Loading />}
        {list.data && !rows.length && <Empty>ไม่มีสินค้าตามเงื่อนไขนี้</Empty>}
        {rows.length > 0 && (
          <TableWrap label="ตารางสินค้า">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">สินค้า</th>
                  <th scope="col">SKU</th>
                  <th scope="col">หมวด</th>
                  <th scope="col" className="num">
                    ราคาขาย
                  </th>
                  <th scope="col" className="num">
                    ต้นทุน
                  </th>
                  <th scope="col" className="num">
                    กำไรต่อหน่วย
                  </th>
                  <th scope="col">สต็อก</th>
                  <th scope="col" className="num">
                    ขายแล้ว
                  </th>
                  <th scope="col" className="num">
                    รายได้ (บาท)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={p.active ? '' : 'is-inactive'}>
                    <td className="cell-product">
                      <ProductThumb product={p} />
                      <span>
                        <Link to={`/products/${p.id}`}>{p.name}</Link>
                        <span className="cell-sub">
                          {p.subtitle}
                          {!p.active && ' (ปิดการขาย)'}
                        </span>
                      </span>
                    </td>
                    <td className="mono nowrap">{p.sku}</td>
                    <td className="nowrap">{meta?.categories.find((c) => c.id === p.categoryId)?.label}</td>
                    <td className="num">{baht(p.price)}</td>
                    <td className="num">{baht(p.cost)}</td>
                    <td className="num">{percent(marginOf(p.price, p.cost, vat))}</td>
                    <td className="nowrap">
                      <StockBadge product={p} unit={p.unit} />
                    </td>
                    <td className="num">
                      {p.sold} {p.unit}
                    </td>
                    <td className="num">{baht(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  )
}

const TYPES: ('all' | MovementType)[] = ['all', 'initial', 'receive', 'adjust', 'sale', 'refund']

export function StockPage() {
  const { meta } = useSession()
  const [type, setType] = useState<'all' | MovementType>('all')
  const [productId, setProductId] = useState('')
  const [limit, setLimit] = useState(100)
  const products = useLoad((signal) => api<ProductRow[]>('/products', { signal }), [])
  const params = new URLSearchParams({ limit: String(limit) })
  if (type !== 'all') params.set('type', type)
  if (productId) params.set('productId', productId)
  const list = useLoad((signal) => api<Paged<MovementRow>>(`/stock/movements?${params}`, { signal }), [params.toString()])
  const staffName = (id: string | null) => meta?.staff.find((s) => s.id === id)?.name ?? '–'

  return (
    <>
      <PageHead
        back={{ to: '/products', label: 'สินค้าและสต็อก' }}
        title="ความเคลื่อนไหวสต็อก"
        lead="ทุกการรับเข้า ขาย คืน และปรับยอดนับ พร้อมยอดคงเหลือหลังรายการ"
      />
      <div className="filters">
        <div className="filters__row">
          <Segmented<'all' | MovementType>
            legend="ประเภท"
            value={type}
            onChange={(v) => {
              setType(v)
              setLimit(100)
            }}
            options={TYPES.map((t) => ({ value: t, label: t === 'all' ? 'ทั้งหมด' : MOVEMENT_LABEL[t] }))}
          />
          <Field label="สินค้า">
            {(id) => (
              <select
                id={id}
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value)
                  setLimit(100)
                }}
              >
                <option value="">ทุกสินค้าที่นับสต็อก</option>
                {products.data
                  ?.filter((p) => p.trackStock)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
              แสดง {list.data.rows.length.toLocaleString('th-TH')} จาก {list.data.total.toLocaleString('th-TH')} รายการ
            </p>
            {list.data.rows.length === 0 ? (
              <Empty>ยังไม่มีความเคลื่อนไหวตามเงื่อนไขนี้</Empty>
            ) : (
              <MovementTable rows={list.data.rows} staffName={staffName} showProduct />
            )}
            {list.data.total > list.data.rows.length && limit < 1000 && (
              <div className="more">
                <button type="button" className="btn btn-ghost" onClick={() => setLimit((l) => Math.min(1000, l + 200))}>
                  แสดงเพิ่ม
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  )
}

export function MovementTable({ rows, staffName, showProduct = false }: { rows: (MovementRow | (Omit<MovementRow, 'productName'> & { productName?: string }))[]; staffName: (id: string | null) => string; showProduct?: boolean }) {
  return (
    <TableWrap label="ตารางความเคลื่อนไหวสต็อก">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">วันเวลา</th>
            {showProduct && <th scope="col">สินค้า</th>}
            <th scope="col">ประเภท</th>
            <th scope="col" className="num">
              จำนวน
            </th>
            <th scope="col" className="num">
              คงเหลือ
            </th>
            <th scope="col">อ้างอิง</th>
            <th scope="col">พนักงาน</th>
            <th scope="col">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="nowrap">{dateTime(m.at)}</td>
              {showProduct && (
                <td className="cell-wide">
                  <Link to={`/products/${m.productId}`}>{m.productName ?? m.productId}</Link>
                </td>
              )}
              <td>
                <span className={`badge badge--move-${m.type}`}>{MOVEMENT_LABEL[m.type]}</span>
              </td>
              <td className={`num ${m.qty < 0 ? 'neg' : 'pos'}`}>{m.qty > 0 ? `+${m.qty}` : `−${Math.abs(m.qty)}`}</td>
              <td className="num">{m.balance}</td>
              <td className="nowrap">
                {m.ref ? (
                  <Link to={`/orders/${m.ref}`} className="mono-link">
                    {m.ref}
                  </Link>
                ) : (
                  '–'
                )}
              </td>
              <td className="nowrap">{staffName(m.staffId)}</td>
              <td>{m.note ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}
