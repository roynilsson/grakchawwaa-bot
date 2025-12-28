import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Grakchawwaa - SWGOH Guild Management",
  description: "Star Wars Galaxy of Heroes guild management and tracking",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
