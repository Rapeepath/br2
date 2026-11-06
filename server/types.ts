// Shapes stored in the simulated POS database and returned by the API. The admin app imports these too,
// so the server and the screens agree on every field.

export type Role = 'manager' | 'staff'
export type PaymentMethod = 'cash' | 'promptpay' | 'card' | 'transfer'
export type OrderStatus = 'paid' | 'refunded'
export type MovementType = 'initial' | 'receive' | 'adjust' | 'sale' | 'refund'
export type ActivityType =
  | 'login'
  | 'logout'
  | 'sale'
  | 'refund'
  | 'stock'
  | 'product'
  | 'customer'
  | 'shift'
  | 'settings'
  | 'reset'

export interface Staff {
  id: string
  name: string
  /** Job title shown beside the name ("ผู้จัดการร้าน") */
  title: string
  role: Role
  /** Demo PIN, printed on the sign-in screen; stored hashed */
  pinHash: string
  /** Tint key for the avatar bubble */
  tone: string
}

/** Staff as the API returns them (never the PIN hash). */
export type PublicStaff = Omit<Staff, 'pinHash'>

export interface Session {
  token: string
  staffId: string
  createdAt: string
  expiresAt: string
}

export interface Category {
  id: string
  label: string
  /** Sell by this unit ("ตัว", "เครื่อง", "ชิ้น", "ครั้ง") */
  unit: string
}

export interface Product {
  id: string
  sku: string
  name: string
  /** Secondary line: English model name, grade or pack size */
  subtitle: string
  categoryId: string
  /** Id of the catalogue record this product comes from (breed or robot model), when it has one */
  refId: string | null
  /** Variant within that record ("เกรดเลี้ยง", "G1 Pro") */
  variant: string | null
  /** Selling price including VAT, baht */
  price: number
  /** Unit cost, baht (for margin reports) */
  cost: number
  stock: number
  reorderLevel: number
  /** Services and made-to-order items don't count stock */
  trackStock: boolean
  /** Sold as individual units with their own records (Maew's kittens); stock = units available */
  unitTracked?: boolean
  active: boolean
  /** Site-relative image path ("images/siamese-sm.jpg"), null for items without a photo */
  image: string | null
  /** Short facts shown on the POS tile and in the product sheet */
  facts: { label: string; value: string }[]
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  /** A company or institution buys on a full tax invoice */
  kind: 'person' | 'company'
  taxId: string | null
  address: string | null
  note: string | null
  createdAt: string
}

export interface OrderLine {
  productId: string
  sku: string
  name: string
  qty: number
  unitPrice: number
  /** Baht off this line (already multiplied by qty) */
  discount: number
  /** qty × unitPrice − discount */
  total: number
  unitCost: number
  /** The individual units sold on this line (kittens) */
  unitIds?: string[]
}

export interface Payment {
  method: PaymentMethod
  /** Amount charged (= order total) */
  amount: number
  /** Cash handed over; change = tendered − amount */
  tendered: number | null
  change: number | null
  /** Simulated card approval code / PromptPay or transfer reference */
  reference: string | null
  cardLast4: string | null
}

export interface Order {
  id: string
  /** Receipt number, e.g. MW691106-0007 (Buddhist-era date + running number of the day) */
  no: string
  createdAt: string
  staffId: string
  staffName: string
  shiftId: string | null
  customerId: string | null
  customerName: string | null
  lines: OrderLine[]
  /** Σ qty × unitPrice */
  subtotal: number
  /** Σ line discounts */
  lineDiscount: number
  /** Discount on the whole bill, baht */
  billDiscount: number
  /** What the customer pays (VAT included) */
  total: number
  /** VAT contained in total */
  vat: number
  /** total − vat */
  beforeVat: number
  vatRate: number
  payment: Payment
  status: OrderStatus
  refund: { at: string; staffId: string; staffName: string; approvedBy: string; reason: string } | null
  note: string | null
  /** Deposit paid earlier on a reservation and taken off what was due at the till */
  depositApplied?: number
  /** The reservation (Maew) or quotation (Servo) this sale completed */
  reservationNo?: string | null
  quotationNo?: string | null
}

export interface StockMovement {
  id: string
  at: string
  productId: string
  type: MovementType
  /** Signed change in stock */
  qty: number
  /** Stock after this movement */
  balance: number
  /** Receipt number for sales and refunds */
  ref: string | null
  staffId: string | null
  note: string | null
}

export interface CashMove {
  at: string
  type: 'in' | 'out'
  amount: number
  reason: string
  staffId: string
}

export interface Shift {
  id: string
  no: number
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string
  openingCash: number
  cashMoves: CashMove[]
  closedAt: string | null
  closedBy: string | null
  /** Opening cash + cash sales − cash refunds + pay-ins − pay-outs, fixed when the shift closes */
  expectedCash: number | null
  countedCash: number | null
  /** counted − expected (negative = drawer short) */
  difference: number | null
  note: string | null
}

export interface Activity {
  id: string
  at: string
  type: ActivityType
  staffId: string | null
  staffName: string | null
  message: string
  /** Receipt number, product id, customer id … the entry is about */
  ref: string | null
}

export interface Settings {
  storeName: string
  branch: string
  address: string
  phone: string
  taxId: string
  /** Percent, prices on the shelf include it */
  vatRate: number
  receiptFooter: string
  /** Receipt-number prefix */
  receiptPrefix: string
  // Contact shown on the brochure (the business is fictional). Optional in the type only so older code
  // that builds a Settings object keeps compiling; every seeded database has them.
  email?: string
  /** LINE Official Account id, e.g. @maewcathouse */
  lineId?: string
  lineUrl?: string
  /** Google Maps link for the address */
  mapUrl?: string
  /** Opening hours per weekday; a weekday missing from the list is closed */
  hours?: OpeningHours[]
  /** The public site's origin, for canonical links and quotation links */
  siteUrl?: string
}

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday */
  day: number
  open: string
  close: string
}

export interface Db {
  version: number
  /** When the simulated history was generated */
  seededAt: string
  settings: Settings
  categories: Category[]
  staff: Staff[]
  sessions: Session[]
  products: Product[]
  customers: Customer[]
  orders: Order[]
  movements: StockMovement[]
  shifts: Shift[]
  activity: Activity[]
  counters: Record<string, number>
  // CRM collections (both sites)
  leads: Lead[]
  bookings: Booking[]
  reviews: Review[]
  // Servo only (empty in Maew)
  quotations: Quotation[]
  // Maew only (empty in Servo)
  kittens: KittenUnit[]
  reservations: Reservation[]
}

// ---------- CRM ----------

export type Lang = 'th' | 'en'
export type LeadKind = 'inquiry' | 'booking' | 'quote' | 'reservation' | 'privacy'
export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'won' | 'lost' | 'closed'

export interface LeadNote {
  at: string
  staffId: string
  staffName: string
  text: string
}

/** Anyone who got in touch from the brochure: an inquiry, a booking, a quotation, a reservation or a PDPA request. */
export interface Lead {
  id: string
  /** LD691106-0001 */
  no: string
  createdAt: string
  updatedAt: string
  kind: LeadKind
  status: LeadStatus
  name: string
  phone: string
  email: string | null
  lineId: string | null
  message: string | null
  /** Breeds or robot models the lead is about */
  refIds: string[]
  /** Brochure page the form was sent from */
  page: string | null
  lang: Lang
  consentAt: string
  notes: LeadNote[]
  /** Staff id */
  assignedTo: string | null
  linked: { bookingNo?: string; quoteNo?: string; reservationNo?: string }
  /** PDPA data-subject requests only */
  request: 'access' | 'delete' | 'correct' | null
  /** Set when the person's data was wiped on request; the record stays for the audit trail */
  anonymisedAt: string | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled' | 'no-show'

/** A visit (Maew: meet the kittens) or a demonstration (Servo) at the shop. */
export interface Booking {
  id: string
  /** BK691106-0001 */
  no: string
  createdAt: string
  updatedAt: string
  /** Bangkok day and start time */
  date: string
  time: string
  durationMin: number
  refId: string | null
  name: string
  phone: string
  email: string | null
  note: string | null
  lang: Lang
  status: BookingStatus
  leadId: string | null
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

/** A visitor's review of a breed or robot model; shown only once a manager approves it. */
export interface Review {
  id: string
  refId: string
  name: string
  rating: number
  title: string | null
  body: string
  lang: Lang
  status: ReviewStatus
  createdAt: string
  moderatedBy: string | null
  moderatedAt: string | null
}

/** Price figures of a cart without its lines */
export type Totals = Omit<Quote, 'lines'>

export interface Financing {
  /** cash = no financing; hire = เช่าซื้อ (flat rate); lease = ลีสซิ่ง (operating lease) */
  mode: 'cash' | 'hire' | 'lease'
  downPct: number
  months: number
  /** Flat interest per year, percent */
  ratePct: number
  downPayment: number
  financed: number
  monthly: number
  totalPayable: number
}

export interface QuotationCustomer {
  name: string
  company: string | null
  taxId: string | null
  phone: string
  email: string | null
  address: string | null
}

export type QuotationStatus = 'sent' | 'accepted' | 'expired' | 'converted'

/** Servo: a priced configuration a visitor requested from the configurator. */
export interface Quotation {
  id: string
  /** QT691106-0001 */
  no: string
  /** Secret for the public quotation link */
  token: string
  createdAt: string
  updatedAt: string
  validUntil: string
  customer: QuotationCustomer
  lines: OrderLine[]
  totals: Totals
  financing: Financing | null
  note: string | null
  lang: Lang
  status: QuotationStatus
  leadId: string | null
  orderNo: string | null
}

export type Sex = 'male' | 'female'
export type GeneticResult = 'negative' | 'carrier' | 'not-tested'
export type KittenStatus = 'available' | 'reserved' | 'sold' | 'withdrawn'

/** Maew: one kitten in the shop, with its own health record. */
export interface KittenUnit {
  id: string
  /** K-SIA-0001 */
  code: string
  productId: string
  /** Breed id */
  refId: string
  /** Grade label of the product (เกรดเลี้ยง / เกรดประกวด) */
  grade: string | null
  name: string
  sex: Sex
  color: string
  birthDate: string
  microchip: boolean
  vaccines: { name: string; date: string }[]
  vetCheckAt: string | null
  geneticTests: { name: string; result: GeneticResult }[]
  sire: string
  dam: string
  /** Which breed photo to show (0 = the main one; clamp to the gallery) */
  photoIndex: number
  /** Price override; null = the product's price */
  price: number | null
  status: KittenStatus
  orderNo: string | null
  reservationNo: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export type ReservationStatus = 'pending-payment' | 'held' | 'completed' | 'cancelled' | 'expired'

/** Maew: a kitten held for a buyer against a deposit. */
export interface Reservation {
  id: string
  /** RS691106-0001 */
  no: string
  token: string
  unitId: string
  productId: string
  createdAt: string
  updatedAt: string
  /** Unpaid: 2 h from booking; paid: 48 h from payment */
  holdUntil: string
  deposit: { amount: number; method: 'promptpay' | 'transfer' | null; reference: string | null; paidAt: string | null }
  customer: { name: string; phone: string; email: string | null; lineId: string | null; address: string | null }
  pickup: 'store' | 'delivery'
  note: string | null
  lang: Lang
  status: ReservationStatus
  leadId: string | null
  orderNo: string | null
  cancelReason: string | null
}

export interface CrmCounts {
  newLeads: number
  openLeads: number
  bookingsToday: number
  bookingsUpcoming: number
  pendingReviews: number
  quotesOpen: number
  reservationsHeld: number
}

// ---------- API payloads ----------

export interface CartLineInput {
  productId: string
  qty: number
  /** Baht off the whole line */
  discount?: number
  /** A specific kitten to sell on this line (else the oldest available one) */
  unitId?: string | null
  /** Several specific kittens on one line: qty is the number of kittens, each priced at its own price */
  unitIds?: string[]
}

export interface CheckoutInput {
  lines: CartLineInput[]
  billDiscount?: { type: 'amount' | 'percent'; value: number }
  customerId?: string | null
  payment: { method: PaymentMethod; tendered?: number | null; cardLast4?: string | null }
  note?: string | null
  /** Complete a paid reservation: its kitten is sold and the deposit is taken off what is due */
  reservationNo?: string | null
  /** Mark a quotation converted by this sale */
  quotationNo?: string | null
}

export interface Quote {
  /** Unit-tracked lines (kittens) say which kittens they price, the named ones or the oldest available */
  lines: OrderLine[]
  subtotal: number
  lineDiscount: number
  billDiscount: number
  total: number
  vat: number
  beforeVat: number
  vatRate: number
  /** Set when the cart completes a paid reservation: its deposit comes off what is due at the till */
  reservationNo?: string
  depositApplied?: number
  amountDue?: number
}

export interface SalesSummary {
  orders: number
  items: number
  /** Paid orders' totals, refunds excluded */
  revenue: number
  discounts: number
  vat: number
  cost: number
  /** revenue − vat − cost */
  grossProfit: number
  avgTicket: number
  refunds: number
  refundAmount: number
}

export interface DayPoint {
  day: string
  revenue: number
  orders: number
}

export interface Dashboard {
  now: string
  today: SalesSummary
  /** Yesterday up to the same time of day, so the comparison is fair */
  yesterdaySoFar: SalesSummary
  last30: SalesSummary
  days: DayPoint[]
  topProducts: { productId: string; name: string; qty: number; revenue: number }[]
  byPayment: { method: PaymentMethod; orders: number; revenue: number }[]
  byCategory: { categoryId: string; label: string; qty: number; revenue: number }[]
  lowStock: Product[]
  recentOrders: Order[]
  shift: (Shift & { expectedNow: number; cashSales: number }) | null
  counts: { products: number; customers: number; orders: number; stockValue: number; stockUnits: number }
  /** Added by the API route */
  crm?: CrmCounts
}

export interface SalesReport {
  from: string
  to: string
  summary: SalesSummary
  byDay: DayPoint[]
  byProduct: { productId: string; sku: string; name: string; categoryId: string; qty: number; revenue: number; cost: number; profit: number }[]
  byCategory: { categoryId: string; label: string; qty: number; revenue: number }[]
  byPayment: { method: PaymentMethod; orders: number; revenue: number }[]
  byStaff: { staffId: string; name: string; orders: number; revenue: number }[]
  /** 24 entries, Bangkok hour of day */
  byHour: { hour: number; orders: number; revenue: number }[]
}
