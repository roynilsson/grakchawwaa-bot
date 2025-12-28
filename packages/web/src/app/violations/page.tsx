"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"
import { PlayerProvider, usePlayer } from "@/lib/player-context"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"

interface Violation {
  date: string
  playerId: string
  playerName: string
  tickets: number
  missingTickets: number
}

interface GuildPlayer {
  playerId: string
  name: string | null
  allyCode: string
}

function ViolationsContent() {
  const { selectedPlayer } = usePlayer()
  const [violations, setViolations] = useState<Violation[]>([])
  const [guildPlayers, setGuildPlayers] = useState<GuildPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterPlayerId, setFilterPlayerId] = useState<string>("")

  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchViolations() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          allyCode: selectedPlayer.allyCode,
          page: page.toString(),
        })

        if (filterPlayerId) {
          params.append("playerId", filterPlayerId)
        }

        const response = await fetch(`/api/violations?${params}`)
        if (!response.ok) throw new Error("Failed to fetch violations")

        const data = await response.json()
        setViolations(data.violations)
        setGuildPlayers(data.guildPlayers)
        setTotalPages(data.pagination.totalPages)
      } catch (error) {
        console.error("Error fetching violations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchViolations()
  }, [selectedPlayer, page, filterPlayerId])

  if (!selectedPlayer) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-muted-foreground">
          No player selected. Please register a player first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ticket Violations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View daily ticket collection violations
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <label className="mb-2 block text-sm font-medium">
              Filter by Player
            </label>
            <Select
              value={filterPlayerId}
              onValueChange={(value) => {
                setFilterPlayerId(value === "all" ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All players" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All players</SelectItem>
                {guildPlayers.map((player) => (
                  <SelectItem key={player.playerId} value={player.playerId}>
                    {player.name || player.allyCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading violations...
          </div>
        ) : violations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No violations found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Tickets Collected</TableHead>
                  <TableHead>Missing Tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((violation, index) => (
                  <TableRow key={`${violation.date}-${violation.playerId}-${index}`}>
                    <TableCell>
                      {format(new Date(violation.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {violation.playerName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          violation.tickets < 300
                            ? "text-red-600 font-semibold"
                            : violation.tickets < 500
                            ? "text-orange-600 font-semibold"
                            : "text-gray-900"
                        }
                      >
                        {violation.tickets} / 600
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600 font-semibold">
                        {violation.missingTickets}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ViolationsPage() {
  return (
    <PlayerProvider>
      <AppLayout>
        <ViolationsContent />
      </AppLayout>
    </PlayerProvider>
  )
}
