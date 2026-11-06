// npm run images — responsive copies of every catalogue photo for <Picture> (src/components/Picture.tsx).
// For each JPG/PNG under public/images (gallery/** included; r/ is the output), writes AVIF and WebP at
// 480, 960 and 1600 px wide (never wider than the original) to public/images/r/<key>-<w>.<fmt>, and lists
// them in src/generated/images.json. Files already newer than their source are skipped, so re-runs are fast.
// "x-sm.jpg" is a small copy of "x.jpg": it shares x's sources and is only processed when x doesn't exist.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'public', 'images')
const outDir = join(srcDir, 'r')
const manifestFile = join(root, 'src', 'generated', 'images.json')
const WIDTHS = [480, 960, 1600]
const FORMATS = {
  avif: (img) => img.avif({ quality: 52, effort: 4 }),
  webp: (img) => img.webp({ quality: 74 }),
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (p === outDir) continue
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(jpe?g|png)$/i.test(name)) out.push(p)
  }
  return out
}

const sources = walk(srcDir)
const keyOf = (file) => relative(srcDir, file).split(sep).join('/').replace(/\.(jpe?g|png)$/i, '')
const all = new Set(sources.map(keyOf))
const manifest = {}
let written = 0

for (const file of sources) {
  let key = keyOf(file)
  // A small copy is covered by its full-size photo
  if (key.endsWith('-sm') && all.has(key.slice(0, -3))) continue
  if (key.endsWith('-sm')) key = key.slice(0, -3)
  const meta = await sharp(file).metadata()
  // EXIF-rotated photos report swapped dimensions
  const rotated = (meta.orientation ?? 1) >= 5
  const w = rotated ? meta.height : meta.width
  const h = rotated ? meta.width : meta.height
  const widths = [...new Set([...WIDTHS.filter((x) => x < w), Math.min(w, WIDTHS.at(-1))])].sort((a, b) => a - b)
  const srcTime = statSync(file).mtimeMs
  for (const width of widths) {
    for (const [fmt, encode] of Object.entries(FORMATS)) {
      const target = join(outDir, `${key}-${width}.${fmt}`)
      if (existsSync(target) && statSync(target).mtimeMs >= srcTime) continue
      mkdirSync(dirname(target), { recursive: true })
      await encode(sharp(file).rotate().resize({ width, withoutEnlargement: true })).toFile(target)
      written++
    }
  }
  manifest[key] = { w, h, widths }
}

const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]))
const json = `${JSON.stringify(sorted, null, 2)}\n`
mkdirSync(dirname(manifestFile), { recursive: true })
if (!existsSync(manifestFile) || readFileSync(manifestFile, 'utf8') !== json) writeFileSync(manifestFile, json)
console.log(`images: ${Object.keys(sorted).length} photos, ${written} files written → public/images/r/`)
