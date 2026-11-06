import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { api, errorMessage, setToken } from '../api'
import { HALF_HOURS, hoursOf, hoursRows, WEEKDAY_LABEL, type HoursRow } from '../crm'
import { dateTime, ROLE_LABEL } from '../format'
import { Receipt } from '../Receipt'
import { useSession, useToast } from '../session'
import type { Order, Settings } from '../types'
import { Avatar, Card, Dialog, Field, Loading, PageHead, TableWrap } from '../ui'
import './crm.css'
import './settings.css'

/** A made-up bill for the receipt preview, so changes show before anyone sells. */
function sampleOrder(s: Settings): Order {
  const total = 456_000
  const vat = Math.round(((total * s.vatRate) / (100 + s.vatRate)) * 100) / 100
  return {
    id: 'preview',
    no: `${s.receiptPrefix}000000-0000`,
    createdAt: new Date().toISOString(),
    staffId: 'st-1',
    staffName: 'ตัวอย่าง',
    shiftId: null,
    customerId: null,
    customerName: null,
    lines: [{ productId: 'x', sku: 'SV-UNG1-STD', name: 'Unitree G1', qty: 1, unitPrice: total, discount: 0, total, unitCost: 0 }],
    subtotal: total,
    lineDiscount: 0,
    billDiscount: 0,
    total,
    vat,
    beforeVat: total - vat,
    vatRate: s.vatRate,
    payment: { method: 'transfer', amount: total, tendered: null, change: null, reference: 'TR000000', cardLast4: null },
    status: 'paid',
    refund: null,
    note: null,
  }
}

export function SettingsPage() {
  const { meta, isManager, refreshMeta } = useSession()
  const [resetting, setResetting] = useState(false)
  if (!meta) return <Loading />

  return (
    <>
      <PageHead title="ตั้งค่า" lead="ข้อมูลร้านที่พิมพ์บนใบเสร็จ พนักงาน และฐานข้อมูลจำลอง" />
      <div className="settings-grid">
        <Card title="ข้อมูลร้านและใบเสร็จ">
          {isManager ? <SettingsForm key={JSON.stringify(meta.settings)} settings={meta.settings} onSaved={refreshMeta} /> : <ReadOnly settings={meta.settings} />}
        </Card>
        <Card title="ตัวอย่างใบเสร็จ" className="settings-grid__preview">
          <div className="receipt-preview">
            <Receipt order={sampleOrder(meta.settings)} customer={null} settings={meta.settings} />
          </div>
        </Card>
      </div>

      <Card title="พนักงาน" className="section-gap">
        <TableWrap label="รายชื่อพนักงาน">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ชื่อ</th>
                <th scope="col">ตำแหน่ง</th>
                <th scope="col">สิทธิ์</th>
                <th scope="col">ทำได้</th>
              </tr>
            </thead>
            <tbody>
              {meta.staff.map((s) => (
                <tr key={s.id}>
                  <td className="cell-product">
                    <Avatar name={s.name} tone={s.tone} />
                    <span>{s.name}</span>
                  </td>
                  <td>{s.title}</td>
                  <td>
                    <span className={`badge ${s.role === 'manager' ? 'badge--gold' : 'badge--quiet'}`}>{ROLE_LABEL[s.role]}</span>
                  </td>
                  <td className="cell-wide">
                    {s.role === 'manager'
                      ? 'ขาย คืนเงิน แก้ราคาและสถานะสินค้า ปรับยอดสต็อก ตั้งค่าร้าน สร้างข้อมูลจำลองใหม่'
                      : 'ขาย รับสินค้าเข้า เพิ่มลูกค้า เปิดปิดกะ (คืนเงินและปรับสต็อกต้องใช้ PIN ผู้จัดการ)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="ฐานข้อมูลจำลอง" className="section-gap">
        <dl className="kv">
          <div>
            <dt>สร้างข้อมูลเมื่อ</dt>
            <dd>{dateTime(meta.seededAt)}</dd>
          </div>
          <div>
            <dt>ไฟล์ฐานข้อมูล</dt>
            <dd className="mono break">{meta.file}</dd>
          </div>
          <div>
            <dt>หมวดสินค้า</dt>
            <dd>{meta.categories.map((c) => `${c.label} (ขายเป็น${c.unit})`).join(', ')}</dd>
          </div>
          <div>
            <dt>ช่องทางชำระเงิน</dt>
            <dd>{meta.paymentMethods.map((p) => p.label).join(', ')}</dd>
          </div>
        </dl>
        <p className="muted settings-note">
          ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ขายย้อนหลัง 60 วันผ่านกติกาเดียวกับหน้าร้าน การชำระเงินทุกช่องทางไม่มีการตัดเงินจริง
        </p>
        {isManager && (
          <button type="button" className="btn btn-ghost" onClick={() => setResetting(true)}>
            <RotateCcw size={18} aria-hidden />
            สร้างข้อมูลจำลองใหม่
          </button>
        )}
      </Card>

      <Dialog open={resetting} onClose={() => setResetting(false)} title="สร้างข้อมูลจำลองใหม่" size="sm">
        <ResetConfirm onCancel={() => setResetting(false)} />
      </Dialog>
    </>
  )
}

function ReadOnly({ settings: s }: { settings: Settings }) {
  return (
    <>
      <dl className="kv">
        <div>
          <dt>ชื่อร้าน</dt>
          <dd>{s.storeName}</dd>
        </div>
        <div>
          <dt>สาขา</dt>
          <dd>{s.branch}</dd>
        </div>
        <div>
          <dt>ที่อยู่</dt>
          <dd>{s.address}</dd>
        </div>
        <div>
          <dt>โทร</dt>
          <dd>{s.phone}</dd>
        </div>
        <div>
          <dt>เลขประจำตัวผู้เสียภาษี</dt>
          <dd>{s.taxId}</dd>
        </div>
        <div>
          <dt>อัตรา VAT</dt>
          <dd>{s.vatRate}%</dd>
        </div>
        <div>
          <dt>ข้อความท้ายใบเสร็จ</dt>
          <dd>{s.receiptFooter || '–'}</dd>
        </div>
        <div>
          <dt>อีเมลร้าน</dt>
          <dd>{s.email || '–'}</dd>
        </div>
        <div>
          <dt>LINE</dt>
          <dd>
            {s.lineId || '–'}
            {s.lineUrl && <span className="cell-sub break">{s.lineUrl}</span>}
          </dd>
        </div>
        <div>
          <dt>ลิงก์แผนที่</dt>
          <dd className="break">{s.mapUrl || '–'}</dd>
        </div>
        <div>
          <dt>เวลาเปิดทำการ</dt>
          <dd>
            {hoursRows(s.hours).map((r) => (
              <span key={r.day} className="cell-sub">
                {WEEKDAY_LABEL[r.day]} {r.open ? `${r.from}–${r.to} น.` : 'ปิด'}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>ที่อยู่เว็บไซต์</dt>
          <dd className="break">{s.siteUrl || '–'}</dd>
        </div>
      </dl>
      <p className="muted settings-note">เฉพาะผู้จัดการแก้ไขข้อมูลร้านได้</p>
    </>
  )
}

function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const notify = useToast()
  const [f, setF] = useState(settings)
  const [hours, setHours] = useState<HoursRow[]>(() => hoursRows(settings.hours))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Settings) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    let openHours
    try {
      openHours = hoursOf(hours)
    } catch (err) {
      return setError(errorMessage(err))
    }
    setBusy(true)
    setError(null)
    try {
      await api('/settings', { method: 'PATCH', body: { ...f, vatRate: Number(f.vatRate), hours: openHours } })
      notify('บันทึกข้อมูลร้านแล้ว')
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
        <Field label="ชื่อร้าน">{(id) => <input id={id} value={f.storeName} onChange={set('storeName')} />}</Field>
        <Field label="สาขา">{(id) => <input id={id} value={f.branch} onChange={set('branch')} />}</Field>
      </div>
      <Field label="ที่อยู่">{(id) => <textarea id={id} rows={2} value={f.address} onChange={set('address')} />}</Field>
      <div className="form__row">
        <Field label="โทร">{(id) => <input id={id} value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="เลขประจำตัวผู้เสียภาษี">{(id) => <input id={id} inputMode="numeric" maxLength={13} value={f.taxId} onChange={set('taxId')} />}</Field>
        <Field label="อัตรา VAT (%)">{(id) => <input id={id} inputMode="decimal" value={String(f.vatRate)} onChange={set('vatRate')} />}</Field>
      </div>
      <Field label="ข้อความท้ายใบเสร็จ">{(id) => <textarea id={id} rows={2} value={f.receiptFooter} onChange={set('receiptFooter')} />}</Field>

      <h3 className="settings-sub">ช่องทางติดต่อบนเว็บไซต์</h3>
      <div className="form__row">
        <Field label="อีเมลร้าน">{(id) => <input id={id} type="email" value={f.email ?? ''} onChange={set('email')} />}</Field>
        <Field label="LINE ID" hint="บัญชีทางการขึ้นต้นด้วย @">
          {(id, d) => <input id={id} value={f.lineId ?? ''} aria-describedby={d} onChange={set('lineId')} />}
        </Field>
      </div>
      <Field label="ลิงก์เพิ่มเพื่อน LINE">{(id) => <input id={id} type="url" value={f.lineUrl ?? ''} onChange={set('lineUrl')} />}</Field>
      <Field label="ลิงก์แผนที่ (Google Maps)">{(id) => <input id={id} type="url" value={f.mapUrl ?? ''} onChange={set('mapUrl')} />}</Field>
      <Field label="ที่อยู่เว็บไซต์" hint="ใช้ทำลิงก์ใบเสนอราคาที่ส่งให้ลูกค้า">
        {(id, d) => <input id={id} type="url" value={f.siteUrl ?? ''} aria-describedby={d} onChange={set('siteUrl')} />}
      </Field>

      <fieldset className="hours">
        <legend>เวลาเปิดทำการ (ใช้คำนวณช่วงเวลานัดสาธิตบนเว็บไซต์)</legend>
        {hours.map((r) => (
          <div key={r.day} className="hours__row" data-day={r.day}>
            <label className="check">
              <input
                type="checkbox"
                checked={r.open}
                onChange={(e) => setHours((hs) => hs.map((x) => (x.day === r.day ? { ...x, open: e.target.checked } : x)))}
              />
              เปิดวัน{WEEKDAY_LABEL[r.day]}
            </label>
            {r.open ? (
              <>
                <Field label={`วัน${WEEKDAY_LABEL[r.day]} เปิด`}>
                  {(id) => (
                    <select id={id} value={r.from} onChange={(e) => setHours((hs) => hs.map((x) => (x.day === r.day ? { ...x, from: e.target.value } : x)))}>
                      {HALF_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h} น.
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={`วัน${WEEKDAY_LABEL[r.day]} ปิด`}>
                  {(id) => (
                    <select id={id} value={r.to} onChange={(e) => setHours((hs) => hs.map((x) => (x.day === r.day ? { ...x, to: e.target.value } : x)))}>
                      {HALF_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {h} น.
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </>
            ) : (
              <span className="hours__closed">ปิดทั้งวัน ลูกค้านัดวันนี้ไม่ได้</span>
            )}
          </div>
        ))}
      </fieldset>      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'กำลังบันทึก' : 'บันทึกข้อมูลร้าน'}
        </button>
      </div>
    </form>
  )
}

function ResetConfirm({ onCancel }: { onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ token: string; orders: number }>('/admin/reset', { body: {} })
      setToken(res.token)
      // Everything on screen is stale now: start the app again from the dashboard
      window.location.hash = '#/'
      window.location.reload()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  return (
    <div className="form">
      <p>ลบบิล ลูกค้าที่เพิ่ม และการเปลี่ยนแปลงทั้งหมด แล้วสร้างการขายย้อนหลัง 60 วันชุดใหม่ที่จบที่วันนี้ ทุกคนที่เข้าสู่ระบบอยู่จะต้องเข้าใหม่</p>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="button" className="btn btn-primary" onClick={reset} disabled={busy}>
          {busy ? 'กำลังสร้างข้อมูล' : 'สร้างข้อมูลใหม่'}
        </button>
      </div>
    </div>
  )
}
