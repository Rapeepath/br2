import { useState, type FormEvent } from 'react'
import { ExternalLink, LogIn } from 'lucide-react'
import { BrandMark } from '../../components/BrandMark'
import { api, errorMessage, setToken } from '../api'
import { ROLE_LABEL } from '../format'
import { useLoad } from '../hooks'
import type { PublicStaff } from '../types'
import { Avatar, ErrorNote, Loading } from '../ui'
import './login.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function LoginPage({ onLogin, notice }: { onLogin: (staff: PublicStaff) => void; notice: string | null }) {
  const list = useLoad((signal) => api<PublicStaff[]>('/staff', { signal }), [])
  const [staffId, setStaffId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const chosen = list.data?.find((s) => s.id === staffId) ?? null
  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!staffId) return setError('เลือกพนักงานก่อน')
    if (pin.length < 4) return setError('ใส่รหัส PIN 4 หลัก')
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ token: string; staff: PublicStaff }>('/auth/login', { body: { staffId, pin } })
      setToken(res.token)
      onLogin(res.staff)
    } catch (err) {
      setError(errorMessage(err))
      setPin('')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <section className="login__cover on-navy" aria-labelledby="login-brand">
        <div className="login__brand">
          <BrandMark size={48} />
          <div>
            <p id="login-brand" className="login__name" lang="en">
              SERVO
            </p>
            <p className="login__sub">หลังร้านโชว์รูมหุ่นยนต์ฮิวแมนนอยด์</p>
          </div>
        </div>
        <p className="login__about">
          ระบบขายหน้าร้านและหลังร้านแบบจำลอง ขายจริง <span className="nowrap">ตัดสต็อกจริง</span> ออกใบเสร็จได้ แต่ไม่มีการรับเงินจริง ข้อมูลย้อนหลัง 60 วันสร้างขึ้นเพื่อทดลองใช้งาน
        </p>
        <a className="login__site" href="../">
          <ExternalLink size={16} aria-hidden />
          กลับไปหน้าเว็บไซต์
        </a>
      </section>

      <main className="login__main" id="main">
        <form className="login__card" onSubmit={submit} noValidate>
          <h1>เข้าสู่ระบบหลังร้าน</h1>
          {notice && (
            <p className="login__notice" role="status">
              {notice}
            </p>
          )}

          <fieldset className="login__staff">
            <legend>เลือกพนักงาน</legend>
            {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
            {!list.data && !list.error && <Loading label="กำลังโหลดรายชื่อพนักงาน" />}
            <div className="login__staff-grid">
              {list.data?.map((s) => (
                <label key={s.id} className="staff-card">
                  <input
                    type="radio"
                    name="staff"
                    value={s.id}
                    checked={staffId === s.id}
                    onChange={() => {
                      setStaffId(s.id)
                      setError(null)
                    }}
                  />
                  <Avatar name={s.name} tone={s.tone} />
                  <span className="staff-card__text">
                    <span className="staff-card__name">{s.name}</span>
                    <span className="staff-card__title">
                      {s.title} ({ROLE_LABEL[s.role]})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="login__pin">
            <label htmlFor="pin">รหัส PIN{chosen ? ` ของ${chosen.name}` : ''}</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              aria-describedby="pin-hint"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p id="pin-hint" className="login__hint">
              รหัสทดลอง: ผู้จัดการ 1111 พนักงาน 2222 หรือ 3333
            </p>
            <div className="keypad" role="group" aria-label="แป้นตัวเลข">
              {KEYS.map((k) => (
                <button key={k} type="button" className="keypad__key" onClick={() => press(k)}>
                  {k}
                </button>
              ))}
              <button type="button" className="keypad__key keypad__key--text" onClick={() => setPin('')}>
                ล้าง
              </button>
              <button type="button" className="keypad__key" onClick={() => press('0')}>
                0
              </button>
              <button type="button" className="keypad__key keypad__key--text" onClick={() => setPin((p) => p.slice(0, -1))}>
                ลบ
              </button>
            </div>
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary login__submit" disabled={busy}>
            <LogIn size={18} aria-hidden />
            {busy ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </main>
    </div>
  )
}
