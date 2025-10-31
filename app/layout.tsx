import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'AI Opportunity Brief',
  description: 'Generate company-specific AI opportunity briefs with citations.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen bg-[#0A0A0A] text-white antialiased">
        {children}
      </body>
    </html>
  )
}


