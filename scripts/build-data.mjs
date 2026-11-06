// Builds the site's data from the research notes:
//   research_notes/<topic>/data/{model}.json + market.json  →  src/data/models.json, src/data/market.json
//   research_notes/<topic>/i18n/en/{model}.json + market.json  →  src/data/en.json
// and downloads each robot's main photo from Wikimedia Commons into public/images/. Gallery photos and video
// posters are fetched beforehand by research_notes/<topic>/tools/fetch_gallery.py (Pillow resizing); this script
// only checks that they are there.
//
//   node scripts/build-data.mjs           (reuses images already downloaded)
//   node scripts/build-data.mjs --force   (re-downloads every main image)

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const notesDir = join(root, 'research_notes')
const topic = readdirSync(notesDir).find((d) => existsSync(join(notesDir, d, 'data', 'market.json')))
if (!topic) throw new Error('No research_notes/<topic>/data/market.json found')
const dataDir = join(notesDir, topic, 'data')
const enDir = join(notesDir, topic, 'i18n', 'en')
const publicDir = join(root, 'public')

const FORCE = process.argv.includes('--force')
const UA = 'ServoCatalogue/1.0 (static brochure build; https://commons.wikimedia.org/wiki/Commons:Reuse)'

/** object-position per photo so the robot stays in frame on tighter crops (tuned by eye). */
const FOCUS = {}

const CATEGORIES = ['research', 'education', 'home', 'industrial', 'service']
const LOCOMOTION = ['legs', 'wheels']
const ORIGINS = ['china', 'japan', 'korea', 'europe', 'usa']
const AVAILABILITY = ['thai-dealer', 'import', 'preorder']
const CURRENCIES = ['THB', 'USD', 'CNY', 'EUR']
const TRIM_NUMBERS = ['priceTHB', 'dof', 'handDof', 'payloadKg', 'speedMs', 'runtimeH', 'batteryWh', 'jointTorqueNm']
const SPAN_KEYS = { price: 'priceTHB', dof: 'dof', payloadKg: 'payloadKg', speedMs: 'speedMs', runtimeH: 'runtimeH', batteryWh: 'batteryWh' }

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const VIDEO = /\.(webm|ogv|mpg|mpeg)$/i

/**
 * A Commons thumbnail at one of its standard widths. Videos get a still frame: the first one, or the
 * frame `seek` seconds in when the opening shot doesn't show the robot well.
 */
function thumbUrl(original, width, seek) {
  // https://upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg
  //   → https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/File.jpg/1280px-File.jpg
  // https://upload.wikimedia.org/wikipedia/commons/a/ab/Clip.webm
  //   → https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Clip.webm/1280px-seek%3D20-Clip.webm.jpg
  const m = original.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/(?!thumb\/)(\w\/\w\w)\/([^/]+)$/)
  if (!m) return original
  const [, base, hash, file] = m
  if (VIDEO.test(file)) return `${base}/thumb/${hash}/${file}/${width}px-${seek != null ? `seek%3D${seek}` : ''}-${file}.jpg`
  const name = /\.(png|jpe?g)$/i.test(file) ? file : `${file}.jpg`
  return `${base}/thumb/${hash}/${file}/${width}px-${name}`
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) {
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
      return true
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * attempt)
      continue
    }
    return false
  }
  return false
}

async function fetchImage(id, image) {
  const outDir = join(root, 'public', 'images')
  mkdirSync(outDir, { recursive: true })
  const targets = [
    { file: `${id}.jpg`, width: 1280 },
    { file: `${id}-sm.jpg`, width: 960 },
  ]
  const video = VIDEO.test(image.url)
  for (const t of targets) {
    const dest = join(outDir, t.file)
    if (!FORCE && existsSync(dest)) continue
    // Wikimedia serves only its standard thumbnail widths (500, 960, 1280, ...); one wider than the
    // original is refused, so fall back to a narrower still for a video, or the original photo.
    const urls = video
      ? [t.width, 960, 640].map((w) => thumbUrl(image.url, w, image.seek))
      : [thumbUrl(image.url, t.width), image.url]
    let ok = false
    for (const url of urls) if ((ok = await download(url, dest))) break
    if (!ok) throw new Error(`Could not download image for ${id}: ${image.url}`)
    console.log(`  ↓ ${t.file}`)
    await sleep(600)
  }
  return { src: `images/${id}.jpg`, srcSmall: `images/${id}-sm.jpg` }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v) => v === null || isNum(v)

function validate(m, market, problems) {
  const p = (msg) => problems.push(`${m.id}: ${msg}`)
  for (const k of ['brand', 'nameEn', 'nameTh', 'segment', 'originCountry', 'availabilityNote', 'distributor', 'tagline', 'summary', 'background']) {
    if (typeof m[k] !== 'string' || !m[k].trim()) p(`missing ${k}`)
  }
  if (!CATEGORIES.includes(m.category)) p(`bad category "${m.category}"`)
  if (!LOCOMOTION.includes(m.locomotion)) p(`bad locomotion "${m.locomotion}"`)
  if (!ORIGINS.includes(m.originGroup)) p(`bad originGroup "${m.originGroup}"`)
  if (!AVAILABILITY.includes(m.availability)) p(`bad availability "${m.availability}"`)
  if (!/^\d{4}-\d{2}$/.test(m.launched ?? '')) p('launched is not YYYY-MM')
  if (!isNum(m.heightCm) || m.heightCm < 30 || m.heightCm > 250) p('heightCm missing or implausible')
  if (m.weightKg != null && !(Array.isArray(m.weightKg) && isNum(m.weightKg[0]) && m.weightKg[0] <= m.weightKg[1])) p('bad weightKg')
  if (!Array.isArray(m.trims) || m.trims.length === 0) p('no trims')
  for (const t of m.trims ?? []) {
    const tp = (msg) => p(`trim "${t.name}": ${msg}`)
    if (!t.name) tp('missing name')
    for (const k of TRIM_NUMBERS) if (!isNumOrNull(t[k])) tp(`${k} is not a number or null`)
    for (const k of ['hand', 'compute']) if (!(t[k] === null || typeof t[k] === 'string')) tp(`${k} is not a string or null`)
    if (t.listPrice != null && (!isNum(t.listPrice.amount) || !CURRENCIES.includes(t.listPrice.currency))) tp('bad listPrice')
    if (isNum(t.priceTHB) && t.priceTHB < 10_000) tp('priceTHB implausibly low')
  }
  for (const k of ['sensors', 'useCases', 'highlights', 'pros', 'cons', 'idealFor', 'considerations']) {
    if (!Array.isArray(m[k]) || m[k].length === 0) p(`no ${k}`)
  }
  if (typeof m.charging?.swappable !== 'boolean' || !isNumOrNull(m.charging?.timeH)) p('charging incomplete')
  if (!m.software || !('sdk' in m.software) || !('ai' in m.software)) p('software incomplete')
  if (!m.warranty?.robot) p('warranty incomplete')
  if (!Array.isArray(m.safety?.features) || !Array.isArray(m.safety?.certifications)) p('safety incomplete')
  if (!m.image?.url?.startsWith('https://upload.wikimedia.org/')) p('image.url is not a Wikimedia upload URL')
  if (m.image?.seek != null && !isNum(m.image.seek)) p('image.seek is not a number of seconds')
  if (m.image?.zoom != null && !(isNum(m.image.zoom) && m.image.zoom >= 1 && m.image.zoom <= 3)) p('image.zoom must be between 1 and 3')
  if (!m.image?.page?.startsWith('https://commons.wikimedia.org/')) p('image.page is not a Commons page')
  if (!m.image?.author || !m.image?.license) p('image credit incomplete')
  if (/\b(NC|ND)\b/.test(m.image?.license ?? '')) p(`image licence "${m.image.license}" is not free`)
  if (!Array.isArray(m.sources) || m.sources.length < 3) p('fewer than 3 sources')
  validateGallery(m, p)
}

const GALLERY_KINDS = ['image', 'video']
/** Only these licences may be shown: CC0, public domain, CC BY and CC BY-SA (any version). */
const FREE_LICENCE = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/

/**
 * `gallery`: 0–4 extra photos (or video clips with a poster) of the same model, each freely licensed and
 * credited, with its files already in public/. A gallery photo may not repeat the main photo; a video item may
 * be the clip the main still was taken from, and a still from such a clip must be a different frame.
 */
function validateGallery(m, p) {
  if (!Array.isArray(m.gallery)) return p('gallery is not an array (use [] when Commons has nothing more)')
  if (m.gallery.length > 4) p('gallery has more than 4 items')
  const seen = new Set()
  m.gallery.forEach((g, i) => {
    const gp = (msg) => p(`gallery[${i}]: ${msg}`)
    if (!GALLERY_KINDS.includes(g.kind)) gp(`bad kind "${g.kind}"`)
    for (const k of ['src', 'srcSmall']) {
      if (typeof g[k] !== 'string' || !g[k].startsWith('images/gallery/') || !g[k].endsWith('.jpg')) gp(`${k} is not images/gallery/….jpg`)
      else if (!existsSync(join(publicDir, g[k]))) gp(`${k} ${g[k]} is missing (run tools/fetch_gallery.py)`)
      else if (seen.has(g[k])) gp(`${k} ${g[k]} is used twice`)
      seen.add(g[k])
    }
    if (!g.original?.startsWith('https://upload.wikimedia.org/')) gp('original is not a Wikimedia upload URL')
    if (!g.page?.startsWith('https://commons.wikimedia.org/wiki/File:')) gp('page is not a Commons file page')
    if (!g.author?.trim()) gp('author missing')
    if (!FREE_LICENCE.test(g.license ?? '')) gp(`licence "${g.license}" is not CC0, public domain, CC BY or CC BY-SA`)
    if (!g.alt?.trim()) gp('alt missing')
    if (g.seek != null && !(isNum(g.seek) && g.seek >= 0)) gp('seek is not a number of seconds')
    if (g.crop != null && !(Array.isArray(g.crop) && g.crop.length === 4 && g.crop.every((v) => isNum(v) && v >= 0 && v <= 1))) gp('crop is not [l, t, r, b] fractions')
    if (g.zoom != null && !(isNum(g.zoom) && g.zoom >= 1 && g.zoom <= 3)) gp('zoom must be between 1 and 3')
    if (g.focus != null && typeof g.focus !== 'string') gp('focus is not a CSS object-position')
    if (g.kind === 'image') {
      if (g.video != null) gp('an image item has a video')
      if (g.page === m.image?.page && (g.seek ?? null) === (m.image?.seek ?? null)) gp('repeats the main photo')
    }
    if (g.kind === 'video') {
      const v = g.video
      if (!v?.url?.startsWith('https://upload.wikimedia.org/') || !VIDEO.test(v.url)) gp('video.url is not a Wikimedia .webm/.ogv upload')
      else if (v.url !== g.original) gp('video.url differs from original')
      if (!(isNum(v?.duration) && v.duration > 0)) gp('video.duration missing')
      if (v?.start != null && !(isNum(v.start) && v.start >= 0 && v.start < v.duration)) gp('video.start is outside the clip')
      if (g.seek == null) gp('a video item needs `seek` for its poster frame')
    }
  })
}

/** The gallery as pages use it: local files and credits; provenance fields (original, seek, crop) stay in the notes. */
const galleryOut = (gallery) =>
  gallery.map((g) => ({
    kind: g.kind,
    src: g.src,
    srcSmall: g.srcSmall,
    page: g.page,
    author: g.author,
    license: g.license,
    alt: g.alt,
    ...(g.focus != null && { focus: g.focus }),
    ...(g.zoom != null && { zoom: g.zoom }),
    ...(g.kind === 'video' && { video: { url: g.video.url, duration: g.video.duration, start: g.video.start ?? 0 } }),
  }))

// English (i18n/en): every user-facing text of a model or of the market file, mirrored item for item.
// 's' = translated text (null exactly where the Thai is null), 'key' = copied unchanged so items line up.
const THAI_SCRIPT = /[\u0E00-\u0E7F]/
const MODEL_EN = {
  segment: 's', originCountry: 's', tagline: 's', summary: 's', background: 's', availabilityNote: 's', distributor: 's',
  trims: [{ name: 'key', hand: 's', compute: 's' }],
  sensors: ['s'],
  charging: { note: 's' },
  software: { sdk: 's', ai: 's' },
  warranty: { robot: 's', battery: 's', note: 's' },
  safety: { features: ['s'], certifications: ['s'] },
  useCases: ['s'], highlights: ['s'], pros: ['s'], cons: ['s'], idealFor: ['s'], considerations: ['s'],
  funFact: 's', priceNote: 's',
  gallery: [{ alt: 's' }],
}
const MARKET_EN = {
  fx: { note: 's' },
  marketContext: 's',
  shipments: [{ brand: 'key', period: 's', note: 's' }],
  priceFactors: ['s'],
  buyerChecklist: [{ title: 's', detail: 's' }],
  setup: { steps: [{ title: 's', detail: 's' }], costs: [{ item: 's' }] },
  electricity: [{ label: 's', unit: 's', note: 's' }],
  ownershipCost: { yearly: [{ item: 's' }], oneTime: [{ item: 's' }] },
  sellers: [{ name: 's', detail: 's' }],
  notForSale: [{ name: 's', status: 's' }],
  incentives: ['s'],
  legalNotes: ['s'],
}

/** Checks `en` against the Thai `th` along `spec` and returns the English trimmed to the spec's keys. */
function mirror(spec, th, en, path, p) {
  if (spec === 's') {
    if (th == null) {
      if (en != null) p(`${path}: should be null like the Thai`)
      return null
    }
    if (typeof en !== 'string' || !en.trim()) p(`${path}: English missing`)
    else if (THAI_SCRIPT.test(en)) p(`${path}: English contains Thai script`)
    return en ?? null
  }
  if (spec === 'key') {
    if (en !== th) p(`${path}: must be "${th}" as in the Thai`)
    return th
  }
  if (Array.isArray(spec)) {
    const thArr = th ?? []
    if (!Array.isArray(en)) {
      p(`${path}: English array missing`)
      return []
    }
    if (en.length !== thArr.length) p(`${path}: ${en.length} English items for ${thArr.length} Thai items`)
    return thArr.map((t, i) => mirror(spec[0], t, en[i], `${path}[${i}]`, p))
  }
  if (en == null || typeof en !== 'object') {
    p(`${path}: English object missing`)
    return {}
  }
  return Object.fromEntries(Object.entries(spec).map(([k, s]) => [k, mirror(s, th?.[k], en[k], path ? `${path}.${k}` : k, p)]))
}

function readEnglish(name, problems) {
  const file = join(enDir, `${name}.json`)
  if (!existsSync(file)) {
    problems.push(`i18n/en/${name}.json is missing`)
    return null
  }
  return readJson(file)
}

/**
 * Baht for every trim: a Thai dealer's own price as published, otherwise the maker's list price at the
 * market file's rate, rounded to the hundred baht. `priceBasis` records which, so pages can say "ประมาณ".
 */
function priceTrim(t, fx) {
  const listPrice = t.listPrice ?? null
  if (isNum(t.priceTHB)) return { ...t, listPrice, priceBasis: 'dealer' }
  const rate = listPrice && { THB: 1, USD: fx?.usd, CNY: fx?.cny, EUR: fx?.eur }[listPrice.currency]
  if (!isNum(rate)) return { ...t, listPrice, priceTHB: null, priceBasis: null }
  return { ...t, listPrice, priceTHB: Math.round((listPrice.amount * rate) / 100) * 100, priceBasis: listPrice.currency === 'THB' ? 'dealer' : 'converted' }
}

/** [min, max] of a trim field across trims, ignoring unpublished values. */
function span(trims, key) {
  const vals = trims.map((t) => t[key]).filter(isNum)
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : null
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * The maker's place in the shipment ranking ("Unitree", "AgiBot"), matched on the brand name with any
 * suffix allowed ("Booster" for "Booster Robotics"). Equal shipments share a rank.
 */
function rankOf(model, shipments) {
  const brand = norm(model.brand)
  const hit = shipments.find((r) => {
    const label = norm(r.brand)
    return label === brand || label.startsWith(brand) || brand.startsWith(label)
  })
  return hit ? shipments.filter((r) => r.units > hit.units).length + 1 : null
}

async function main() {
  console.log(`Reading ${dataDir}`)
  const market = readJson(join(dataDir, 'market.json'))
  const shipments = [...(market.shipments ?? [])].sort((a, b) => b.units - a.units)
  const problems = []
  const models = []
  const enRecords = {}

  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'market.json' && !f.startsWith('_'))
  for (const file of files) {
    const id = file.replace(/\.json$/, '')
    const raw = readJson(join(dataDir, file))
    // A robot is only shown with a verified, freely licensed photo of that exact model
    if (raw.image == null) {
      console.warn(`• ${id} skipped: no verified photo`)
      continue
    }
    if (raw.id !== id) problems.push(`${file}: id "${raw.id}" does not match the file name`)
    raw.id = id
    validate(raw, market, problems)
    console.log(`• ${id}`)
    const local = await fetchImage(id, raw.image)
    const { image, gallery, ...rest } = raw
    // Cheapest trim first; unpublished prices last
    const trims = rest.trims
      .map((t) => priceTrim(t, market.fx))
      .sort((a, b) => (a.priceTHB ?? Infinity) - (b.priceTHB ?? Infinity))
    const en = readEnglish(id, problems)
    if (en) {
      const record = mirror(MODEL_EN, raw, en, `i18n/en/${id}`, (msg) => problems.push(msg))
      // English trims in the same (price) order as the Thai ones
      record.trims = trims.map((t) => record.trims.find((e) => e.name === t.name) ?? { name: t.name, hand: null, compute: null })
      enRecords[id] = record
    }
    models.push({
      ...rest,
      funFact: rest.funFact ?? null,
      priceNote: rest.priceNote ?? null,
      trims,
      id,
      image: { ...local, page: image.page, author: image.author, license: image.license, focus: image.focus ?? FOCUS[id], zoom: image.zoom },
      gallery: galleryOut(Array.isArray(gallery) ? gallery : []),
      span: Object.fromEntries(Object.entries(SPAN_KEYS).map(([k, field]) => [k, span(trims, field)])),
      makerRank: rankOf(rest, shipments),
    })
  }

  // Catalogue order ("ยอดนิยม"): the most-shipped makers first, then each maker's range by starting price
  models.sort(
    (a, b) =>
      (a.makerRank ?? Infinity) - (b.makerRank ?? Infinity) ||
      (a.span.price?.[0] ?? Infinity) - (b.span.price?.[0] ?? Infinity),
  )

  // English market text, with the shipment rows in the same (largest first) order as market.json
  const marketEnRaw = readEnglish('market', problems)
  const marketEn = marketEnRaw && mirror(MARKET_EN, market, marketEnRaw, 'i18n/en/market', (msg) => problems.push(msg))
  if (marketEn) marketEn.shipments = shipments.map((s) => marketEn.shipments.find((e) => e.brand === s.brand))

  if (problems.length) {
    console.error('\nData problems:\n  ' + problems.join('\n  '))
    process.exitCode = 1
  }

  mkdirSync(join(root, 'src', 'data'), { recursive: true })
  writeFileSync(join(root, 'src', 'data', 'models.json'), JSON.stringify(models, null, 2) + '\n')
  writeFileSync(join(root, 'src', 'data', 'market.json'), JSON.stringify({ ...market, shipments }, null, 2) + '\n')
  // Keyed by model id, in the catalogue order of models.json
  const records = Object.fromEntries(models.filter((m) => enRecords[m.id]).map((m) => [m.id, enRecords[m.id]]))
  writeFileSync(join(root, 'src', 'data', 'en.json'), JSON.stringify({ records, market: marketEn }, null, 2) + '\n')
  const galleryCount = models.reduce((n, m) => n + m.gallery.length, 0)
  console.log(`\nWrote ${models.length} models (${galleryCount} gallery items), market data and English for ${Object.keys(records).length} models.`)
}

main()
