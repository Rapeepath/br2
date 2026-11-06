# รูปแบบข้อมูลหุ่นยนต์ (research_notes/หุ่นยนต์ฮิวแมนนอยด์/data/<id>.json)

One JSON file per robot. `scripts/build-data.mjs` validates it, downloads the main photo, checks the gallery files,
merges the English (`i18n/en/`, see the end of this file) and computes `span` and `makerRank`. Types: `src/lib/types.ts` (`Model`, `Trim`). File name = `id` (kebab-case, e.g. `unitree-g1.json`).

Rules
- All user-facing prose in formal, plain, neutral Thai (brochure register; no hype, no emoji, no exclamation marks).
  Keep brand/model/product names, chip names and standard units in English (`Jetson Orin`, `LiDAR`, `ROS 2`, `kg` → write `กก.` in prose).
  Use Buddhist-era years in prose ("ปี 2568", "ตุลาคม 2569"). Thai numbers with commas (12,000).
- Every number must come from a source in `sources`. Unpublished → `null` (never estimate). Spec sheets first
  (maker's official site / datasheet / shop page), then reputable media.
- Prices: `listPrice` = the maker's official price in its own currency (USD/CNY/EUR), from the maker's shop/site
  (or an authorised reseller's list price, say which in `priceNote`). `priceTHB` = ONLY a Thai seller's own published
  baht price incl. VAT (then usually `availability: "thai-dealer"`); otherwise leave `priceTHB: null` and the build
  converts `listPrice` at the rate in `data/market.json` (rounded to 100 baht) and marks it approximate.
  Wholesale/quote-only/estimate baht figures are NOT dealer prices — mention them in prose instead.
- Trims = the versions the maker sells with different prices/specs (e.g. G1 / G1 EDU). Max ~4. Order doesn't matter.
- `dof` = total joint DOF as the maker quotes (incl. hands if fitted). `handDof` = DOF per hand (null if no dexterous hand).
- `speedMs` in m/s (convert km/h ÷ 3.6, 2 decimals). `runtimeH` in hours (e.g. "about 2 h" → 2; "1–2 h" → 2 and mention range in
  a note/prose). `batteryWh` = capacity in Wh (convert: V × Ah). `payloadKg` = the maker's arm payload figure
  (say in `highlights`/`considerations` if it is per arm). `jointTorqueNm` = max joint peak torque.
- `heightCm` standing height (wheeled: typical/maximum working height). `weightKg` = [min,max] across versions (with battery).
- `image`: a freely licensed photo of THIS robot on Wikimedia Commons (CC0, PD, CC BY, CC BY-SA — never NC/ND).
  `url` = the original `https://upload.wikimedia.org/wikipedia/commons/x/xx/File.jpg`, `page` = the `https://commons.wikimedia.org/wiki/File:...` page,
  `author` (plain name, no HTML), `license` exactly like "CC BY-SA 4.0", "CC BY 4.0", "CC0", "Public domain".
  Prefer a clear, well-lit photo showing the whole robot or at least head + torso. You MUST look at the image
  (download a thumbnail and view it) and be sure it shows THIS model (not an older generation or a look-alike).
  A still from a freely licensed Commons VIDEO (.webm, e.g. China News Service CC BY 3.0) is allowed when clean
  (no big caption overlay, robot sharp and large): set `"url"` to the .webm upload URL and `"seek": <seconds>` to
  pick the frame; the build fetches `…/thumb/x/xx/<file>.webm/1280px-seek%3D<s>-<file>.webm.jpg` (test that URL).
  Optional `"focus": "50% 20%"` (CSS object-position) keeps the head/torso in frame on landscape crops.
- `sources`: 4–10 entries, `title` formatted "Title – Publisher" (en dash with spaces), e.g.
  "G1 Humanoid Agent – Unitree Robotics". Include the official product page, a price source, a Thai source if any.
- `gallery`: 0–4 MORE freely licensed Commons photos or video clips of THIS model (same rules as `image`: look at
  every file, right generation/variant, CC0 / PD / CC BY / CC BY-SA only). `[]` when Commons has nothing more —
  never use a look-alike. Varied angles and contexts; not the main photo again (a still from the same video as the
  main image is fine when it is a different frame). Each item:
  ```jsonc
  {
    "kind": "image",                                    // image | video
    "src": "images/gallery/<id>-<n>.jpg",               // long side 1600 px (n = 1, 2, …)
    "srcSmall": "images/gallery/<id>-<n>-sm.jpg",       // 640 px wide
    "original": "https://upload.wikimedia.org/wikipedia/commons/x/xx/File.jpg",  // the Commons original (.webm for a video)
    "seek": 61,                                         // video only: the frame (s) used as the still / poster
    "crop": [0, 0, 1, 0.94],                            // optional [left, top, right, bottom] fractions, e.g. to trim a date stamp off a CC0 photo
    "page": "https://commons.wikimedia.org/wiki/File:…",
    "author": "plain name", "license": "CC BY-SA 4.0",
    "alt": "Thai alt text: what the photo shows (model, action, place, event)",
    "focus": "50% 30%", "zoom": 1.4,                    // optional, as for `image`
    "video": { "url": "<same as original>", "duration": 154.4, "start": 88 }  // kind "video" only; start = where the model appears
  }
  ```
  Files are made by `python research_notes/หุ่นยนต์ฮิวแมนนอยด์/tools/fetch_gallery.py` (one file at a time from the
  Commons 1920 px thumbnail, Pillow, JPEG quality 82, metadata stripped; `--force` re-downloads). Videos are not
  downloaded: the site plays `video.url` from upload.wikimedia.org on click (never autoplay). The build validates
  every item and passes `kind, src, srcSmall, page, author, license, alt, focus, zoom, video` to `models.json`.
  The search log (what exists per model, and what was rejected) is in `gallery.md`.

# English (research_notes/หุ่นยนต์ฮิวแมนนอยด์/i18n/en/<id>.json and market.json)

A faithful translation for the /en pages — no new facts, same figures, units and currencies (`US$13,500`,
`CNY 95,000`, `€7,990`, `454,000 baht`), Buddhist-era years converted to Gregorian, plain neutral British English,
consistent terms (DoF, payload, runtime, dexterous hand, safety gantry, Thai dealer, import duty, quotation).
No Thai script. Every array has the same number of items in the same order as the Thai; a field is `null` exactly
where the Thai is `null`.

- Model file keys: `segment, originCountry, tagline (≤ 60 chars), summary, background, availabilityNote, distributor,
  trims[] { name (exactly the Thai trim name), hand, compute }, sensors[], charging { note }, software { sdk, ai },
  warranty { robot, battery, note }, safety { features[], certifications[] }, useCases[], highlights[], pros[], cons[],
  idealFor[], considerations[], funFact, priceNote, gallery[] { alt }` (no nameTh, numbers, enums, image or sources).
- `market.json` keys: `fx { note }, marketContext, shipments[] { brand (exactly as Thai), period, note }, priceFactors[],
  buyerChecklist[] { title, detail }, setup { steps[] { title, detail }, costs[] { item } }, electricity[] { label,
  unit, note }, ownershipCost { yearly[] { item }, oneTime[] { item } }, sellers[] { name, detail },
  notForSale[] { name, status }, incentives[], legalNotes[]`.

`npm run data` checks the mirror and writes `src/data/en.json` = `{ records: { [modelId]: {…model keys} }, market: {…} }`
with trims in the same (price) order as `models.json` and shipments largest first, like `market.json`.

```jsonc
{
  "id": "unitree-g1",
  "brand": "Unitree",                       // as the maker brands itself
  "nameEn": "Unitree G1",                   // brand + model, how buyers search for it
  "nameTh": "ยูนิทรี จี1",                   // Thai transliteration
  "category": "research",                   // research | education | home | industrial | service  (primary use)
  "locomotion": "legs",                     // legs | wheels
  "segment": "หุ่นยนต์ฮิวแมนนอยด์ขนาดกลางสำหรับวิจัยและพัฒนา",  // short Thai class label
  "originCountry": "จีน",
  "originGroup": "china",                   // china | usa | europe | korea | japan
  "availability": "thai-dealer",            // thai-dealer | import | preorder
  "availabilityNote": "1–2 Thai sentences: how a Thai buyer gets it, lead time, who imports/services it",
  "distributor": "Thai distributor company name, or e.g. \"สั่งซื้อจาก Unitree Robotics โดยตรง\"",
  "launched": "2024-05",                    // Gregorian YYYY-MM the maker started selling/taking orders
  "tagline": "≤ 45 Thai chars, factual one-liner",
  "summary": "2–3 Thai sentences: what it is, who it's for, key figures",
  "background": "4–6 Thai sentences: launch history, versions, notable buyers/uses, shipments, price moves",
  "heightCm": 132,
  "weightKg": [35, 35],
  "trims": [
    {
      "name": "G1 Basic",
      "priceTHB": null,                     // null unless a Thai seller publishes a baht price
      "listPrice": { "amount": 16000, "currency": "USD" },   // or null
      "dof": 23, "handDof": null, "hand": "ไม่มีมือหยิบจับ",
      "payloadKg": 2, "speedMs": 2, "runtimeH": 2, "batteryWh": 864,
      "compute": "8-core CPU", "jointTorqueNm": 90
    }
  ],
  "sensors": ["กล้องวัดความลึก Intel RealSense D435", "LiDAR 3 มิติ Livox MID-360", "ไมโครโฟน 4 ตัว"],
  "charging": { "timeH": 1, "swappable": true, "note": "Thai note or null" },
  "software": { "sdk": "Thai/English short: e.g. \"SDK ภาษา C++ และ Python, รองรับ ROS 2\" or null",
                "ai": "AI/learning stack: e.g. \"รองรับการฝึกด้วย Isaac Lab และ MuJoCo\" or null" },
  "warranty": { "robot": "e.g. \"1 ปี\" or \"ไม่เปิดเผย\"", "battery": "or null", "note": "Thai or null" },
  "safety": { "features": ["ปุ่มหยุดฉุกเฉิน", "..."], "certifications": ["CE", "..."] },  // [] if none published
  "useCases": ["3–6 Thai items: jobs it is sold for / shown doing"],
  "highlights": ["4–6 Thai items"],
  "pros": ["3–5 Thai items"],
  "cons": ["3–5 Thai items, factual"],
  "idealFor": ["2–4 Thai items"],
  "considerations": ["3–5 Thai items: things to check before buying"],
  "funFact": "one Thai sentence or null",
  "priceNote": "Thai: what the price includes/excludes (shipping, import duty/VAT, EDU licence, hands extra), rental/subscription options; or null",
  "image": { "url": "https://upload.wikimedia.org/...", "page": "https://commons.wikimedia.org/wiki/File:...", "author": "...", "license": "CC BY-SA 4.0" },
  "sources": [ { "title": "… – Unitree Robotics", "url": "https://..." } ]
}
```
