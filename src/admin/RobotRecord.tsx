import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { AVAILABILITY_LABEL, CATEGORY_LABEL, formatListPrice, formatMonthTh, formatNumber, formatRange, LOCOMOTION_LABEL, msToKmh, ORIGIN_LABEL } from '../lib/format'
import type { Model } from '../lib/types'
import { baht } from './format'
import { TableWrap } from './ui'

const none = 'ไม่ระบุ'
const n = (v: number | null, unit: string) => (v === null ? none : `${formatNumber(v)} ${unit}`)

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted">{none}</p>
  return (
    <ul className="bullets">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="record__block">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

/** Everything the brochure knows about a robot model, laid out as a printed spec sheet. */
export function RobotRecord({ record }: { record: Model }) {
  const m = record
  return (
    <div className="record">
      <div className="record__intro">
        <p className="record__tagline">{m.tagline}</p>
        <div className="prose">
          <p>{m.summary}</p>
          <p>{m.background}</p>
        </div>
        <a className="text-link" href={`../#/models/${m.id}`}>
          <ExternalLink size={16} aria-hidden />
          เปิดหน้ารุ่นนี้บนเว็บไซต์
        </a>
      </div>

      <dl className="spec">
        <div>
          <dt>ผู้ผลิต</dt>
          <dd>{m.brand}</dd>
        </div>
        <div>
          <dt>ชื่อรุ่น</dt>
          <dd>
            {m.nameEn} ({m.nameTh})
          </dd>
        </div>
        <div>
          <dt>กลุ่ม</dt>
          <dd>{m.segment}</dd>
        </div>
        <div>
          <dt>การใช้งานหลัก</dt>
          <dd>{CATEGORY_LABEL[m.category]}</dd>
        </div>
        <div>
          <dt>การเคลื่อนที่</dt>
          <dd>{LOCOMOTION_LABEL[m.locomotion]}</dd>
        </div>
        <div>
          <dt>ประเทศผู้ผลิต</dt>
          <dd>
            {m.originCountry} ({ORIGIN_LABEL[m.originGroup]})
          </dd>
        </div>
        <div>
          <dt>วางจำหน่าย</dt>
          <dd>{formatMonthTh(m.launched)}</dd>
        </div>
        <div>
          <dt>ความสูง</dt>
          <dd>{m.heightCm} ซม.</dd>
        </div>
        <div>
          <dt>น้ำหนัก</dt>
          <dd>{formatRange(m.weightKg, 'กก.') ?? none}</dd>
        </div>
        <div>
          <dt>อันดับผู้ผลิตตามยอดส่งมอบ</dt>
          <dd>{m.makerRank ? `อันดับ ${m.makerRank}` : 'ไม่อยู่ในอันดับ'}</dd>
        </div>
        <div>
          <dt>การจำหน่ายในไทย</dt>
          <dd>{AVAILABILITY_LABEL[m.availability]}</dd>
        </div>
        <div>
          <dt>ผู้จัดจำหน่าย</dt>
          <dd>{m.distributor}</dd>
        </div>
      </dl>

      <Block title="รุ่นย่อยและสเปก">
        <TableWrap label="ตารางรุ่นย่อยและสเปก">
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">รุ่นย่อย</th>
                <th scope="col" className="num">
                  ราคา (บาท)
                </th>
                <th scope="col">ที่มาของราคา</th>
                <th scope="col">ราคาผู้ผลิต</th>
                <th scope="col" className="num">
                  DoF
                </th>
                <th scope="col">มือ</th>
                <th scope="col" className="num">
                  รับน้ำหนัก
                </th>
                <th scope="col" className="num">
                  ความเร็ว
                </th>
                <th scope="col" className="num">
                  ใช้งานต่อชาร์จ
                </th>
                <th scope="col" className="num">
                  แบตเตอรี่
                </th>
                <th scope="col">คอมพิวเตอร์</th>
                <th scope="col" className="num">
                  แรงบิดข้อต่อสูงสุด
                </th>
              </tr>
            </thead>
            <tbody>
              {m.trims.map((t) => (
                <tr key={t.name}>
                  <th scope="row">{t.name}</th>
                  <td className="num">{t.priceTHB !== null ? baht(t.priceTHB) : none}</td>
                  <td>{t.priceBasis === 'dealer' ? 'ตัวแทนในไทย' : t.priceBasis === 'converted' ? 'แปลงสกุลเงิน' : none}</td>
                  <td className="nowrap">{t.listPrice ? formatListPrice(t.listPrice, true) : none}</td>
                  <td className="num">{t.dof ?? none}</td>
                  <td>{t.hand ?? (t.handDof ? `${t.handDof} DoF ต่อข้าง` : none)}</td>
                  <td className="num">{n(t.payloadKg, 'กก.')}</td>
                  <td className="num">{t.speedMs !== null ? `${formatNumber(msToKmh(t.speedMs))} กม./ชม.` : none}</td>
                  <td className="num">{n(t.runtimeH, 'ชม.')}</td>
                  <td className="num">{n(t.batteryWh, 'Wh')}</td>
                  <td>{t.compute ?? none}</td>
                  <td className="num">{n(t.jointTorqueNm, 'N·m')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {m.priceNote && <p className="record__note">{m.priceNote}</p>}
      </Block>

      <div className="record__grid">
        <Block title="การจัดจำหน่ายในไทย">
          <p>{m.availabilityNote}</p>
        </Block>
        <Block title="เซนเซอร์">
          <List items={m.sensors} />
        </Block>
        <Block title="การชาร์จ">
          <dl className="kv">
            <div>
              <dt>เวลาชาร์จ</dt>
              <dd>{n(m.charging.timeH, 'ชม.')}</dd>
            </div>
            <div>
              <dt>เปลี่ยนแบตเตอรี่เองได้</dt>
              <dd>{m.charging.swappable ? 'ได้' : 'ไม่ได้'}</dd>
            </div>
          </dl>
          {m.charging.note && <p className="record__note">{m.charging.note}</p>}
        </Block>
        <Block title="ซอฟต์แวร์">
          <dl className="kv">
            <div>
              <dt>ชุดพัฒนา (SDK)</dt>
              <dd>{m.software.sdk ?? none}</dd>
            </div>
            <div>
              <dt>ระบบ AI</dt>
              <dd>{m.software.ai ?? none}</dd>
            </div>
          </dl>
        </Block>
        <Block title="การรับประกัน">
          <dl className="kv">
            <div>
              <dt>ตัวเครื่อง</dt>
              <dd>{m.warranty.robot}</dd>
            </div>
            <div>
              <dt>แบตเตอรี่</dt>
              <dd>{m.warranty.battery ?? none}</dd>
            </div>
          </dl>
          {m.warranty.note && <p className="record__note">{m.warranty.note}</p>}
        </Block>
        <Block title="ความปลอดภัย">
          <List items={m.safety.features} />
          {m.safety.certifications.length > 0 && (
            <p className="record__note">มาตรฐาน: {m.safety.certifications.join(', ')}</p>
          )}
        </Block>
        <Block title="งานที่ใช้">
          <List items={m.useCases} />
        </Block>
        <Block title="จุดเด่น">
          <List items={m.highlights} />
        </Block>
        <Block title="ข้อดี">
          <List items={m.pros} />
        </Block>
        <Block title="ข้อควรรู้">
          <List items={m.cons} />
        </Block>
        <Block title="เหมาะกับ">
          <List items={m.idealFor} />
        </Block>
        <Block title="ควรพิจารณาก่อนซื้อ">
          <List items={m.considerations} />
        </Block>
      </div>

      {m.funFact && (
        <Block title="เกร็ดน่ารู้">
          <p>{m.funFact}</p>
        </Block>
      )}

      <Block title="ภาพและแหล่งข้อมูล">
        <p className="record__note">
          ภาพโดย {m.image.author} สัญญาอนุญาต {m.image.license}{' '}
          <a href={m.image.page} target="_blank" rel="noreferrer">
            หน้าไฟล์ภาพ
          </a>
        </p>
        <ul className="bullets sources">
          {m.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </Block>
    </div>
  )
}
