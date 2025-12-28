"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"
import { PlayerProvider, usePlayer } from "@/lib/player-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { Plus } from "lucide-react"

interface Warning {
  id: number
  createdAt: string
  note: string | null
  player: {
    allyCode: string
    name: string | null
  }
  warningType: {
    id: number
    name: string
    severity: number
  }
}

interface WarningType {
  id: number
  name: string
  severity: number
}

interface GuildPlayer {
  playerId: string
  name: string | null
  allyCode: string
}

function WarningsContent() {
  const { selectedPlayer } = usePlayer()
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [warningTypes, setWarningTypes] = useState<WarningType[]>([])
  const [guildPlayers, setGuildPlayers] = useState<GuildPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterPlayerId, setFilterPlayerId] = useState<string>("")
  const [filterWarningTypeId, setFilterWarningTypeId] = useState<string>("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ playerId: "", warningTypeId: "", note: "" })
  const [isSaving, setIsSaving] = useState(false)

  // Fetch warning types for the filter and create form
  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchWarningTypes() {
      try {
        const response = await fetch(
          `/api/warning-types?allyCode=${selectedPlayer.allyCode}`
        )
        if (!response.ok) throw new Error("Failed to fetch warning types")

        const data = await response.json()
        setWarningTypes(data.warningTypes)
      } catch (error) {
        console.error("Error fetching warning types:", error)
      }
    }

    fetchWarningTypes()
  }, [selectedPlayer])

  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchWarnings() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          allyCode: selectedPlayer.allyCode,
          page: page.toString(),
        })

        if (filterPlayerId) {
          params.append("playerId", filterPlayerId)
        }

        if (filterWarningTypeId) {
          params.append("warningTypeId", filterWarningTypeId)
        }

        const response = await fetch(`/api/warnings?${params}`)
        if (!response.ok) throw new Error("Failed to fetch warnings")

        const data = await response.json()
        setWarnings(data.warnings)
        setTotalPages(data.totalPages)

        // Get guild players from the first fetch (for officers/leaders)
        if (page === 1 && !guildPlayers.length) {
          // Fetch guild members for the player selector
          const membersResponse = await fetch(
            `/api/guild-members?allyCode=${selectedPlayer.allyCode}`
          )
          if (membersResponse.ok) {
            const membersData = await membersResponse.json()
            setGuildPlayers(membersData.members || [])
          }
        }
      } catch (error) {
        console.error("Error fetching warnings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWarnings()
  }, [selectedPlayer, page, filterPlayerId, filterWarningTypeId])

  const handleCreate = async () => {
    if (!selectedPlayer || !formData.playerId || !formData.warningTypeId) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allyCode: selectedPlayer.allyCode,
          playerId: formData.playerId,
          warningTypeId: parseInt(formData.warningTypeId),
          note: formData.note || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create warning")
      }

      // Refresh warnings list
      setIsCreateDialogOpen(false)
      setFormData({ playerId: "", warningTypeId: "", note: "" })
      setPage(1)
      // Trigger re-fetch by updating a dependency
      window.location.reload()
    } catch (error) {
      console.error("Error creating warning:", error)
      alert(error instanceof Error ? error.message : "Failed to create warning")
    } finally {
      setIsSaving(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage player warnings
          </p>
        </div>
        {guildPlayers.length > 0 && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Issue Warning
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue Warning</DialogTitle>
                <DialogDescription>
                  Issue a warning to a guild member.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-player">Player</Label>
                  <Select
                    value={formData.playerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, playerId: value })
                    }
                  >
                    <SelectTrigger id="create-player">
                      <SelectValue placeholder="Select a player" />
                    </SelectTrigger>
                    <SelectContent>
                      {guildPlayers.map((player) => (
                        <SelectItem key={player.allyCode} value={player.allyCode}>
                          {player.name || player.allyCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-warning-type">Warning Type</Label>
                  <Select
                    value={formData.warningTypeId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, warningTypeId: value })
                    }
                  >
                    <SelectTrigger id="create-warning-type">
                      <SelectValue placeholder="Select a warning type" />
                    </SelectTrigger>
                    <SelectContent>
                      {warningTypes.map((wt) => (
                        <SelectItem key={wt.id} value={wt.id.toString()}>
                          {wt.name} (Severity: {wt.severity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-note">Note (Optional)</Label>
                  <Input
                    id="create-note"
                    placeholder="Add additional context..."
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    setFormData({ playerId: "", warningTypeId: "", note: "" })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSaving || !formData.playerId || !formData.warningTypeId}
                >
                  {isSaving ? "Issuing..." : "Issue Warning"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      {guildPlayers.length > 0 && (
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
                    <SelectItem key={player.allyCode} value={player.allyCode}>
                      {player.name || player.allyCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <label className="mb-2 block text-sm font-medium">
                Filter by Warning Type
              </label>
              <Select
                value={filterWarningTypeId}
                onValueChange={(value) => {
                  setFilterWarningTypeId(value === "all" ? "" : value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {warningTypes.map((wt) => (
                    <SelectItem key={wt.id} value={wt.id.toString()}>
                      {wt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading warnings...
          </div>
        ) : warnings.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No warnings found
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Warning Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warnings.map((warning) => (
                  <TableRow key={warning.id}>
                    <TableCell>
                      {format(new Date(warning.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {warning.player.name || warning.player.allyCode}
                    </TableCell>
                    <TableCell>{warning.warningType.name}</TableCell>
                    <TableCell>
                      <span
                        className={
                          warning.warningType.severity >= 8
                            ? "font-semibold text-red-600"
                            : warning.warningType.severity >= 5
                            ? "font-semibold text-orange-600"
                            : "text-gray-900"
                        }
                      >
                        {warning.warningType.severity}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {warning.note || "—"}
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

export default function WarningsPage() {
  return (
    <PlayerProvider>
      <AppLayout>
        <WarningsContent />
      </AppLayout>
    </PlayerProvider>
  )
}
