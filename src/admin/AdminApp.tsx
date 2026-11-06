import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import { ActivityPage } from './pages/ActivityPage'
import { BookingsPage } from './pages/BookingsPage'
import { CustomerPage, CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { LeadPage, LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrderPage, OrdersPage } from './pages/OrdersPage'
import { PosPage } from './pages/PosPage'
import { ProductPage } from './pages/ProductPage'
import { ProductsPage, StockPage } from './pages/ProductsPage'
import { QuotePage, QuotesPage } from './pages/QuotesPage'
import { ReportsPage } from './pages/ReportsPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShiftsPage } from './pages/ShiftsPage'
import { SessionProvider, ToastProvider } from './session'
import { Shell } from './Shell'
import type { PublicStaff } from './types'
import { Loading } from './ui'

export default function AdminApp() {
  const [staff, setStaff] = useState<PublicStaff | null>(null)
  const [checking, setChecking] = useState(() => Boolean(getToken()))
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStaff(null)
      setNotice('หมดเวลาการใช้งาน หรือข้อมูลจำลองถูกสร้างใหม่ เข้าสู่ระบบอีกครั้ง')
    })
    if (getToken()) {
      api<PublicStaff>('/auth/me')
        .then(setStaff, () => {})
        .finally(() => setChecking(false))
    }
    return () => setUnauthorizedHandler(null)
  }, [])

  const logout = useCallback(() => {
    api('/auth/logout', { body: {} })
      .catch(() => {})
      .finally(() => {
        setToken(null)
        setStaff(null)
        setNotice('ออกจากระบบแล้ว')
      })
  }, [])

  const login = useCallback((s: PublicStaff) => {
    setNotice(null)
    setStaff(s)
  }, [])

  if (checking) return <Loading label="กำลังตรวจสอบการเข้าสู่ระบบ" />

  return (
    <HashRouter useTransitions={false}>
      <ToastProvider>
        {staff ? (
          <SessionProvider staff={staff} onLogout={logout}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<DashboardPage />} />
                <Route path="pos" element={<PosPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderPage />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="quotes/:id" element={<QuotePage />} />
                <Route path="leads" element={<LeadsPage />} />
                <Route path="leads/:id" element={<LeadPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/:id" element={<ProductPage />} />
                <Route path="stock" element={<StockPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerPage />} />
                <Route path="shifts" element={<ShiftsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </SessionProvider>
        ) : (
          <LoginPage onLogin={login} notice={notice} />
        )}
      </ToastProvider>
    </HashRouter>
  )
}
