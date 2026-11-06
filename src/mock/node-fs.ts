// node:fs for the in-browser POS (engine.ts), wired in by vite.config.ts for server/*.ts in the client build only.
// The store's JSON file lives in localStorage (temp files and, in private mode, everything in memory), and the
// catalogue's data file comes from the bundle. Only what server/store.ts and server/catalog.ts call.
import catalogData from '../data/models.json?raw'

const bundled: Record<string, string> = { '/src/data/models.json': catalogData }
const PREFIX = 'pos.mock:'
const memory = new Map<string, string>()

function load(path: string): string | null {
  if (path in bundled) return bundled[path]
  const held = memory.get(path)
  if (held !== undefined) return held
  try {
    return localStorage.getItem(PREFIX + path)
  } catch {
    return null
  }
}

function save(path: string, text: string) {
  memory.set(path, text)
  if (path.endsWith('.tmp')) return
  try {
    localStorage.setItem(PREFIX + path, text)
  } catch {
    // Private mode or storage full: the data lasts until the tab closes
  }
}

function drop(path: string) {
  memory.delete(path)
  try {
    localStorage.removeItem(PREFIX + path)
  } catch {
    // nothing stored
  }
}

export function readFileSync(path: string, _encoding?: string): string {
  const text = load(path)
  if (text === null) throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: 'ENOENT' })
  return text
}

export const existsSync = (path: string): boolean => load(path) !== null

export const writeFileSync = (path: string, text: string): void => save(path, String(text))

export function renameSync(from: string, to: string): void {
  save(to, readFileSync(from))
  drop(from)
}

export const rmSync = (path: string, _opts?: unknown): void => drop(path)

export const mkdirSync = (_path: string, _opts?: unknown): undefined => undefined
