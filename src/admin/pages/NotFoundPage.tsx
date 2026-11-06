import { Link } from 'react-router'
import { PageHead } from '../ui'

export function NotFoundPage() {
  return (
    <>
      <PageHead title="ไม่พบหน้านี้" lead="ลิงก์อาจพิมพ์ผิดหรือหน้าถูกย้ายไปแล้ว เลือกเมนูทางซ้าย หรือกลับไปหน้าภาพรวม" />
      <Link className="btn btn-primary" to="/">
        กลับไปหน้าภาพรวม
      </Link>
    </>
  )
}
