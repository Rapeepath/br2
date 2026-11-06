import { useState, type FormEvent } from 'react'
import { Wallet } from 'lucide-react'
import { api, errorMessage } from './api'
import { KIND_LABEL } from './format'
import { useSession, useToast } from './session'
import type { Customer, CustomerKind, Shift } from './types'
import { Field, Segmented, parseAmount } from './ui'

/** Opening a shift: count the float into the drawer first. */
export function OpenShiftForm({ onOpened }: { onOpened?: (s: Shift) => void }) {
  const { refreshShift } = useSession()
  const notify = useToast()
  const [cash, setCash] = useState('5000')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = parseAmount(cash)
    if (!(amount >= 0)) return setError('ใส่เงินทอนตั้งต้นเป็นตัวเลข 0 ขึ้นไป')
    setBusy(true)
    setError(null)
    try {
      const s = await api<Shift>('/shifts/open', { body: { openingCash: amount } })
      notify(`เปิดกะ #${s.no} แล้ว`)
      refreshShift()
      onOpened?.(s)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="open-shift" onSubmit={submit} noValidate>
      <div className="open-shift__text">
        <h2>ยังไม่ได้เปิดกะ</h2>
        <p>นับเงินทอนใส่ลิ้นชัก แล้วเปิดกะก่อนเริ่มขาย ยอดเงินสดทุกบิลจะนับรวมในกะนี้จนกว่าจะปิดกะ</p>
      </div>
      <Field label="เงินทอนตั้งต้นในลิ้นชัก (บาท)" error={error}>
        {(id, d) => <input id={id} inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} aria-describedby={d} />}
      </Field>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        <Wallet size={18} aria-hidden />
        {busy ? 'กำลังเปิดกะ' : 'เปิดกะ'}
      </button>
    </form>
  )
}

/** Add or edit a customer; companies get tax-invoice details. Shows the server's own validation messages. */
export function CustomerForm({
  initial,
  prefill,
  onSaved,
  submitLabel,
}: {
  initial?: Customer
  /** Starting values for a new customer (from a quotation, say); saving still creates one */
  prefill?: Partial<Pick<Customer, 'kind' | 'name' | 'phone' | 'email' | 'taxId' | 'address' | 'note'>>
  onSaved: (c: Customer) => void
  submitLabel?: string
}) {
  const start = initial ?? prefill
  const [kind, setKind] = useState<CustomerKind>(start?.kind ?? 'person')
  const [name, setName] = useState(start?.name ?? '')
  const [phone, setPhone] = useState(start?.phone ?? '')
  const [email, setEmail] = useState(start?.email ?? '')
  const [taxId, setTaxId] = useState(start?.taxId ?? '')
  const [address, setAddress] = useState(start?.address ?? '')
  const [note, setNote] = useState(start?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = { kind, name, phone, email: email || null, taxId: taxId || null, address: address || null, note: note || null }
    try {
      const c = initial
        ? await api<Customer>(`/customers/${initial.id}`, { method: 'PATCH', body })
        : await api<Customer>('/customers', { body })
      onSaved(c)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Segmented<CustomerKind>
        legend="ประเภทลูกค้า"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'person', label: KIND_LABEL.person },
          { value: 'company', label: KIND_LABEL.company },
        ]}
      />
      <Field label={kind === 'company' ? 'ชื่อบริษัทหรือหน่วยงาน' : 'ชื่อ-นามสกุล'}>
        {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />}
      </Field>
      <div className="form__row">
        <Field label="เบอร์โทร">{(id) => <input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />}</Field>
        <Field label="อีเมล (ไม่บังคับ)">{(id) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      </div>
      <Field
        label={kind === 'company' ? 'เลขประจำตัวผู้เสียภาษี 13 หลัก' : 'เลขประจำตัวผู้เสียภาษี (ไม่บังคับ)'}
        hint={kind === 'company' ? 'ใช้ออกใบกำกับภาษีเต็มรูป' : 'กรอกเมื่อลูกค้าต้องการใบกำกับภาษีเต็มรูป'}
      >
        {(id, d) => <input id={id} inputMode="numeric" value={taxId} maxLength={13} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))} aria-describedby={d} />}
      </Field>
      <Field label={kind === 'company' ? 'ที่อยู่สำหรับออกใบกำกับภาษี' : 'ที่อยู่ (ไม่บังคับ)'}>
        {(id) => <textarea id={id} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />}
      </Field>
      <Field label="หมายเหตุ (ไม่บังคับ)">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'กำลังบันทึก' : (submitLabel ?? (initial ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'))}
        </button>
      </div>
    </form>
  )
}
