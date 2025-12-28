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
import { Checkbox } from "@/components/ui/checkbox"

interface PlayerStat {
  playerId: string
  playerName: string
  violationCount: number
  averageTickets: number
  totalMissingTickets: number
}

interface SummaryData {
  guildName: string
  daysInPeriod: number
  violationsLogged: number
  playersFlagged: number
  totalMissingTickets: number
  playerStats: PlayerStat[]
}

const PRESET_PERIODS = [
  { value: "7", label: "Last 7 days (Weekly)" },
  { value: "30", label: "Last 30 days (Monthly)" },
  { value: "14", label: "Last 14 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
]

function ViolationsSummaryContent() {
  const { selectedPlayer } = usePlayer()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [days, setDays] = useState("7")
  const [customDays, setCustomDays] = useState("")
  const [includeFormer, setIncludeFormer] = useState(false)

  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchSummary() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/violations/summary?allyCode=${selectedPlayer.allyCode}&days=${days}&includeFormer=${includeFormer}`
        )
        if (!response.ok) throw new Error("Failed to fetch summary")

        const data = await response.json()
        setSummary(data)
      } catch (error) {
        console.error("Error fetching summary:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSummary()
  }, [selectedPlayer, days, includeFormer])

  const handleCustomDaysSubmit = () => {
    const parsedDays = parseInt(customDays)
    if (parsedDays >= 1 && parsedDays <= 90) {
      setDays(customDays)
    }
  }

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
        <h1 className="text-3xl font-bold tracking-tight">
          Ticket Violations Summary
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated statistics showing player performance over time
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4">
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">
                Time Period
              </label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Custom Days (1-90)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="h-10 rounded-md border px-3"
                  placeholder="e.g. 15"
                />
              </div>
              <Button onClick={handleCustomDaysSubmit}>Apply</Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeFormer"
              checked={includeFormer}
              onCheckedChange={(checked) => setIncludeFormer(checked as boolean)}
            />
            <label
              htmlFor="includeFormer"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include former guild members
            </label>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {isLoading ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-muted-foreground">Loading summary...</p>
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Period
              </p>
              <p className="mt-1 text-2xl font-bold">
                {summary.daysInPeriod} days
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Violations Logged
              </p>
              <p className="mt-1 text-2xl font-bold">
                {summary.violationsLogged}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Players Flagged
              </p>
              <p className="mt-1 text-2xl font-bold">
                {summary.playersFlagged}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total Missing Tickets
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {summary.totalMissingTickets.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Player Statistics Table */}
          <div className="rounded-lg border bg-white">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">
                {summary.guildName} - Player Performance
              </h2>
              <p className="text-sm text-muted-foreground">
                Sorted by average tickets (worst performers first)
              </p>
            </div>

            {summary.playerStats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No violations found for this period
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">
                      Avg Tickets
                    </TableHead>
                    <TableHead className="text-right">
                      Missing Tickets
                    </TableHead>
                    <TableHead className="text-right">Violations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.playerStats.map((stat, index) => (
                    <TableRow key={stat.playerId}>
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>{stat.playerName}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            stat.averageTickets < 300
                              ? "font-semibold text-red-600"
                              : stat.averageTickets < 500
                              ? "font-semibold text-orange-600"
                              : "text-gray-900"
                          }
                        >
                          {stat.averageTickets.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {stat.totalMissingTickets.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.violationCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-muted-foreground">Failed to load summary</p>
        </div>
      )}
    </div>
  )
}

export default function ViolationsSummaryPage() {
  return (
    <PlayerProvider>
      <AppLayout>
        <ViolationsSummaryContent />
      </AppLayout>
    </PlayerProvider>
  )
}
