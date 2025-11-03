import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'AI Opportunity Brief',
  description: 'Generate company-specific AI opportunity briefs with citations.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}


