// JSON API for the admin app, written against plain node:http so it mounts inside Vite's dev and preview
// servers (see vite-plugin.ts) and in the standalone server (index.ts) alike.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadCatalog } from './catalog.ts'
import { crmCounts, housekeep, registerCrmRoutes } from './crm.ts'
import { registerExtras } from './extras.ts'
import { clientIp, day, num, rateLimiter, requireManager, route, routes, text } from './http.ts'
import { registerPublicRoutes } from './public.ts'
import {
  adjustStock,
  approver,
  cashMove,
  checkout,
  closeShift,
  customerStats,
  dashboard,
  getProduct,
  log,
  nextId,
  openShift,
  openShiftOf,
  PAYMENT_LABELS,
  productStats,
  publicStaff,
  quote,
  receiveStock,
  refund,
  salesReport,
  shiftView,
  unitOf,
} from './logic.ts'
import { openStore, type Store } from './store.ts'
import type { CheckoutInput, Customer, Db, OpeningHours, Order, Settings, Staff } from './types.ts'
import { HttpError, addDays, dayKey, hashPin, newToken } from './util.ts'

const SESSION_HOURS = 12

// ---------- Auth ----------

route(
  'GET',
  '/api/staff',
  ({ store }) => store.get().staff.map(publicStaff),
  { public: true },
)

route(
  'POST',
  '/api/auth/login',
  ({ body, store, now }) =>
    store.write((db) => {
      const staff = db.staff.find((s) => s.id === body?.staffId)
      if (!staff || typeof body?.pin !== 'string' || hashPin(staff.id, body.pin) !== staff.pinHash) {
        throw new HttpError(401, 'รหัส PIN ไม่ถูกต้อง')
      }
      // Drop expired sessions while we're here
      db.sessions = db.sessions.filter((s) => s.expiresAt > now.toISOString())
      const token = newToken()
      db.sessions.push({
        token,
        staffId: staff.id,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString(),
      })
      log(db, 'login', staff, `${staff.name} เข้าสู่ระบบ`, null, now)
      return { token, staff: publicStaff(staff) }
    }),
  { public: true },
)

route('POST', '/api/auth/logout', ({ req, store, staff, now }) =>
  store.write((db) => {
    const token = bearer(req)
    db.sessions = db.sessions.filter((s) => s.token !== token)
    log(db, 'logout', staff, `${staff.name} ออกจากระบบ`, null, now)
    return { ok: true }
  }),
)

route('GET', '/api/auth/me', ({ staff }) => publicStaff(staff))

// ---------- Overview ----------

route('GET', '/api/dashboard', ({ store, now }) => ({ ...dashboard(store.get(), now), crm: crmCounts(store.get(), now) }))

route('GET', '/api/meta', ({ store }) => {
  const db = store.get()
  return {
    settings: db.settings,
    categories: db.categories,
    staff: db.staff.map(publicStaff),
    paymentMethods: Object.entries(PAYMENT_LABELS).map(([id, label]) => ({ id, label })),
    seededAt: db.seededAt,
    file: store.file,
  }
})

// ---------- Products & stock ----------

route('GET', '/api/products', ({ store, query }) => {
  const db = store.get()
  const q = (query.get('q') ?? '').trim().toLowerCase()
  const category = query.get('category')
  const stats = productStats(db)
  return db.products
    .filter((p) => !category || p.categoryId === category)
    .filter((p) => !q || `${p.name} ${p.subtitle} ${p.sku}`.toLowerCase().includes(q))
    .map((p) => ({ ...p, unit: unitOf(db, p), sold: stats.get(p.id)?.sold ?? 0, revenue: stats.get(p.id)?.revenue ?? 0, lastSoldAt: stats.get(p.id)?.lastSoldAt ?? null }))
})

route('GET', '/api/products/:id', ({ store, catalog, params }) => {
  const db = store.get()
  const p = getProduct(db, params.id)
  const stats = productStats(db).get(p.id)
  const sales = db.orders
    .filter((o) => o.lines.some((l) => l.productId === p.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((o) => ({ id: o.id, no: o.no, createdAt: o.createdAt, status: o.status, customerName: o.customerName, line: o.lines.find((l) => l.productId === p.id)! }))
  return {
    product: { ...p, unit: unitOf(db, p), sold: stats?.sold ?? 0, revenue: stats?.revenue ?? 0, lastSoldAt: stats?.lastSoldAt ?? null },
    movements: db.movements.filter((m) => m.productId === p.id).sort((a, b) => b.at.localeCompare(a.at)),
    sales,
    // Everything the brochure knows about this breed or robot
    record: p.refId ? (catalog.records.get(p.refId) ?? null) : null,
  }
})

route('PATCH', '/api/products/:id', ({ store, params, body, staff, now }) => {
  requireManager(staff)
  return store.write((db) => {
    const p = getProduct(db, params.id)
    const changes: string[] = []
    if (body.price !== undefined) {
      const price = num(body.price, 'ราคาขาย')
      if (price <= 0) throw new HttpError(400, 'ราคาขายต้องมากกว่า 0')
      if (price !== p.price) changes.push(`ราคา ${p.price.toLocaleString('th-TH')} → ${price.toLocaleString('th-TH')} บาท`)
      p.price = price
    }
    if (body.cost !== undefined) {
      const cost = num(body.cost, 'ต้นทุน')
      if (cost < 0) throw new HttpError(400, 'ต้นทุนต้องไม่ติดลบ')
      if (cost !== p.cost) changes.push(`ต้นทุน ${p.cost.toLocaleString('th-TH')} → ${cost.toLocaleString('th-TH')} บาท`)
      p.cost = cost
    }
    if (body.reorderLevel !== undefined) {
      const level = num(body.reorderLevel, 'จุดสั่งซื้อ')
      if (!Number.isInteger(level) || level < 0) throw new HttpError(400, 'จุดสั่งซื้อต้องเป็นจำนวนเต็ม 0 ขึ้นไป')
      if (level !== p.reorderLevel) changes.push(`จุดสั่งซื้อ ${p.reorderLevel} → ${level}`)
      p.reorderLevel = level
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new HttpError(400, 'สถานะการขายไม่ถูกต้อง')
      if (body.active !== p.active) changes.push(body.active ? 'เปิดขาย' : 'ปิดการขาย')
      p.active = body.active
    }
    if (!changes.length) return p
    p.updatedAt = now.toISOString()
    log(db, 'product', staff, `แก้ไข ${p.name}: ${changes.join(', ')}`, p.id, now)
    return p
  })
})

route('POST', '/api/products/:id/receive', ({ store, params, body, staff, now }) =>
  store.write((db) => receiveStock(db, staff, params.id, num(body.qty, 'จำนวน'), text(body.note, 'หมายเหตุ', { required: false }), now)),
)

route('POST', '/api/products/:id/adjust', ({ store, params, body, staff, now }) =>
  store.write((db) => {
    approver(db, staff, body.managerPin)
    return adjustStock(db, staff, params.id, num(body.counted, 'จำนวนที่นับได้'), text(body.note, 'เหตุผล') ?? '', now)
  }),
)

route('GET', '/api/stock/movements', ({ store, query }) => {
  const db = store.get()
  const type = query.get('type')
  const productId = query.get('productId')
  const limit = Math.min(Number(query.get('limit') ?? 200) || 200, 1000)
  const rows = db.movements
    .filter((m) => (!type || m.type === type) && (!productId || m.productId === productId))
    .sort((a, b) => b.at.localeCompare(a.at))
  const names = new Map(db.products.map((p) => [p.id, p.name]))
  return { total: rows.length, rows: rows.slice(0, limit).map((m) => ({ ...m, productName: names.get(m.productId) ?? m.productId })) }
})

// ---------- Selling ----------

route('POST', '/api/quote', ({ store, body }) => quote(store.get(), body ?? {}))

route('POST', '/api/orders', ({ store, body, staff, now }) =>
  store.write((db) => checkout(db, staff, body as CheckoutInput, now)),
)

route('GET', '/api/orders', ({ store, query }) => {
  const db = store.get()
  const today = dayKey(new Date())
  const from = day(query.get('from'), addDays(today, -29))
  const to = day(query.get('to'), today)
  const status = query.get('status')
  const method = query.get('payment')
  const staffId = query.get('staffId')
  const customerId = query.get('customerId')
  const q = (query.get('q') ?? '').trim().toLowerCase()
  const limit = Math.min(Number(query.get('limit') ?? 50) || 50, 500)
  const offset = Math.max(Number(query.get('offset') ?? 0) || 0, 0)
  const rows = db.orders
    .filter((o) => {
      const d = dayKey(o.createdAt)
      if (d < from || d > to) return false
      if (status && o.status !== status) return false
      if (method && o.payment.method !== method) return false
      if (staffId && o.staffId !== staffId) return false
      if (customerId && o.customerId !== customerId) return false
      if (q && !`${o.no} ${o.customerName ?? ''} ${o.lines.map((l) => l.name).join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const paid = rows.filter((o) => o.status === 'paid')
  return {
    from,
    to,
    total: rows.length,
    revenue: paid.reduce((s, o) => s + o.total, 0),
    rows: rows.slice(offset, offset + limit),
  }
})

route('GET', '/api/orders/:id', ({ store, params }) => {
  const db = store.get()
  const order = db.orders.find((o) => o.id === params.id || o.no === params.id)
  if (!order) throw new HttpError(404, 'ไม่พบบิลนี้')
  const customer = order.customerId ? (db.customers.find((c) => c.id === order.customerId) ?? null) : null
  return { order, customer, settings: db.settings }
})

route('POST', '/api/orders/:id/refund', ({ store, params, body, staff, now }) =>
  store.write((db) => {
    const ok = approver(db, staff, body?.managerPin)
    return refund(db, staff, ok, params.id, text(body?.reason, 'เหตุผลการคืนเงิน') ?? '', now)
  }),
)

// ---------- Customers ----------

const customerInput = (body: any, base?: Customer): Omit<Customer, 'id' | 'createdAt'> => {
  const kind = body.kind ?? base?.kind ?? 'person'
  if (kind !== 'person' && kind !== 'company') throw new HttpError(400, 'ประเภทลูกค้าไม่ถูกต้อง')
  const phone = text(body.phone ?? base?.phone, 'เบอร์โทร', { max: 20 })!
  if (!/^[0-9+\-\s()]{9,20}$/.test(phone)) throw new HttpError(400, 'เบอร์โทรไม่ถูกต้อง')
  const email = text(body.email !== undefined ? body.email : base?.email, 'อีเมล', { required: false, max: 120 })
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'อีเมลไม่ถูกต้อง')
  const taxId = text(body.taxId !== undefined ? body.taxId : base?.taxId, 'เลขประจำตัวผู้เสียภาษี', { required: false, max: 13 })
  if (taxId && !/^\d{13}$/.test(taxId)) throw new HttpError(400, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')
  return {
    name: text(body.name ?? base?.name, 'ชื่อลูกค้า', { max: 120 })!,
    phone,
    email,
    kind,
    taxId,
    address: text(body.address !== undefined ? body.address : base?.address, 'ที่อยู่', { required: false, max: 300 }),
    note: text(body.note !== undefined ? body.note : base?.note, 'หมายเหตุ', { required: false, max: 300 }),
  }
}

route('GET', '/api/customers', ({ store, query }) => {
  const db = store.get()
  const q = (query.get('q') ?? '').trim().toLowerCase()
  return db.customers
    .filter((c) => !q || `${c.name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(q))
    .map((c) => ({ ...c, ...customerStats(db, c.id) }))
    .sort((a, b) => b.spent - a.spent)
})

route('GET', '/api/customers/:id', ({ store, params }) => {
  const db = store.get()
  const c = db.customers.find((x) => x.id === params.id)
  if (!c) throw new HttpError(404, 'ไม่พบลูกค้านี้')
  const orders = db.orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { customer: { ...c, ...customerStats(db, c.id) }, orders }
})

route('POST', '/api/customers', ({ store, body, staff, now }) =>
  store.write((db) => {
    const input = customerInput(body ?? {})
    if (db.customers.some((c) => c.phone.replace(/\D/g, '') === input.phone.replace(/\D/g, ''))) {
      throw new HttpError(409, 'มีลูกค้าที่ใช้เบอร์นี้อยู่แล้ว')
    }
    const c: Customer = { ...input, id: nextId(db, 'c'), createdAt: now.toISOString() }
    db.customers.push(c)
    log(db, 'customer', staff, `เพิ่มลูกค้า ${c.name}`, c.id, now)
    return c
  }),
)

route('PATCH', '/api/customers/:id', ({ store, params, body, staff, now }) =>
  store.write((db) => {
    const c = db.customers.find((x) => x.id === params.id)
    if (!c) throw new HttpError(404, 'ไม่พบลูกค้านี้')
    Object.assign(c, customerInput(body ?? {}, c))
    log(db, 'customer', staff, `แก้ไขข้อมูลลูกค้า ${c.name}`, c.id, now)
    return c
  }),
)

// ---------- Shifts ----------

route('GET', '/api/shifts', ({ store, now }) => {
  const db = store.get()
  return [...db.shifts].reverse().map((s) => shiftView(db, s, now))
})

route('GET', '/api/shifts/current', ({ store, now }) => {
  const db = store.get()
  const s = openShiftOf(db)
  return s ? shiftView(db, s, now) : null
})

route('POST', '/api/shifts/open', ({ store, body, staff, now }) =>
  store.write((db) => openShift(db, staff, num(body?.openingCash, 'เงินทอนตั้งต้น'), now)),
)

route('POST', '/api/shifts/cash', ({ store, body, staff, now }) =>
  store.write((db) => cashMove(db, staff, body?.type === 'in' ? 'in' : 'out', num(body?.amount, 'จำนวนเงิน'), text(body?.reason, 'เหตุผล') ?? '', now)),
)

route('POST', '/api/shifts/close', ({ store, body, staff, now }) =>
  store.write((db) => closeShift(db, staff, num(body?.countedCash, 'ยอดเงินที่นับได้'), text(body?.note, 'หมายเหตุ', { required: false }), now)),
)

// ---------- Reports & logs ----------

route('GET', '/api/reports/sales', ({ store, query }) => {
  const today = dayKey(new Date())
  return salesReport(store.get(), day(query.get('from'), addDays(today, -29)), day(query.get('to'), today))
})

route('GET', '/api/activity', ({ store, query }) => {
  const db = store.get()
  const type = query.get('type')
  const q = (query.get('q') ?? '').trim().toLowerCase()
  const limit = Math.min(Number(query.get('limit') ?? 100) || 100, 1000)
  const offset = Math.max(Number(query.get('offset') ?? 0) || 0, 0)
  const rows = db.activity
    .filter((a) => (!type || a.type === type) && (!q || `${a.message} ${a.staffName ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
  return { total: rows.length, rows: rows.slice(offset, offset + limit) }
})

// ---------- Settings ----------

route('GET', '/api/settings', ({ store }) => store.get().settings)

route('PATCH', '/api/settings', ({ store, body, staff, now }) => {
  requireManager(staff)
  return store.write((db) => {
    const s = db.settings
    const next: Settings = {
      storeName: text(body.storeName ?? s.storeName, 'ชื่อร้าน', { max: 80 })!,
      branch: text(body.branch ?? s.branch, 'สาขา', { max: 80 })!,
      address: text(body.address ?? s.address, 'ที่อยู่', { max: 300 })!,
      phone: text(body.phone ?? s.phone, 'เบอร์โทร', { max: 20 })!,
      taxId: text(body.taxId ?? s.taxId, 'เลขประจำตัวผู้เสียภาษี', { max: 13 })!,
      vatRate: body.vatRate !== undefined ? num(body.vatRate, 'อัตรา VAT') : s.vatRate,
      receiptFooter: text(body.receiptFooter ?? s.receiptFooter, 'ข้อความท้ายใบเสร็จ', { required: false, max: 300 }) ?? '',
      receiptPrefix: s.receiptPrefix,
      email: text(body.email ?? s.email, 'อีเมลร้าน', { required: false, max: 120 }) ?? '',
      lineId: text(body.lineId ?? s.lineId, 'LINE ID', { required: false, max: 50 }) ?? '',
      lineUrl: text(body.lineUrl ?? s.lineUrl, 'ลิงก์ LINE', { required: false, max: 300 }) ?? '',
      mapUrl: text(body.mapUrl ?? s.mapUrl, 'ลิงก์แผนที่', { required: false, max: 500 }) ?? '',
      hours: body.hours !== undefined ? hoursOf(body.hours) : (s.hours ?? []),
      siteUrl: text(body.siteUrl ?? s.siteUrl, 'ที่อยู่เว็บไซต์', { required: false, max: 200 }) ?? '',
    }
    if (next.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next.email)) throw new HttpError(400, 'อีเมลร้านไม่ถูกต้อง')
    for (const u of [next.lineUrl, next.mapUrl, next.siteUrl]) {
      if (u && !/^https?:\/\/\S+$/.test(u)) throw new HttpError(400, 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')
    }
    if (!/^\d{13}$/.test(next.taxId)) throw new HttpError(400, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')
    if (next.vatRate < 0 || next.vatRate > 30) throw new HttpError(400, 'อัตรา VAT ต้องอยู่ระหว่าง 0–30%')
    db.settings = next
    log(db, 'settings', staff, 'แก้ไขข้อมูลร้านและใบเสร็จ', null, now)
    return next
  })
})

route('POST', '/api/admin/reset', ({ store, staff, now }) => {
  requireManager(staff)
  const db = store.reset(now)
  // Keep the manager who pressed reset signed in
  return store.write((d: Db) => {
    const token = newToken()
    d.sessions.push({ token, staffId: staff.id, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + SESSION_HOURS * 3_600_000).toISOString() })
    log(d, 'reset', staff, `สร้างข้อมูลจำลองใหม่ ${db.orders.length.toLocaleString('th-TH')} บิล`, null, now)
    return { token, orders: d.orders.length }
  })
})

route('GET', '/api/export/orders.csv', ({ store, query }) => {
  const db = store.get()
  const today = dayKey(new Date())
  const from = day(query.get('from'), addDays(today, -29))
  const to = day(query.get('to'), today)
  const rows = db.orders.filter((o) => dayKey(o.createdAt) >= from && dayKey(o.createdAt) <= to).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return new CsvBody(`orders-${from}-to-${to}.csv`, ordersCsv(rows))
})

class CsvBody {
  filename: string
  content: string
  constructor(filename: string, content: string) {
    this.filename = filename
    this.content = content
  }
}

function ordersCsv(rows: Order[]): string {
  const head = ['เลขที่บิล', 'วันเวลา', 'พนักงาน', 'ลูกค้า', 'รายการ', 'จำนวนชิ้น', 'ยอดก่อนส่วนลด', 'ส่วนลด', 'ยอดสุทธิ', 'VAT', 'วิธีชำระ', 'สถานะ']
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((o) =>
    [
      o.no,
      new Date(o.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      o.staffName,
      o.customerName ?? 'ลูกค้าทั่วไป',
      o.lines.map((l) => `${l.name} x${l.qty}`).join('; '),
      o.lines.reduce((s, l) => s + l.qty, 0),
      o.subtotal,
      o.lineDiscount + o.billDiscount,
      o.total,
      o.vat,
      PAYMENT_LABELS[o.payment.method],
      o.status === 'paid' ? 'ชำระแล้ว' : 'คืนเงินแล้ว',
    ]
      .map(esc)
      .join(','),
  )
  // BOM so Excel opens Thai text as UTF-8
  return `﻿${[head.join(','), ...lines].join('\r\n')}\r\n`
}

/** Opening hours from the settings form: one entry per open weekday, HH:MM, closing after opening. */
function hoursOf(v: unknown): OpeningHours[] {
  if (!Array.isArray(v)) throw new HttpError(400, 'เวลาเปิดทำการไม่ถูกต้อง')
  const seen = new Set<number>()
  return v
    .map((h) => {
      const day = Number(h?.day)
      const open = String(h?.open ?? '')
      const close = String(h?.close ?? '')
      if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) throw new HttpError(400, 'วันในเวลาเปิดทำการไม่ถูกต้อง')
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) || close <= open) {
        throw new HttpError(400, 'เวลาเปิด–ปิดต้องเป็น HH:MM และปิดหลังเวลาเปิด')
      }
      seen.add(day)
      return { day, open, close }
    })
    .sort((a, b) => a.day - b.day)
}

// ---------- Plumbing ----------

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

async function readBody(req: IncomingMessage): Promise<any> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new HttpError(413, 'ข้อมูลที่ส่งมาใหญ่เกินไป')
    chunks.push(chunk as Buffer)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'ข้อมูลที่ส่งมาไม่ใช่ JSON')
  }
}

function send(res: ServerResponse, status: number, payload: unknown) {
  if (payload instanceof CsvBody) {
    res.writeHead(status, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${payload.filename}"`,
      'Cache-Control': 'no-store',
    })
    res.end(payload.content)
    return
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload ?? null))
}

export interface Api {
  store: Store
  /** Handles /api/* requests; returns false for anything else so the caller can serve the page */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>
}

// The brochure's routes and each shop's extras register once, alongside the admin routes above
registerPublicRoutes()
registerCrmRoutes()
registerExtras()

export interface ApiOptions {
  /** Brochure POSTs per client per 10 minutes (env POS_RATE_LIMIT, default 20) */
  rateLimit?: number
}

export function createApi(root: string, dbFile?: string, opts: ApiOptions = {}): Api {
  const catalog = loadCatalog(root)
  const store = openStore(root, catalog, dbFile)
  const limit = rateLimiter(opts.rateLimit ?? (Number(process.env.POS_RATE_LIMIT) || 20))
  // Holds and quotations lapse on their own; tidy them at most every 30 s, before serving a request
  let tidiedAt = 0

  return {
    store,
    async handle(req, res) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (!url.pathname.startsWith('/api/')) return false
      const now = new Date()
      try {
        if (now.getTime() - tidiedAt > 30_000) {
          tidiedAt = now.getTime()
          housekeep(store, now)
        }
        const match = routes
          .map((r) => ({ r, m: r.method === req.method ? r.pattern.exec(url.pathname) : null }))
          .find((x) => x.m)
        if (!match) {
          const known = routes.some((r) => r.pattern.test(url.pathname))
          throw new HttpError(known ? 405 : 404, known ? 'ไม่รองรับคำสั่งนี้' : 'ไม่พบ API นี้')
        }
        const { r, m } = match
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m![i + 1])]))
        let staff: Staff | undefined
        if (!r.public) {
          const token = bearer(req)
          const db = store.get()
          const session = token ? db.sessions.find((s) => s.token === token && s.expiresAt > now.toISOString()) : undefined
          staff = session ? db.staff.find((s) => s.id === session.staffId) : undefined
          if (!staff) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่')
        }
        // The brochure's forms only (staff sign-in is not limited)
        if (r.public && req.method === 'POST' && url.pathname.startsWith('/api/public/')) limit(clientIp(req), now.getTime())
        const body = await readBody(req)
        const out = await r.handler({ req, params, query: url.searchParams, body, store, catalog, now, staff: staff! })
        send(res, 200, out)
      } catch (err) {
        if (err instanceof HttpError) {
          const field = (err as HttpError & { field?: string }).field
          send(res, err.status, { error: err.message, code: err.code, ...(err.en ? { errorEn: err.en } : {}), ...(field ? { field } : {}) })
        } else {
          console.error('[pos-api]', err)
          send(res, 500, { error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง', code: 'SERVER_ERROR', errorEn: 'Something went wrong. Please try again.' })
        }
      }
      return true
    },
  }
}
