import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OZONE Enterprise ERP',
  description: 'Multi-company ERP and voucher management system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
