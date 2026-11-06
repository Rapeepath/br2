import { useRef } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useLang } from '../../i18n'
import { useReveal } from '../../lib/motion'
import { faqGroups } from './faqContent'
import { PageStage } from './PageStage'
import './faq.css'

const COPY = {
  th: {
    title: 'คำถามที่พบบ่อย',
    sub: 'ก่อนซื้อหุ่นยนต์ฮิวแมนนอยด์',
    lede: 'ราคา การชำระเงิน การนำเข้า การรับประกัน และการนัดชมเครื่องจริง หากไม่พบคำตอบ ถามทีมงานได้โดยตรง',
    groups: 'หมวดคำถาม',
    more: 'ยังมีคำถาม',
    moreBody: 'ทีมขายและวิศวกรตอบได้ทางโทรศัพท์ LINE หรือฟอร์มติดต่อ',
    contact: 'ติดต่อทีมงาน',
  },
  en: {
    title: 'Frequently asked questions',
    sub: 'Before you buy a humanoid robot',
    lede: 'Prices, payment, import, warranty and seeing a robot for real. Can’t find your answer? Ask us directly.',
    groups: 'Topics',
    more: 'Still have a question?',
    moreBody: 'Our sales team and engineers answer by phone, LINE or the contact form.',
    contact: 'Contact us',
  },
}

/** Questions as native <details>: they open and close with the keyboard and screen readers, no script needed. */
export function FaqPage() {
  const lang = useLang()
  const c = COPY[lang]
  const groups = faqGroups(lang)
  const root = useRef<HTMLDivElement>(null)
  useReveal(root)

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede} />
      <div className="container c-page faq" ref={root}>
        <nav className="faq__toc" aria-label={c.groups}>
          <ul>
            {groups.map((g) => (
              <li key={g.id}>
                <a href={`#faq-${g.id}`}>{g.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="faq__groups">
          {groups.map((g) => (
            <section key={g.id} id={`faq-${g.id}`} className="faq__group" aria-labelledby={`faq-${g.id}-title`} data-reveal>
              <h2 id={`faq-${g.id}-title`}>{g.title}</h2>
              <div className="faq__list">
                {g.items.map((item) => (
                  <details key={item.id} className="faq__item">
                    <summary>
                      <span>{item.q}</span>
                      <Plus size={20} aria-hidden className="faq__icon" />
                    </summary>
                    <div className="faq__answer">
                      <p>{item.a}</p>
                      {item.link && (
                        <Link to={item.link.to} className="link-arrow">
                          {item.link.label}
                          <ArrowRight size={16} aria-hidden />
                        </Link>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <section className="c-sheet c-sheet--dark faq__more" aria-labelledby="faq-more">
            <h2 id="faq-more">{c.more}</h2>
            <p>{c.moreBody}</p>
            <Link to="/contact" className="btn btn-primary">
              {c.contact}
            </Link>
          </section>
        </div>
      </div>
    </>
  )
}
