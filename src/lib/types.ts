export type Range = [number, number]

/** What a robot is mainly bought for (one primary use per model). */
export type Category = 'research' | 'education' | 'home' | 'industrial' | 'service'
/** Two legs, or a humanoid upper body on a wheeled base. */
export type Locomotion = 'legs' | 'wheels'
export type OriginGroup = 'china' | 'usa' | 'europe' | 'korea' | 'japan'
/** How a buyer in Thailand gets one: from a Thai dealer, by importing it, or by pre-ordering. */
export type Availability = 'thai-dealer' | 'import' | 'preorder'
export type Currency = 'THB' | 'USD' | 'CNY' | 'EUR'

export interface Source {
  title: string
  url: string
}

/**
 * One version of a robot as the maker sells it (G1 "Basic" vs "EDU"); any figure the maker doesn't
 * publish is null.
 */
export interface Trim {
  name: string
  /** A Thai dealer's published baht price, or the maker's list price converted at market.fx */
  priceTHB: number | null
  /** The maker's own list price in its currency; null when the only price is a Thai dealer's */
  listPrice: { amount: number; currency: Currency } | null
  /** Derived in build-data: a Thai dealer's own price, or the list price converted at market.fx */
  priceBasis: 'dealer' | 'converted' | null
  /** Total joint degrees of freedom as the maker quotes them (hands included where fitted) */
  dof: number | null
  /** Degrees of freedom per hand; null when the variant has no dexterous hand */
  handDof: number | null
  /** What the arms end in ("มือ Dex3-1 สามนิ้ว", "ไม่มีมือ"); null when unstated */
  hand: string | null
  /** Most the arms can carry, kg (both arms unless the maker says per arm) */
  payloadKg: number | null
  /** Top walking (or driving) speed, m/s */
  speedMs: number | null
  /** Typical working time on one charge, hours */
  runtimeH: number | null
  batteryWh: number | null
  /** Onboard computer ("NVIDIA Jetson Orin NX 16GB") */
  compute: string | null
  /** Strongest joint's peak torque, N·m */
  jointTorqueNm: number | null
}

export interface ModelImage {
  src: string
  srcSmall: string
  page: string
  author: string
  license: string
  /** CSS object-position, used to keep the robot in frame on cropped plates */
  focus?: string
  /** Enlargement around `focus` for a robot that is small in a busy photo (1.6 = 160%) */
  zoom?: number
}

/** Lowest and highest value across a model's trims (both ends equal for a single trim). */
export interface SpecSpan {
  price: Range | null
  dof: Range | null
  payloadKg: Range | null
  speedMs: Range | null
  runtimeH: Range | null
  batteryWh: Range | null
}

export interface Model {
  id: string
  brand: string
  nameEn: string
  nameTh: string
  category: Category
  locomotion: Locomotion
  segment: string
  originCountry: string
  originGroup: OriginGroup
  availability: Availability
  /** How to buy one in Thailand: dealer, lead time, who imports it */
  availabilityNote: string
  /** The Thai distributor, or how to order from the maker */
  distributor: string
  /** Gregorian YYYY-MM the maker started selling it */
  launched: string
  tagline: string
  summary: string
  background: string
  /** Standing height, cm (wheeled robots: their usual working height) */
  heightCm: number
  weightKg: Range | null
  trims: Trim[]
  sensors: string[]
  charging: { timeH: number | null; swappable: boolean; note: string | null }
  software: { sdk: string | null; ai: string | null }
  warranty: { robot: string; battery: string | null; note: string | null }
  safety: { features: string[]; certifications: string[] }
  /** Jobs it is sold for or has been shown doing */
  useCases: string[]
  highlights: string[]
  pros: string[]
  cons: string[]
  idealFor: string[]
  considerations: string[]
  funFact: string | null
  /** What the price covers and leaves out (shipping, duty, SDK licence), or rental/subscription terms */
  priceNote: string | null
  image: ModelImage
  sources: Source[]
  /** Derived in build-data from the trims */
  span: SpecSpan
  /** The maker's position in the global shipment ranking (1 = most shipped), null when not listed */
  makerRank: number | null
}

export interface CostItem {
  item: string
  min: number
  max: number
}

export interface Market {
  currency: 'THB'
  asOf: string
  /** Baht per unit of each currency used to convert list prices */
  fx: { usd: number; cny: number; eur: number; date: string; note: string | null; source: Source }
  marketContext: string
  /** Humanoid robots shipped worldwide per maker */
  shipments: { brand: string; units: number; period: string; note: string | null }[]
  priceFactors: string[]
  buyerChecklist: { title: string; detail: string }[]
  setup: { steps: { title: string; detail: string }[]; costs: CostItem[] }
  electricity: { label: string; min: number; max: number; unit: string; note: string | null }[]
  ownershipCost: { yearly: CostItem[]; oneTime: CostItem[] }
  /** Thai companies that sell or demonstrate humanoid robots */
  sellers: { name: string; detail: string; url: string }[]
  /** Well-known humanoids a buyer cannot order yet */
  notForSale: { name: string; brand: string; status: string }[]
  incentives: string[]
  legalNotes: string[]
  sources: Source[]
}
