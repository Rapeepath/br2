import { CtaRow, FinanceWidget, StockBadge } from '../components/commerce/CommerceBits'
import { useLang } from '../i18n'
import { pick } from '../lib/bilingual'
import { useLiveCatalog } from '../lib/live'
import type { Model, Trim } from '../lib/types'
import './ModelPage.extras.css'

/**
 * The model page's next steps, the way a car maker's model page closes its hero: live showroom stock, the
 * three actions (configure and quote, book a demonstration, ask), and a monthly financing estimate from the
 * starting price. Stock shows only with live data from the showroom's POS.
 */
export function ModelExtras({ model: m }: { model: Model }) {
  const lang = useLang()
  const price = m.span.price?.[0] ?? null
  return (
    <section className="mx" aria-labelledby="mx-title">
      <div className="mx__main">
        <h2 id="mx-title" className="mx__title">
          {pick(lang, `สนใจ ${m.nameEn}`, `Interested in the ${m.nameEn}?`)}
        </h2>
        <StockBadge refId={m.id} className="mx__stock" />
        <CtaRow modelId={m.id} className="mx__cta" />
      </div>
      {price != null && (
        <div className="mx__finance">
          <FinanceWidget price={price} modelId={m.id} />
        </div>
      )}
    </section>
  )
}

/** One trim's live stock (the trim's own POS product), under its name in the trims table and cards. */
export function TrimStock({ model, trim }: { model: Model; trim: Trim }) {
  const live = useLiveCatalog()
  if (live.status !== 'live') return null
  const product = live.byRef(model.id).find((p) => p.variant === trim.name)
  return product ? <StockBadge productId={product.id} className="mx__trim-stock" /> : null
}
