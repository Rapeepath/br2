import { Printer } from 'lucide-react'
import { baht, PAYMENT_LABEL, receiptDate } from './format'
import type { Customer, Order, Settings } from './types'
import './receipt.css'

/** A company (or anyone with a tax id) gets a full tax invoice with the buyer's details. */
export const isFullInvoice = (customer: Customer | null) => Boolean(customer && (customer.kind === 'company' || customer.taxId))

/** Prints only the receipt (see receipt.css), whichever dialog it sits in. */
export function printReceipt() {
  const html = document.documentElement
  html.classList.add('print-receipt')
  const done = () => {
    html.classList.remove('print-receipt')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-ghost" onClick={printReceipt}>
      <Printer size={18} aria-hidden />
      พิมพ์ใบเสร็จ
    </button>
  )
}

export function Receipt({ order, customer, settings }: { order: Order; customer: Customer | null; settings: Settings }) {
  const full = isFullInvoice(customer)
  const p = order.payment
  return (
    <article className={`receipt ${full ? 'receipt--full' : ''}`} aria-label={`ใบเสร็จเลขที่ ${order.no}`}>
      <header className="receipt__store">
        <p className="receipt__name" lang="en">
          {settings.storeName}
        </p>
        <p>{settings.branch}</p>
        <p>{settings.address}</p>
        <p>โทร {settings.phone}</p>
        <p>เลขประจำตัวผู้เสียภาษี {settings.taxId}</p>
      </header>

      <div className="receipt__doc">
        <p className="receipt__doctitle">{full ? 'ใบกำกับภาษี/ใบเสร็จรับเงิน' : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}</p>
        {full && <p className="receipt__copy">ต้นฉบับ</p>}
      </div>

      <dl className="receipt__meta">
        <div>
          <dt>เลขที่</dt>
          <dd className="receipt__no">{order.no}</dd>
        </div>
        <div>
          <dt>วันที่</dt>
          <dd>{receiptDate(order.createdAt)}</dd>
        </div>
        <div>
          <dt>พนักงาน</dt>
          <dd>{order.staffName}</dd>
        </div>
        {order.quotationNo && (
          <div>
            <dt>อ้างอิงใบเสนอราคา</dt>
            <dd className="receipt__ref">{order.quotationNo}</dd>
          </div>
        )}
        {!full && (
          <div>
            <dt>ลูกค้า</dt>
            <dd>{order.customerName ?? 'ลูกค้าทั่วไป'}</dd>
          </div>
        )}
      </dl>

      {full && customer && (
        <section className="receipt__buyer" aria-label="ข้อมูลผู้ซื้อ">
          <p className="receipt__buyer-title">ผู้ซื้อ</p>
          <dl>
            <div>
              <dt>ชื่อ</dt>
              <dd>{customer.name}</dd>
            </div>
            <div>
              <dt>เลขประจำตัวผู้เสียภาษี</dt>
              <dd>{customer.taxId ?? 'ไม่ได้ระบุ'}</dd>
            </div>
            <div>
              <dt>ที่อยู่</dt>
              <dd>{customer.address ?? 'ไม่ได้ระบุ'}</dd>
            </div>
            <div>
              <dt>โทร</dt>
              <dd>{customer.phone}</dd>
            </div>
          </dl>
        </section>
      )}

      <table className="receipt__lines">
        <thead>
          <tr>
            <th scope="col">รายการ</th>
            <th scope="col" className="num">
              จำนวน
            </th>
            <th scope="col" className="num">
              จำนวนเงิน
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.productId}>
              <td>
                <span className="receipt__item">{l.name}</span>
                <span className="receipt__sub">
                  {l.sku} @ {baht(l.unitPrice)}
                  {l.discount > 0 && <> ส่วนลด {baht(l.discount)}</>}
                </span>
              </td>
              <td className="num">{l.qty}</td>
              <td className="num">{baht(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="receipt__totals">
        <div>
          <dt>รวมเป็นเงิน</dt>
          <dd>{baht(order.subtotal)}</dd>
        </div>
        {order.lineDiscount > 0 && (
          <div>
            <dt>ส่วนลดรายการ</dt>
            <dd>−{baht(order.lineDiscount)}</dd>
          </div>
        )}
        {order.billDiscount > 0 && (
          <div>
            <dt>ส่วนลดท้ายบิล</dt>
            <dd>−{baht(order.billDiscount)}</dd>
          </div>
        )}
        <div className="receipt__grand">
          <dt>ยอดสุทธิ</dt>
          <dd>{baht(order.total)} บาท</dd>
        </div>
        <div>
          <dt>มูลค่าสินค้าก่อนภาษี</dt>
          <dd>{baht(order.beforeVat)}</dd>
        </div>
        <div>
          <dt>ภาษีมูลค่าเพิ่ม {order.vatRate}%</dt>
          <dd>{baht(order.vat)}</dd>
        </div>
      </dl>

      <dl className="receipt__pay">
        <div>
          <dt>ชำระโดย</dt>
          <dd>{PAYMENT_LABEL[p.method]}</dd>
        </div>
        {p.tendered !== null && (
          <div>
            <dt>รับเงิน</dt>
            <dd>{baht(p.tendered)}</dd>
          </div>
        )}
        {p.change !== null && (
          <div>
            <dt>เงินทอน</dt>
            <dd className="receipt__change">{baht(p.change)}</dd>
          </div>
        )}
        {p.cardLast4 && (
          <div>
            <dt>บัตร</dt>
            <dd>**** {p.cardLast4}</dd>
          </div>
        )}
        {p.reference && (
          <div>
            <dt>{p.method === 'card' ? 'รหัสอนุมัติ' : 'เลขอ้างอิง'}</dt>
            <dd>{p.reference}</dd>
          </div>
        )}
      </dl>

      {order.refund && (
        <p className="receipt__void">
          คืนเงินแล้ว {receiptDate(order.refund.at)} เหตุผล: {order.refund.reason}
        </p>
      )}
      {order.note && <p className="receipt__note">หมายเหตุ: {order.note}</p>}
      {settings.receiptFooter && <p className="receipt__footer">{settings.receiptFooter}</p>}
      <p className="receipt__sim">เอกสารจากระบบจำลองเพื่อทดสอบ ใช้เป็นหลักฐานทางภาษีจริงไม่ได้</p>
    </article>
  )
}
