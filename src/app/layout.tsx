import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google"

import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/sonner"
import { DEFAULT_LOCALE, getDocumentLang, LOCALE_COOKIE_KEY, resolveLocaleFrom, studioMessages } from "@/lib/i18n"
import "./globals.css"

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
})

export const metadata: Metadata = {
  title: studioMessages[DEFAULT_LOCALE].metadataTitle,
  description: studioMessages[DEFAULT_LOCALE].metadataDescription,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale = resolveLocaleFrom(
    cookieStore.get(LOCALE_COOKIE_KEY)?.value,
    headerStore.get("accept-language")
  )

  return (
    <html
      lang={getDocumentLang(locale)}
      translate="no"
      className={`${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="notranslate flex min-h-full flex-col" translate="no" suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
