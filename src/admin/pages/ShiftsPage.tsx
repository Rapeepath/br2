import { useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Lock } from 'lucide-react'
import { api, errorMessage } from '../api'
import { OpenShiftForm } from '../forms'
import { baht, bahtText, dateTime, PAYMENT_LABEL } from '../format'
import { useLoad } from '../hooks'
import { useSession, useToast } from '../session'
import type { ShiftView } from '../types'
import { Card, Dialog, ErrorNote, Field, Loading, PageHead, Pagination, Segmented, Stat, TableWrap, parseAmount } from '../ui'
import './shifts.css'

const PAGE = 15

/** "ตรงยอด", "เงินเกิน 20 บาท", "เงินขาด 40 บาท" — always in words, never colour alone. */
export function differenceText(diff: number): string {
  if (Math.abs(diff) < 0.005) return 'ตรงยอด'
  return diff > 0 ? `เงินเกิน ${bahtText(diff)}` : `เงินขาด ${bahtText(-diff)}`
}

export function ShiftsPage() {
  const { refreshShift, meta } = useSession()
  const list = useLoad((signal) => api<ShiftView[]>('/shifts', { signal }), [])
  const [page, setPage] = useState(0)

  const reload = () => {
    list.reload()
    refreshShift()
  }

  if (!list.data) return list.error ? <ErrorNote message={list.error} onRetry={list.reload} /> : <Loading />
  const open = list.data.find((s) => s.status === 'open') ?? null
  const history = list.data.filter((s) => s.status === 'closed')
  const staffName = (id: string) => meta?.staff.find((s) => s.id === id)?.name ?? id

  return (
    <>
      <PageHead title="กะและเงินสด" lead="เปิดกะด้วยเงินทอนตั้งต้น บันทึกเงินเข้าออกลิ้นชัก แล้วนับเงินตอนปิดกะเทียบกับยอดที่ระบบคำนวณ" />

      {open ? (
        <>
          <section className="shift-now card" aria-labelledby="shift-now-title">
            <div className="shift-now__head">
              <h2 id="shift-now-title">กะ #{open.no} เปิดอยู่</h2>
              <p className="muted">
                เปิดโดย {open.openedBy} เมื่อ {dateTime(open.openedAt)}
              </p>
            </div>
            <div className="stats">
              <Stat label="เงินทอนตั้งต้น" value={bahtText(open.openingCash)} />
              <Stat label="ขายเป็นเงินสด" value={bahtText(open.cashSales)} />
              <Stat label="คืนเงินสด" value={bahtText(open.cashRefunds)} />
              <Stat label="เงินสดที่ควรมีในลิ้นชัก" value={bahtText(open.expectedNow)} tone="gold" />
            </div>
            <div className="shift-now__grid">
              <div>
                <h3>ยอดขายในกะนี้</h3>
                <dl className="kv">
                  <div>
                    <dt>บิลที่ชำระแล้ว</dt>
                    <dd>{open.summary.orders} บิล</dd>
                  </div>
                  <div>
                    <dt>ยอดขายรวม</dt>
                    <dd>{bahtText(open.summary.revenue)}</dd>
                  </div>
                  {open.byPayment.map((p) => (
                    <div key={p.method}>
                      <dt>{PAYMENT_LABEL[p.method]}</dt>
                      <dd>
                        {bahtText(p.revenue)} ({p.orders} บิล)
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt>คืนเงิน</dt>
                    <dd>
                      {open.summary.refunds} บิล ({bahtText(open.summary.refundAmount)})
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3>เงินเข้าออกลิ้นชัก</h3>
                {open.cashMoves.length ? (
                  <ul className="moves">
                    {open.cashMoves.map((m, i) => (
                      <li key={`${m.at}-${i}`}>
                        <span className={`moves__type moves__type--${m.type}`}>{m.type === 'in' ? 'นำเข้า' : 'นำออก'}</span>
                        <span className="moves__reason">
                          {m.reason}
                          <span className="cell-sub">
                            {dateTime(m.at)} โดย {staffName(m.staffId)}
                          </span>
                        </span>
                        <span className="moves__amount">
                          {m.type === 'in' ? '+' : '−'}
                          {baht(m.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">ยังไม่มีการนำเงินเข้าหรือออก</p>
                )}
              </div>
            </div>
          </section>

          <div className="shift-forms">
            <Card title="นำเงินเข้าหรือออกจากลิ้นชัก">
              <CashMoveForm onDone={reload} />
            </Card>
            <Card title="ปิดกะ">
              <CloseShiftForm shift={open} onDone={reload} />
            </Card>
          </div>
        </>
      ) : (
        <div className="card">
          <OpenShiftForm onOpened={reload} />
        </div>
      )}

      <Card title="ประวัติกะ" className="section-gap">
        <TableWrap label="ตารางประวัติกะ">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">กะ</th>
                <th scope="col">เปิด</th>
                <th scope="col">ปิด</th>
                <th scope="col" className="num">
                  เงินทอนตั้งต้น
                </th>
                <th scope="col" className="num">
                  บิล
                </th>
                <th scope="col" className="num">
                  ยอดขาย (บาท)
                </th>
                <th scope="col" className="num">
                  เงินสดที่ควรมี
                </th>
                <th scope="col" className="num">
                  นับได้
                </th>
                <th scope="col">ผลการนับ</th>
                <th scope="col">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(page * PAGE, (page + 1) * PAGE).map((s) => (
                <tr key={s.id}>
                  <th scope="row">#{s.no}</th>
                  <td className="nowrap">
                    {dateTime(s.openedAt)}
                    <span className="cell-sub">{s.openedBy}</span>
                  </td>
                  <td className="nowrap">
                    {s.closedAt ? dateTime(s.closedAt) : '–'}
                    <span className="cell-sub">{s.closedBy}</span>
                  </td>
                  <td className="num">{baht(s.openingCash)}</td>
                  <td className="num">{s.summary.orders}</td>
                  <td className="num">{baht(s.summary.revenue)}</td>
                  <td className="num">{baht(s.expectedCash ?? s.expectedNow)}</td>
                  <td className="num">{s.countedCash !== null ? baht(s.countedCash) : '–'}</td>
                  <td className="nowrap">
                    <span className={`badge ${s.difference ? 'badge--warn' : 'badge--ok'}`}>{differenceText(s.difference ?? 0)}</span>
                  </td>
                  <td>{s.note ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination page={page} pageSize={PAGE} total={history.length} onPage={setPage} />
      </Card>
    </>
  )
}

function CashMoveForm({ onDone }: { onDone: () => void }) {
  const notify = useToast()
  const [type, setType] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/shifts/cash', { body: { type, amount: parseAmount(amount), reason } })
      notify(`${type === 'in' ? 'นำเงินเข้า' : 'นำเงินออก'} ${bahtText(parseAmount(amount))} แล้ว`)
      setAmount('')
      setReason('')
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Segmented<'in' | 'out'>
        legend="ประเภท"
        value={type}
        onChange={setType}
        options={[
          { value: 'out', label: 'นำเงินออก' },
          { value: 'in', label: 'นำเงินเข้า' },
        ]}
      />
      <div className="form__row">
        <Field label="จำนวนเงิน (บาท)">{(id) => <input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        <Field label="เหตุผล">{(id) => <input id={id} value={reason} placeholder="เช่น ซื้อของใช้ในร้าน" onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {type === 'in' ? <ArrowDownToLine size={18} aria-hidden /> : <ArrowUpFromLine size={18} aria-hidden />}
          {busy ? 'กำลังบันทึก' : type === 'in' ? 'บันทึกนำเงินเข้า' : 'บันทึกนำเงินออก'}
        </button>
      </div>
    </form>
  )
}

function CloseShiftForm({ shift, onDone }: { shift: ShiftView; onDone: () => void }) {
  const notify = useToast()
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const value = parseAmount(counted)
  const ready = counted.trim() !== '' && value >= 0
  const diff = ready ? value - shift.expectedNow : 0

  const close = async () => {
    setBusy(true)
    setError(null)
    try {
      const s = await api<ShiftView>('/shifts/close', { body: { countedCash: value, note: note || null } })
      setConfirming(false)
      notify(`ปิดกะ #${s.no} แล้ว ${differenceText(s.difference ?? 0)}`)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!ready) return setError('ใส่ยอดเงินที่นับได้จริงในลิ้นชัก')
        setError(null)
        setConfirming(true)
      }}
    >
      <p className="muted">
        ระบบคำนวณว่าควรมีเงินสด {bahtText(shift.expectedNow)} นับเงินในลิ้นชักแล้วใส่ยอดที่นับได้
      </p>
      <Field label="เงินสดที่นับได้ (บาท)">{(id) => <input id={id} inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />}</Field>
      <p className={`close-preview ${ready ? (Math.abs(diff) >= 0.005 ? 'is-off' : 'is-ok') : ''}`} aria-live="polite" data-testid="close-preview">
        {ready ? `ผลการนับ: ${differenceText(diff)}` : 'ผลการนับจะแสดงเมื่อใส่ยอดเงิน'}
      </p>
      <Field label="หมายเหตุ (ไม่บังคับ)">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-ghost">
          <Lock size={18} aria-hidden />
          ปิดกะ
        </button>
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`ยืนยันปิดกะ #${shift.no}`} size="sm">
        <div className="form">
          <p>
            นับได้ {bahtText(value || 0)} ควรมี {bahtText(shift.expectedNow)} {differenceText(diff)} หลังปิดกะจะขายต่อไม่ได้จนกว่าจะเปิดกะใหม่
          </p>
          <div className="form__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              กลับไปแก้ไข
            </button>
            <button type="button" className="btn btn-primary" onClick={close} disabled={busy}>
              {busy ? 'กำลังปิดกะ' : 'ยืนยันปิดกะ'}
            </button>
          </div>
        </div>
      </Dialog>
    </form>
  )
}
