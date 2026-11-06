// The database is one JSON file, held in memory and written back after every change (atomic rename, so a
// crash mid-write never leaves half a file). Plenty for a single-till simulation, and easy to inspect.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import type { Catalog } from './catalog.ts'
import { DB_VERSION, seed } from './seed.ts'
import type { Db } from './types.ts'

export interface Store {
  readonly file: string
  get(): Db
  /** Runs a change and saves it; nothing is written if `fn` throws */
  write<T>(fn: (db: Db) => T): T
  reset(now?: Date): Db
}

export function openStore(root: string, catalog: Catalog, file = process.env.POS_DB ?? '.pos-data/db.json'): Store {
  const path = isAbsolute(file) ? file : join(root, file)
  let db: Db

  const save = () => {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    const text = JSON.stringify(db)
    writeFileSync(tmp, text)
    // Windows can hold the target open for a moment (a virus scanner, the search indexer, an editor) and the
    // rename then fails: wait briefly and try again, and if it stays locked write the file in place instead
    const locked = (err: unknown) => ['EPERM', 'EBUSY', 'EACCES'].includes((err as NodeJS.ErrnoException).code ?? '')
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        renameSync(tmp, path)
        return
      } catch (err) {
        if (!locked(err)) throw err
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * attempt)
      }
    }
    writeFileSync(path, text)
    rmSync(tmp, { force: true })
  }

  const fresh = (now = new Date()) => {
    db = seed(catalog, now)
    save()
    return db
  }

  const load = () => {
    if (process.env.POS_FRESH === '1' || !existsSync(path)) return fresh()
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Db
      if (parsed.version !== DB_VERSION) return fresh()
      db = parsed
      return db
    } catch {
      return fresh()
    }
  }

  load()

  return {
    file: path,
    get: () => db,
    write: (fn) => {
      // Work on a copy so a rule that throws halfway leaves the live data untouched
      const draft = structuredClone(db)
      const out = fn(draft)
      db = draft
      save()
      return out
    },
    reset: (now) => fresh(now),
  }
}
