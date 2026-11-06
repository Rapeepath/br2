import { useRef } from 'react'
import { Link } from 'react-router'
import { Phone } from 'lucide-react'
import { StockBadge } from '../../components/commerce/CommerceBits'
import { models } from '../../data'
import { useLang } from '../../i18n'
import { localized } from '../../i18n/content'
import { itemName, staticItem } from '../../lib/catalogNames'
import { useLiveCatalog, useStoreInfo } from '../../lib/live'
import { baht, telHref } from '../../lib/localeFormat'
import { useReveal } from '../../lib/motion'
import { PageStage, SimNote } from './PageStage'
import './service.css'

const SERVICE_IDS = ['svc-install', 'svc-sdk', 'svc-care', 'svc-checkup', 'svc-import']
const PART_IDS = ['acc-battery', 'acc-battery-xl', 'acc-gantry', 'acc-mat', 'acc-wifi', 'acc-case', 'acc-remote']

const COPY = {
  th: {
    title: 'บริการหลังการขาย',
    sub: 'ดูแลตั้งแต่ติดตั้งจนพ้นประกัน',
    lede: 'ติดตั้งและอบรมทีมของคุณ ดูแลเคลมกับผู้ผลิต มีอะไหล่และแบตเตอรี่สำรอง และแผนบำรุงรักษารายปีหลังพ้นประกัน',
    call: 'แจ้งปัญหา {phone}',
    stepsTitle: 'เมื่อเครื่องมีปัญหา',
    stepsLede: 'แจ้งได้ทางโทรศัพท์ LINE หรือฟอร์มติดต่อ ทีมวิศวกรรับเรื่องและติดตามจนเครื่องกลับไปทำงาน',
    steps: [
      ['แจ้งอาการ', 'บอกรุ่น เลขเครื่อง และอาการ แนบภาพหรือวิดีโอได้ทาง LINE'],
      ['วินิจฉัยทางไกล', 'วิศวกรตรวจบันทึกการทำงานและแนะนำวิธีแก้เบื้องต้น ปัญหาซอฟต์แวร์ส่วนใหญ่จบที่ขั้นนี้'],
      ['ตรวจที่หน้างานหรือรับเครื่อง', 'นัดเข้าตรวจถึงที่ หรือรับเครื่องกลับมาที่ศูนย์บริการพร้อมกล่องขนย้าย'],
      ['ซ่อมหรือเคลมกับผู้ผลิต', 'ซ่อมด้วยอะไหล่ในสต็อก หรือส่งเคลมตามเงื่อนไขรับประกันของผู้ผลิต'],
      ['ส่งคืนพร้อมรายงาน', 'ทดสอบการทำงานก่อนส่งคืน และส่งรายงานสิ่งที่ซ่อมให้ทีมของคุณ'],
    ],
    warrantyTitle: 'การรับประกันของแต่ละรุ่น',
    warrantyLede: 'เป็นไปตามเงื่อนไขของผู้ผลิต โชว์รูมเป็นผู้ประสานงานเคลมให้',
    cols: ['รุ่น', 'ตัวเครื่อง', 'แบตเตอรี่', 'เงื่อนไข'],
    notStated: 'ไม่ระบุ',
    plansTitle: 'แผนบริการ',
    plansLede: 'ราคาจากระบบของโชว์รูม รวม VAT แล้ว',
    ask: 'สอบถามราคา',
    partsTitle: 'อะไหล่และอุปกรณ์เสริม',
    partCols: ['รายการ', 'รายละเอียด', 'ราคา', 'สต็อก'],
    slaTitle: 'ระดับบริการ',
    slaNote: 'ระดับบริการด้านล่างเป็นนโยบายจำลองของโชว์รูมนี้ เพื่อแสดงตัวอย่างเท่านั้น',
    sla: [
      ['รับเรื่องแจ้งปัญหา', 'ภายใน 4 ชั่วโมงทำการ'],
      ['วินิจฉัยทางไกล', 'ภายใน 1 วันทำการ'],
      ['เข้าหน้างาน กรุงเทพฯ และปริมณฑล', 'ภายใน 3 วันทำการ'],
      ['เข้าหน้างาน ต่างจังหวัด', 'ภายใน 5 วันทำการ'],
      ['เครื่องทดแทนระหว่างซ่อม', 'สำหรับลูกค้าแผนบำรุงรักษา 12 เดือน ตามเครื่องโชว์ที่มี'],
    ],
    nextTitle: 'ต้องการแผนบริการสำหรับหลายเครื่อง',
    nextBody: 'ทีมขายจัดแพ็กเกจบำรุงรักษาและอะไหล่ให้ตามจำนวนเครื่องและลักษณะงาน',
    contact: 'ติดต่อทีมขาย',
    configure: 'รวมไว้ในใบเสนอราคา',
  },
  en: {
    title: 'After-sales service',
    sub: 'From installation to beyond the warranty',
    lede: 'We install the robot and train your team, handle warranty claims with the maker, stock spare parts and batteries, and offer yearly maintenance once the warranty ends.',
    call: 'Report a problem {phone}',
    stepsTitle: 'When something goes wrong',
    stepsLede: 'Report it by phone, LINE or the contact form. An engineer takes it on and follows it through until the robot is back at work.',
    steps: [
      ['Tell us the symptoms', 'The model, serial number and what happens; send photos or video by LINE'],
      ['Remote diagnosis', 'An engineer reads the robot’s logs and suggests a first fix; most software issues end here'],
      ['On-site check or collection', 'We visit, or collect the robot to the service centre in a transport case'],
      ['Repair or warranty claim', 'Repaired with parts in stock, or claimed under the maker’s warranty terms'],
      ['Return with a report', 'Tested before it goes back, with a report of what was done for your team'],
    ],
    warrantyTitle: 'Warranty by model',
    warrantyLede: 'Each maker’s own terms apply; the showroom handles the claim for you.',
    cols: ['Model', 'Robot', 'Battery', 'Terms'],
    notStated: 'Not stated',
    plansTitle: 'Service plans',
    plansLede: 'Prices from the showroom’s system, VAT included.',
    ask: 'Ask for a price',
    partsTitle: 'Spare parts and accessories',
    partCols: ['Item', 'Details', 'Price', 'Stock'],
    slaTitle: 'Service levels',
    slaNote: 'The service levels below are this demo showroom’s simulated policy, shown as an example only.',
    sla: [
      ['Problem report acknowledged', 'Within 4 working hours'],
      ['Remote diagnosis', 'Within 1 working day'],
      ['On site, Bangkok and vicinity', 'Within 3 working days'],
      ['On site, other provinces', 'Within 5 working days'],
      ['Loan robot during repair', 'For 12-month maintenance plan customers, subject to demo stock'],
    ],
    nextTitle: 'Need a plan for several robots?',
    nextBody: 'The sales team builds maintenance and spare-parts packages around the number of robots and the job.',
    contact: 'Contact sales',
    configure: 'Add to a quotation',
  },
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '')

export function ServicePage() {
  const lang = useLang()
  const c = COPY[lang]
  const store = useStoreInfo()
  const live = useLiveCatalog()
  const root = useRef<HTMLDivElement>(null)
  useReveal(root, live.status)

  const services = SERVICE_IDS.map((id) => live.byId(id) ?? staticItem(id))
  const parts = PART_IDS.map((id) => live.byId(id) ?? staticItem(id))
  const priceOf = (id: string) => live.byId(id)?.price

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede}>
        <div className="pstage__actions">
          <a href={telHref(store.phone)} className="btn btn-primary">
            <Phone size={18} aria-hidden />
            {fill(c.call, { phone: store.phone })}
          </a>
          <Link to="/contact" className="btn btn-ghost">
            {c.contact}
          </Link>
        </div>
      </PageStage>

      <div className="container c-page service" ref={root}>
        <section className="c-section" aria-labelledby="sv-steps">
          <h2 id="sv-steps">{c.stepsTitle}</h2>
          <p className="c-section__lede">{c.stepsLede}</p>
          <ol className="c-steps service__steps">
            {c.steps.map(([title, body]) => (
              <li key={title}>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="c-section" aria-labelledby="sv-warranty">
          <h2 id="sv-warranty">{c.warrantyTitle}</h2>
          <p className="c-section__lede">{c.warrantyLede}</p>
          <div className="c-tablewrap">
            <table className="c-table c-table--stack">
              <thead>
                <tr>
                  {c.cols.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.map((base) => {
                  const m = localized(base, lang)
                  return (
                    <tr key={m.id}>
                      <th scope="row">
                        <Link to={`/models/${m.id}`} lang="en">
                          {m.nameEn}
                        </Link>
                      </th>
                      <td data-label={c.cols[1]}>{m.warranty.robot}</td>
                      <td data-label={c.cols[2]}>{m.warranty.battery ?? c.notStated}</td>
                      <td data-label={c.cols[3]} className="service__note">
                        {m.warranty.note ?? '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="c-section" aria-labelledby="sv-plans">
          <h2 id="sv-plans">{c.plansTitle}</h2>
          <p className="c-section__lede">{c.plansLede}</p>
          <ul className="c-cards">
            {services.map((s) => {
              const n = itemName(s, lang)
              const price = priceOf(s.id)
              return (
                <li key={s.id} data-reveal>
                  <div className="c-card">
                    <h3>{n.name}</h3>
                    {n.subtitle && <p>{n.subtitle}</p>}
                    <p className="c-card__price">{price != null ? baht(price, lang) : c.ask}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="c-section" aria-labelledby="sv-parts">
          <h2 id="sv-parts">{c.partsTitle}</h2>
          <div className="c-tablewrap">
            <table className="c-table c-table--stack">
              <thead>
                <tr>
                  {c.partCols.map((h, i) => (
                    <th key={h} scope="col" className={i === 2 ? 'num' : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const n = itemName(p, lang)
                  const price = priceOf(p.id)
                  return (
                    <tr key={p.id}>
                      <th scope="row">{n.name}</th>
                      <td data-label={c.partCols[1]}>{n.subtitle || '–'}</td>
                      <td data-label={c.partCols[2]} className="num">
                        {price != null ? baht(price, lang) : c.ask}
                      </td>
                      <td data-label={c.partCols[3]}>
                        <StockBadge productId={p.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="c-section c-split" aria-labelledby="sv-sla">
          <div className="c-sheet c-sheet--dark">
            <h2 id="sv-sla">{c.slaTitle}</h2>
            <dl className="c-dl">
              {c.sla.map(([dt, dd]) => (
                <div key={dt}>
                  <dt>{dt}</dt>
                  <dd>{dd}</dd>
                </div>
              ))}
            </dl>
            <SimNote>{c.slaNote}</SimNote>
          </div>
          <div className="c-sheet">
            <h2>{c.nextTitle}</h2>
            <p className="c-muted">{c.nextBody}</p>
            <div className="c-actions">
              <Link to="/contact" className="btn btn-primary">
                {c.contact}
              </Link>
              <Link to={`/configure/${models[0]?.id ?? ''}`} className="btn btn-ghost">
                {c.configure}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
