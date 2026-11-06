import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, errorMessage } from '../api'
import { baht, bahtText, compact, dateTime, percent, STATUS_LABEL } from '../format'
import { useLoad } from '../hooks'
import { RobotRecord } from '../RobotRecord'
import { useSession, useToast } from '../session'
import type { Model } from '../../lib/types'
import type { ProductDetail, ProductRow } from '../types'
import { Card, ErrorNote, Field, Loading, PageHead, ProductThumb, StockBadge, TableWrap, parseAmount } from '../ui'
import { MovementTable, marginOf } from './ProductsPage'
import './products.css'

export function ProductPage() {
  const { id = '' } = useParams()
  const { meta, isManager } = useSession()
  const detail = useLoad((signal) => api<ProductDetail>(`/products/${encodeURIComponent(id)}`, { signal }), [id])

  if (!detail.data) return detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} /> : <Loading />
  const { product: p, movements, sales, record } = detail.data
  const vat = meta?.settings.vatRate ?? 7
  const category = meta?.categories.find((c) => c.id === p.categoryId)
  const staffName = (sid: string | null) => meta?.staff.find((s) => s.id === sid)?.name ?? '–'

  return (
    <>
      <PageHead back={{ to: '/products', label: 'สินค้าและสต็อก' }} title={p.name} lead={`${p.subtitle} รหัส ${p.sku}`} />

      <section className="product-hero card" aria-label="สรุปสินค้า">
        <ProductThumb product={p} size="lg" />
        <div className="product-hero__body">
          <div className="product-hero__chips">
            <span className="chip">{category?.label}</span>
            {p.variant && <span className="chip tone-gold">{p.variant}</span>}
            {!p.active && <span className="badge badge--bad">ปิดการขาย</span>}
            <StockBadge product={p} unit={p.unit} />
          </div>
          <p className="product-hero__price">
            {baht(p.price)} <span>บาท รวม VAT</span>
          </p>
          <dl className="product-hero__facts">
            <div>
              <dt>ต้นทุน</dt>
              <dd>{bahtText(p.cost)}</dd>
            </div>
            <div>
              <dt>กำไรต่อหน่วย</dt>
              <dd>
                {bahtText(p.price / (1 + vat / 100) - p.cost)} ({percent(marginOf(p.price, p.cost, vat))})
              </dd>
            </div>
            <div>
              <dt>ขายแล้ว</dt>
              <dd>
                {p.sold} {p.unit}
              </dd>
            </div>
            <div>
              <dt>รายได้สะสม</dt>
              <dd>{compact(p.revenue)} บาท</dd>
            </div>
            <div>
              <dt>ขายล่าสุด</dt>
              <dd>{p.lastSoldAt ? dateTime(p.lastSoldAt) : 'ยังไม่เคยขาย'}</dd>
            </div>
            {p.trackStock && (
              <div>
                <dt>มูลค่าสต็อก (ราคาทุน)</dt>
                <dd>{bahtText(p.stock * p.cost)}</dd>
              </div>
            )}
            <div>
              <dt>แก้ไขล่าสุด</dt>
              <dd>{dateTime(p.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="product-grid">
        <Card title="ข้อมูลสินค้า">
          <dl className="kv">
            {p.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            <div>
              <dt>จุดสั่งซื้อ</dt>
              <dd>{p.trackStock ? `เมื่อเหลือ ${p.reorderLevel} ${p.unit}` : 'ไม่นับสต็อก'}</dd>
            </div>
          </dl>
        </Card>

        <Card title="ราคาและการขาย">
          {isManager ? (
            <EditForm key={p.updatedAt} product={p} onSaved={detail.reload} />
          ) : (
            <p className="muted">เฉพาะผู้จัดการแก้ไขราคา ต้นทุน จุดสั่งซื้อ และการเปิดปิดการขายได้</p>
          )}
        </Card>

        {p.trackStock && (
          <Card title="รับเข้าและนับสต็อก">
            <div className="stock-forms">
              <ReceiveForm product={p} onDone={detail.reload} />
              <AdjustForm key={p.stock} product={p} needsPin={!isManager} onDone={detail.reload} />
            </div>
          </Card>
        )}
      </div>

      {p.trackStock && (
        <Card title="บัตรสต็อก" className="section-gap">
          <MovementTable rows={movements} staffName={staffName} />
        </Card>
      )}

      <Card title="ยอดขายล่าสุดของสินค้านี้" className="section-gap">
        {sales.length ? (
          <TableWrap label="ยอดขายล่าสุดของสินค้านี้">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">เลขที่บิล</th>
                  <th scope="col">วันเวลา</th>
                  <th scope="col">ลูกค้า</th>
                  <th scope="col" className="num">
                    จำนวน
                  </th>
                  <th scope="col" className="num">
                    รวม (บาท)
                  </th>
                  <th scope="col">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/orders/${s.id}`} className="mono-link">
                        {s.no}
                      </Link>
                    </td>
                    <td className="nowrap">{dateTime(s.createdAt)}</td>
                    <td>{s.customerName ?? 'ลูกค้าทั่วไป'}</td>
                    <td className="num">{s.line.qty}</td>
                    <td className="num">{baht(s.line.total)}</td>
                    <td>{STATUS_LABEL[s.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="muted">ยังไม่มีการขายสินค้านี้</p>
        )}
      </Card>

      {record && (
        <Card title="ข้อมูลรุ่นจากแค็ตตาล็อก" className="section-gap">
          <RobotRecord record={record as unknown as Model} />
        </Card>
      )}
    </>
  )
}

function EditForm({ product, onSaved }: { product: ProductRow; onSaved: () => void }) {
  const notify = useToast()
  const [price, setPrice] = useState(String(product.price))
  const [cost, setCost] = useState(String(product.cost))
  const [reorder, setReorder] = useState(String(product.reorderLevel))
  const [active, setActive] = useState(product.active)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/products/${product.id}`, {
        method: 'PATCH',
        body: { price: parseAmount(price), cost: parseAmount(cost), reorderLevel: Number(reorder), active },
      })
      notify(`บันทึก ${product.name} แล้ว`)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__row">
        <Field label="ราคาขาย รวม VAT (บาท)">{(id) => <input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        <Field label="ต้นทุนต่อหน่วย (บาท)">{(id) => <input id={id} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
      </div>
      {product.trackStock && (
        <Field label="จุดสั่งซื้อ (แจ้งเตือนเมื่อเหลือเท่านี้)">{(id) => <input id={id} inputMode="numeric" value={reorder} onChange={(e) => setReorder(e.target.value.replace(/\D/g, ''))} />}</Field>
      )}
      <label className="check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        เปิดขายในหน้าร้าน
      </label>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'กำลังบันทึก' : 'บันทึกราคาและสถานะ'}
        </button>
      </div>
    </form>
  )
}

function ReceiveForm({ product, onDone }: { product: ProductRow; onDone: () => void }) {
  const notify = useToast()
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const p = await api<ProductRow>(`/products/${product.id}/receive`, { body: { qty: Number(qty), note: note || null } })
      notify(`รับเข้า ${product.name} ${qty} ${product.unit} คงเหลือ ${p.stock}`)
      setQty('1')
      setNote('')
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form stock-form" onSubmit={submit} noValidate aria-labelledby="receive-title">
      <h3 id="receive-title">รับสินค้าเข้า</h3>
      <Field label={`จำนวนที่รับเข้า (${product.unit})`}>{(id) => <input id={id} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />}</Field>
      <Field label="หมายเหตุ เช่น เลขใบส่งของ (ไม่บังคับ)">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'กำลังบันทึก' : 'บันทึกรับเข้า'}
      </button>
    </form>
  )
}

function AdjustForm({ product, needsPin, onDone }: { product: ProductRow; needsPin: boolean; onDone: () => void }) {
  const notify = useToast()
  const [counted, setCounted] = useState(String(product.stock))
  const [note, setNote] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const diff = Number(counted) - product.stock

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/products/${product.id}/adjust`, { body: { counted: Number(counted), note, managerPin: needsPin ? pin : undefined } })
      notify(`ปรับสต็อก ${product.name} เป็น ${counted} ${product.unit} แล้ว`)
      setNote('')
      setPin('')
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form stock-form" onSubmit={submit} noValidate aria-labelledby="adjust-title">
      <h3 id="adjust-title">นับสต็อกและปรับยอด</h3>
      <Field label={`จำนวนที่นับได้จริง (${product.unit})`} hint={`ในระบบมี ${product.stock} ${product.unit}${counted !== '' && diff !== 0 ? ` ส่วนต่าง ${diff > 0 ? '+' : ''}${diff}` : ''}`}>
        {(id, d) => <input id={id} inputMode="numeric" value={counted} aria-describedby={d} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} />}
      </Field>
      <Field label="เหตุผลการปรับยอด">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      {needsPin && (
        <Field label="รหัส PIN ผู้จัดการ" hint="การปรับยอดสต็อกต้องให้ผู้จัดการอนุมัติ">
          {(id, d) => <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} aria-describedby={d} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />}
        </Field>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-ghost" disabled={busy}>
        {busy ? 'กำลังบันทึก' : 'บันทึกยอดที่นับได้'}
      </button>
    </form>
  )
}
