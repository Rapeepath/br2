// The server's shapes, plus the extra fields its endpoints add (see server/api.ts).
import type {
  Booking,
  Category,
  Customer,
  Lead,
  LeadStatus,
  Order,
  Quotation,
  PaymentMethod,
  Product,
  PublicStaff,
  SalesSummary,
  Settings,
  Shift,
  StockMovement,
} from '../../server/types.ts'

export type {
  Activity,
  ActivityType,
  CartLineInput,
  Category,
  CheckoutInput,
  Customer,
  Dashboard,
  MovementType,
  Order,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  Product,
  PublicStaff,
  Quote,
  Role,
  SalesReport,
  SalesSummary,
  Settings,
  Shift,
  StockMovement,
} from '../../server/types.ts'

export type {
  Booking,
  BookingStatus,
  CrmCounts,
  Financing,
  Lang,
  Lead,
  LeadKind,
  LeadNote,
  LeadStatus,
  OpeningHours,
  Quotation,
  QuotationCustomer,
  QuotationStatus,
  Review,
  ReviewStatus,
} from '../../server/types.ts'

export type CustomerKind = Customer['kind']

/** A lead as the list and detail endpoints return it, with its assigned staff member */
export type LeadRow = Lead & { assignee: PublicStaff | null }

export interface LeadList {
  total: number
  counts: Record<LeadStatus, number>
  rows: LeadRow[]
}

export interface LeadDetail {
  lead: LeadRow
  booking: Booking | null
  quotation: Quotation | null
  reservation: { no: string; status: string } | null
}

export interface QuotationDetail {
  quotation: Quotation
  lead: Lead | null
  /** The visitor's printable quotation on the brochure */
  publicPath: string
}

/** What POST /api/quotes/:id/to-cart returns: the quotation ready to ring up at the till */
export interface CartFromQuote {
  quotationNo: string
  lines: { productId: string; qty: number; discount?: number }[]
  customer: Customer | null
  quotedTotal: number
}

export interface SlotDay {
  date: string
  open: boolean
  hours: { open: string; close: string } | null
  durationMin: number
  slots: { time: string; available: boolean }[]
}

export interface ProductRow extends Product {
  unit: string
  sold: number
  revenue: number
  lastSoldAt: string | null
}

export interface ProductDetail {
  product: ProductRow
  movements: StockMovement[]
  sales: { id: string; no: string; createdAt: string; status: Order['status']; customerName: string | null; line: Order['lines'][number] }[]
  record: Record<string, unknown> | null
}

export interface OrderList {
  from: string
  to: string
  total: number
  revenue: number
  rows: Order[]
}

export interface OrderDetail {
  order: Order
  customer: Customer | null
  settings: Settings
}

export interface CustomerRow extends Customer {
  orders: number
  spent: number
  lastOrderAt: string | null
}

export interface CustomerDetail {
  customer: CustomerRow
  orders: Order[]
}

export interface ShiftView extends Shift {
  expectedNow: number
  cashSales: number
  cashRefunds: number
  summary: SalesSummary
  byPayment: { method: PaymentMethod; orders: number; revenue: number }[]
}

export interface Meta {
  settings: Settings
  categories: Category[]
  staff: PublicStaff[]
  paymentMethods: { id: PaymentMethod; label: string }[]
  seededAt: string
  file: string
}

export interface Paged<T> {
  total: number
  rows: T[]
}

export type MovementRow = StockMovement & { productName: string }
