// app/layout.tsx
import './globals.css'
import NextAuthSessionProvider from './providers/SessionProvider'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CoS Portal - AI-Powered Certificate of Sponsorship Management',
  description: 'Streamline your visa sponsorship process with intelligent automation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  )
} 