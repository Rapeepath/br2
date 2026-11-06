// The brochure's own API: no sign-in, read-only views of the shop plus the forms (inquiry, booking,
// review, PDPA request). Every POST passes the honeypot, an explicit consent tick and the per-client rate limit
// (api.ts). Quotation and reservation routes are each shop's extras.
import { createBooking, createLead, createReview, personOf, refIdsOf, reviewSummary, reviewTotals, slotsFor, bookingWindow } from './crm.ts'
import { langOf, publicForm, publicRoute, text } from './http.ts'
import type { Db, Product } from './types.ts'
import { HttpError } from './util.ts'

/** What the brochure may show about the shop */
export function publicStore(db: Db) {
  const s = db.settings
  return {
    storeName: s.storeName,
    branch: s.branch,
    address: s.address,
    phone: s.phone,
    email: s.email ?? '',
    lineId: s.lineId ?? '',
    lineUrl: s.lineUrl ?? '',
    mapUrl: s.mapUrl ?? '',
    hours: s.hours ?? [],
    taxId: s.taxId,
    vatRate: s.vatRate,
    siteUrl: s.siteUrl ?? '',
    /** The shop, its stock and its prices are a demonstration */
    simulated: true,
  }
}

export type StockState = 'in' | 'low' | 'out' | 'service'

export const stockState = (p: Product): StockState =>
  !p.trackStock ? 'service' : p.stock <= 0 ? 'out' : p.stock <= p.reorderLevel ? 'low' : 'in'

export function publicCatalog(db: Db) {
  return db.products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      refId: p.refId,
      variant: p.variant,
      name: p.name,
      subtitle: p.subtitle,
      categoryId: p.categoryId,
      price: p.price,
      stockState: stockState(p),
      stock: p.trackStock ? p.stock : null,
      image: p.image,
      ...(p.unitTracked ? { kittensAvailable: db.kittens.filter((u) => u.productId === p.id && u.status === 'available').length } : {}),
    }))
}

export function registerPublicRoutes() {
  publicRoute('GET', '/api/public/store', ({ store, catalog, now }) => ({
    ...publicStore(store.get()),
    booking: { ...catalog.booking, ...bookingWindow(catalog, now) },
  }))

  publicRoute('GET', '/api/public/catalog', ({ store }) => publicCatalog(store.get()))

  publicRoute('POST', '/api/public/leads', ({ store, catalog, body, now }) => {
    publicForm(body)
    const person = personOf(body)
    const message = text(body.message, 'ข้อความ', { max: 2000, en: 'a message', key: 'message' })!
    return store.write((db) => {
      const lead = createLead(
        db,
        {
          kind: 'inquiry',
          ...person,
          message,
          refIds: refIdsOf(body.refIds, catalog),
          page: text(body.page, 'หน้า', { required: false, max: 200 }),
          lang: langOf(body.lang),
        },
        now,
      )
      return { no: lead.no }
    })
  })

  publicRoute('GET', '/api/public/slots', ({ store, catalog, query, now }) => slotsFor(store.get(), catalog, query.get('date') ?? '', now))

  publicRoute('POST', '/api/public/bookings', ({ store, catalog, body, now }) => {
    publicForm(body)
    const person = personOf(body)
    const refId = refIdsOf(body.refId, catalog)[0] ?? null
    const note = text(body.note, 'หมายเหตุ', { required: false, max: 500, en: 'a note', key: 'note' })
    return store.write((db) => {
      const b = createBooking(
        db,
        catalog,
        { date: body.date, time: body.time, refId, ...person, note, lang: langOf(body.lang), page: text(body.page, 'หน้า', { required: false, max: 200 }) },
        now,
      )
      return { no: b.no, date: b.date, time: b.time, durationMin: b.durationMin, status: b.status }
    })
  })

  publicRoute('GET', '/api/public/reviews', ({ store, query }) => reviewSummary(store.get(), query.get('refId')))

  publicRoute('GET', '/api/public/reviews/summary', ({ store }) => reviewTotals(store.get()))

  publicRoute('POST', '/api/public/reviews', ({ store, catalog, body, now }) => {
    publicForm(body)
    return store.write((db) => {
      createReview(db, catalog, body, now)
      return { status: 'pending' as const }
    })
  })

  publicRoute('POST', '/api/public/privacy', ({ store, body, now }) => {
    publicForm(body)
    const request = body.request
    if (request !== 'access' && request !== 'delete' && request !== 'correct') {
      throw new HttpError(400, 'เลือกประเภทคำขอ', 'VALIDATION', 'Please choose what you are asking for.')
    }
    const person = personOf(body)
    const details = text(body.details, 'รายละเอียดคำขอ', { required: false, max: 2000, en: 'details', key: 'details' })
    return store.write((db) => {
      const label = { access: 'ขอดูข้อมูล', delete: 'ขอลบข้อมูล', correct: 'ขอแก้ไขข้อมูล' }[request as 'access']
      const lead = createLead(
        db,
        { kind: 'privacy', ...person, message: details ? `${label}: ${details}` : label, request, page: '/privacy', lang: langOf(body.lang) },
        now,
      )
      return { no: lead.no }
    })
  })
}
