// @vitest-environment node
// The JSON store's hooks for a remote copy (server/vercel.ts). Shared by both shops (identical file).
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadCatalog } from './catalog.ts'
import { openStore } from './store.ts'

const root = resolve(import.meta.dirname, '..')
const catalog = loadCatalog(root)
const tempFile = () => join(mkdtempSync(join(tmpdir(), 'pos-store-')), 'db.json')

describe('store', () => {
  it('hands every save to onSave, starting with the fresh demo data', () => {
    const saved: string[] = []
    const store = openStore(root, catalog, tempFile(), { onSave: (text) => saved.push(text) })
    expect(saved).toHaveLength(1)
    store.write((db) => {
      db.settings.storeName = 'ร้านทดสอบ'
    })
    expect(saved).toHaveLength(2)
    expect(JSON.parse(saved[1]).settings.storeName).toBe('ร้านทดสอบ')
    expect(readFileSync(store.file, 'utf8')).toBe(saved[1])
  })

  it('adopts a copy saved elsewhere without reporting it as a change', () => {
    const a = openStore(root, catalog, tempFile())
    a.write((db) => {
      db.settings.storeName = 'สาขาเอ'
    })
    const saved: string[] = []
    const b = openStore(root, catalog, tempFile(), { onSave: (text) => saved.push(text) })
    expect(b.adopt(JSON.stringify(a.get()))).toBe(true)
    expect(b.get().settings.storeName).toBe('สาขาเอ')
    expect(JSON.parse(readFileSync(b.file, 'utf8')).settings.storeName).toBe('สาขาเอ')
    expect(saved).toHaveLength(1)
  })

  it('refuses unreadable text and other data versions', () => {
    const store = openStore(root, catalog, tempFile())
    const before = store.get()
    expect(store.adopt('{not json')).toBe(false)
    expect(store.adopt(JSON.stringify({ ...before, version: -1 }))).toBe(false)
    expect(store.get()).toBe(before)
  })
})
