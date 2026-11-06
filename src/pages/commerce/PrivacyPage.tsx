import { useRef, useState, type FormEvent } from 'react'
import { Consent, Field, FormAlert, Honeypot, PersonFields, SubmitButton, emptyPerson, formCopy, useSubmit, validatePerson } from '../../components/form/FormKit'
import { useLang } from '../../i18n'
import { apiPost } from '../../lib/publicApi'
import { StoreDetails } from './ContactPage'
import { PageStage, SimNote } from './PageStage'
import './privacy.css'

type Request = 'access' | 'correct' | 'delete'

const COPY = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    sub: 'ตามพ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
    lede: 'เราเก็บเฉพาะข้อมูลที่คุณกรอกในแบบฟอร์ม ใช้เพื่อตอบเรื่องที่ขอ และคุณขอดู แก้ไข หรือลบได้ทุกเมื่อ',
    effective: 'มีผลตั้งแต่ 6 พฤศจิกายน 2569',
    controllerTitle: 'ผู้ควบคุมข้อมูลส่วนบุคคล',
    controllerBody: 'โชว์รูมเป็นผู้ควบคุมข้อมูลที่ส่งผ่านเว็บไซต์นี้ ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่',
    formsTitle: 'ข้อมูลที่เก็บและเหตุผล',
    formsLede: 'แต่ละแบบฟอร์มขอเฉพาะข้อมูลที่จำเป็นต่อเรื่องนั้น ทุกแบบฟอร์มต้องติ๊กยินยอมก่อนส่ง',
    cols: ['แบบฟอร์ม', 'ข้อมูลที่เก็บ', 'ใช้เพื่อ', 'ฐานทางกฎหมาย', 'ระยะเวลาเก็บ'],
    rows: [
      ['ติดต่อและสอบถาม', 'ชื่อ เบอร์โทร อีเมล LINE ID ข้อความ และรุ่นที่สนใจ', 'ตอบคำถามและติดต่อกลับ', 'ความยินยอม (มาตรา 19)', '1 ปีนับจากการติดต่อครั้งล่าสุด'],
      ['นัดชมการสาธิต', 'ข้อมูลติดต่อข้างต้น วันเวลาที่นัด รุ่นที่อยากดู และหมายเหตุ', 'จัดและยืนยันการนัดหมาย', 'ความยินยอม และการดำเนินการก่อนเข้าทำสัญญา (มาตรา 24(3))', '1 ปีนับจากวันนัด'],
      ['ขอใบเสนอราคา', 'ข้อมูลติดต่อ ชื่อบริษัท เลขประจำตัวผู้เสียภาษี ที่อยู่ออกใบกำกับ และรายการที่เลือก', 'ออกใบเสนอราคาและเอกสารการขาย', 'การดำเนินการตามคำขอก่อนเข้าทำสัญญา (มาตรา 24(3)) และหน้าที่ตามกฎหมาย (มาตรา 24(6))', 'ใบเสนอราคา 1 ปี เอกสารภาษีและบัญชีเมื่อเกิดการขาย 5 ปีตามกฎหมาย'],
      ['รีวิวสินค้า', 'ชื่อที่แสดง คะแนน และข้อความรีวิว', 'แสดงรีวิวต่อสาธารณะหลังผู้จัดการตรวจสอบ', 'ความยินยอม (มาตรา 19)', 'จนกว่าจะขอลบ'],
      ['คำขอใช้สิทธิ', 'ข้อมูลติดต่อและรายละเอียดคำขอ', 'ดำเนินการตามคำขอ', 'หน้าที่ตามกฎหมาย (มาตรา 24(6))', '1 ปีหลังปิดคำขอ'],
    ],
    browserTitle: 'ข้อมูลในเบราว์เซอร์ของคุณ',
    browserBody:
      'เว็บไซต์นี้ไม่ใช้คุกกี้ติดตามหรือเครื่องมือวิเคราะห์ใดๆ เราเก็บไว้ในเครื่องของคุณเท่านั้น (localStorage) 3 อย่าง คือ ธีมสว่างหรือมืด รายการรุ่นที่เลือกเปรียบเทียบ และเช็กลิสต์ในคู่มือ ลบได้จากการตั้งค่าเบราว์เซอร์',
    shareTitle: 'การเปิดเผยข้อมูล',
    shareBody:
      'เราไม่ขาย ไม่ให้เช่า และไม่ส่งต่อข้อมูลของคุณเพื่อการตลาด ข้อมูลใช้ภายในทีมขายและบริการเท่านั้น ลิงก์ไปยัง LINE หรือ Google Maps จะพาไปยังบริการของผู้ให้บริการนั้น ซึ่งมีนโยบายความเป็นส่วนตัวของตัวเอง',
    rightsTitle: 'สิทธิของคุณ',
    rights: [
      'ขอเข้าถึงและขอรับสำเนาข้อมูลของคุณ',
      'ขอให้แก้ไขข้อมูลให้ถูกต้องและเป็นปัจจุบัน',
      'ขอให้ลบ ทำลาย หรือทำให้ข้อมูลไม่สามารถระบุตัวตนได้',
      'ขอให้ระงับการใช้ หรือคัดค้านการใช้ข้อมูล',
      'ขอให้โอนข้อมูลไปยังผู้อื่นในรูปแบบที่อ่านได้ด้วยเครื่อง',
      'ถอนความยินยอมเมื่อใดก็ได้ โดยไม่กระทบสิ่งที่ทำไปแล้วก่อนถอน',
      'ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล',
    ],
    rightsNote: 'เราตอบคำขอภายใน 30 วันนับจากวันที่ได้รับ',
    formTitle: 'ส่งคำขอเกี่ยวกับข้อมูลของคุณ',
    formLede: 'ใส่ชื่อและเบอร์โทรที่ใช้ติดต่อกับเรา เพื่อให้ค้นข้อมูลได้ถูกคน',
    request: 'คำขอ',
    requests: { access: 'ขอดูหรือขอสำเนาข้อมูล', correct: 'ขอแก้ไขข้อมูล', delete: 'ขอลบข้อมูล' } as Record<Request, string>,
    details: 'รายละเอียด',
    detailsHint: 'เช่น ข้อมูลที่ต้องการแก้ หรือช่วงเวลาที่เคยติดต่อ',
    send: 'ส่งคำขอ',
    doneTitle: 'ได้รับคำขอแล้ว',
    doneBody: 'เราจะยืนยันตัวตนทางโทรศัพท์และดำเนินการภายใน 30 วัน',
    doneRef: 'เลขคำขอ',
    sim: 'เว็บไซต์และโชว์รูมนี้เป็นระบบจำลองเพื่อการสาธิต ข้อมูลที่ส่งอยู่ในฐานข้อมูลจำลองเท่านั้น',
  },
  en: {
    title: 'Privacy policy',
    sub: 'Under Thailand’s Personal Data Protection Act B.E. 2562 (2019)',
    lede: 'We only keep what you type into a form, use it to answer your request, and you can see, correct or delete it at any time.',
    effective: 'Effective from 6 November 2026',
    controllerTitle: 'Data controller',
    controllerBody: 'The showroom is the controller of data sent through this site. For anything about your personal data, contact',
    formsTitle: 'What we collect and why',
    formsLede: 'Each form asks only for what that request needs, and every form needs your consent before it is sent.',
    cols: ['Form', 'What we collect', 'Used to', 'Legal basis', 'Kept for'],
    rows: [
      ['Contact and enquiries', 'Name, phone, email, LINE ID, message and models of interest', 'Answer and get back to you', 'Consent (section 19)', '1 year from your last contact'],
      ['Demonstration booking', 'The contact details above, the date and time, the model and your note', 'Arrange and confirm the booking', 'Consent, and steps before a contract (section 24(3))', '1 year from the booking date'],
      ['Quotation request', 'Contact details, company name, tax ID, billing address and the items chosen', 'Issue the quotation and sales documents', 'Steps at your request before a contract (section 24(3)) and legal obligation (section 24(6))', 'Quotations 1 year; tax and accounting records of a sale 5 years as the law requires'],
      ['Product reviews', 'Display name, rating and review text', 'Show the review publicly after a manager checks it', 'Consent (section 19)', 'Until you ask us to remove it'],
      ['Rights requests', 'Contact details and what you ask for', 'Carry out your request', 'Legal obligation (section 24(6))', '1 year after the request is closed'],
    ],
    browserTitle: 'What stays in your browser',
    browserBody:
      'This site uses no tracking cookies or analytics. Three things are kept on your own device only (localStorage): light or dark theme, the models you picked to compare, and the guide’s checklist. Clear them from your browser settings.',
    shareTitle: 'Who sees your data',
    shareBody:
      'We don’t sell, rent or pass your data on for marketing. It is used only by our sales and service team. Links to LINE or Google Maps take you to those services, which have their own privacy policies.',
    rightsTitle: 'Your rights',
    rights: [
      'See your data and get a copy',
      'Have it corrected and kept up to date',
      'Have it deleted, destroyed or anonymised',
      'Have its use restricted, or object to it',
      'Have it sent to someone else in a machine-readable format',
      'Withdraw consent at any time, without affecting what was done before',
      'Complain to the Personal Data Protection Committee office',
    ],
    rightsNote: 'We answer within 30 days of receiving a request.',
    formTitle: 'Send a request about your data',
    formLede: 'Use the name and phone number you contacted us with, so we find the right records.',
    request: 'Request',
    requests: { access: 'See or get a copy of my data', correct: 'Correct my data', delete: 'Delete my data' } as Record<Request, string>,
    details: 'Details',
    detailsHint: 'For example what needs correcting, or roughly when you contacted us',
    send: 'Send request',
    doneTitle: 'Request received',
    doneBody: 'We will confirm your identity by phone and act within 30 days.',
    doneRef: 'Request number',
    sim: 'This site and showroom are a demonstration. What you send only reaches the demo database.',
  },
}

export function PrivacyPage() {
  const lang = useLang()
  const c = COPY[lang]
  const k = formCopy(lang)
  const [request, setRequest] = useState<Request>('access')
  const [person, setPerson] = useState(emptyPerson)
  const [details, setDetails] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const { busy, errors, alert, formRef, run } = useSubmit<{ no: string }>(lang)

  const submit = (e: FormEvent) =>
    run(
      e,
      () => ({ ...validatePerson(person, lang), consent: consent ? undefined : k.errConsent }),
      () => apiPost<{ no: string }>('/api/public/privacy', { request, ...person, details: details.trim() || undefined, lang, consent, website }),
      (r) => {
        setDone(r.no)
        requestAnimationFrame(() => doneRef.current?.focus())
      },
    )

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede}>
        <p className="privacy-effective">{c.effective}</p>
      </PageStage>
      <div className="container c-page privacy">
        <section className="c-section" aria-labelledby="pv-controller">
          <h2 id="pv-controller">{c.controllerTitle}</h2>
          <p className="c-section__lede">{c.controllerBody}</p>
          <div className="c-sheet privacy__controller">
            <StoreDetails lang={lang} />
          </div>
        </section>

        <section className="c-section" aria-labelledby="pv-forms">
          <h2 id="pv-forms">{c.formsTitle}</h2>
          <p className="c-section__lede">{c.formsLede}</p>
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
                {c.rows.map(([form, ...cells]) => (
                  <tr key={form}>
                    <th scope="row">{form}</th>
                    {cells.map((cell, i) => (
                      <td key={i} data-label={c.cols[i + 1]}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="privacy__pair">
          <section className="c-sheet" aria-labelledby="pv-browser">
            <h2 id="pv-browser">{c.browserTitle}</h2>
            <p className="c-muted">{c.browserBody}</p>
          </section>
          <section className="c-sheet" aria-labelledby="pv-share">
            <h2 id="pv-share">{c.shareTitle}</h2>
            <p className="c-muted">{c.shareBody}</p>
          </section>
        </div>

        <section className="c-section c-split" aria-labelledby="pv-rights">
          <div>
            <h2 id="pv-rights">{c.rightsTitle}</h2>
            <ul className="privacy__rights">
              {c.rights.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="c-muted privacy__note">{c.rightsNote}</p>
          </div>

          <div className="c-sheet" id="request">
            <h2>{c.formTitle}</h2>
            {done ? (
              <div className="c-done" ref={doneRef} tabIndex={-1} role="status">
                <h3>{c.doneTitle}</h3>
                <p>
                  {c.doneRef} <span className="c-done__ref">{done}</span>
                </p>
                <p className="c-muted">{c.doneBody}</p>
              </div>
            ) : (
              <form ref={formRef} className="privacy-form" noValidate onSubmit={submit}>
                <p className="c-muted">{c.formLede}</p>
                <FormAlert message={alert} />
                <fieldset className="privacy-form__kind">
                  <legend className="field__label">{c.request}</legend>
                  {(Object.keys(c.requests) as Request[]).map((r) => (
                    <label key={r} className="choice">
                      <input type="radio" name="request" value={r} checked={request === r} onChange={() => setRequest(r)} />
                      <span>{c.requests[r]}</span>
                    </label>
                  ))}
                </fieldset>
                <PersonFields value={person} onChange={setPerson} errors={errors} withLine={false} />
                <Field label={c.details} name="details" multiline rows={3} value={details} onChange={setDetails} hint={c.detailsHint} maxLength={2000} />
                <Consent checked={consent} onChange={setConsent} error={errors.consent} />
                <Honeypot value={website} onChange={setWebsite} />
                <SubmitButton busy={busy}>{c.send}</SubmitButton>
              </form>
            )}
            <SimNote>{c.sim}</SimNote>
          </div>
        </section>
      </div>
    </>
  )
}
