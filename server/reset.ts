// npm run pos:reset — throws away the simulated database and seeds 60 fresh days ending now.
import { resolve } from 'node:path'
import { loadCatalog } from './catalog.ts'
import { openStore } from './store.ts'

const root = resolve(import.meta.dirname, '..')
const store = openStore(root, loadCatalog(root))
const db = store.reset()
console.log(`สร้างข้อมูลจำลองใหม่แล้ว: ${db.orders.length} บิล ${db.customers.length} ลูกค้า ${db.products.length} สินค้า → ${store.file}`)
