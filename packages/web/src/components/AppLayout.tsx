"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PlayerSelector } from "./PlayerSelector"
import { Button } from "./ui/button"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { usePlayer } from "@/lib/player-context"

const navItems = [
  { href: "/guild-members", label: "Guild Members", requiresPermission: false },
  { href: "/violations", label: "Ticket Violations", requiresPermission: false },
  { href: "/violations-summary", label: "Violations Summary", requiresPermission: true },
  { href: "/warnings", label: "Warnings", requiresPermission: false },
  { href: "/warning-types", label: "Warning Types", requiresPermission: true },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { permissions } = usePlayer()

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(
    (item) => !item.requiresPermission || permissions.isOfficerOrLeader
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link href="/guild-members" className="text-xl font-bold">
                Grakchawwaa
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex md:gap-6">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-primary",
                      pathname === item.href
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right side - Player Selector + Sign Out */}
            <div className="flex items-center gap-4">
              <PlayerSelector />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
