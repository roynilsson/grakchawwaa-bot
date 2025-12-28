"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"
import { PlayerProvider, usePlayer } from "@/lib/player-context"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"

interface GuildMember {
  allyCode: string
  name: string | null
  joinedAt: string
  leftAt: string | null
  isActive: boolean
}

function GuildMembersContent() {
  const { selectedPlayer } = usePlayer()
  const [includeFormer, setIncludeFormer] = useState(false)
  const [members, setMembers] = useState<GuildMember[]>([])
  const [guildName, setGuildName] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchMembers() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          allyCode: selectedPlayer.allyCode,
          includeFormer: includeFormer.toString(),
        })

        const response = await fetch(`/api/guild-members?${params}`)
        if (!response.ok) throw new Error("Failed to fetch guild members")

        const data = await response.json()
        setMembers(data.members)
        setGuildName(data.guildName || "Unknown Guild")
      } catch (error) {
        console.error("Error fetching guild members:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMembers()
  }, [selectedPlayer, includeFormer])

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
          <h1 className="text-3xl font-bold tracking-tight">Guild Members</h1>
          {guildName && (
            <p className="mt-1 text-sm text-muted-foreground">{guildName}</p>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeFormer"
            checked={includeFormer}
            onCheckedChange={(checked) => setIncludeFormer(checked === true)}
          />
          <label
            htmlFor="includeFormer"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Include former members
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading guild members...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No guild members found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player Name</TableHead>
                <TableHead>Ally Code</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Left Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.allyCode}>
                  <TableCell className="font-medium">
                    {member.name || "Unknown"}
                  </TableCell>
                  <TableCell>{member.allyCode}</TableCell>
                  <TableCell>
                    {format(new Date(member.joinedAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {member.isActive ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                        Former
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.leftAt
                      ? format(new Date(member.leftAt), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary */}
      {!isLoading && members.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">
            Total: {members.length} member{members.length !== 1 ? "s" : ""} (
            {members.filter((m) => m.isActive).length} active
            {includeFormer &&
              `, ${members.filter((m) => !m.isActive).length} former`}
            )
          </p>
        </div>
      )}
    </div>
  )
}

export default function GuildMembersPage() {
  return (
    <PlayerProvider>
      <AppLayout>
        <GuildMembersContent />
      </AppLayout>
    </PlayerProvider>
  )
}
