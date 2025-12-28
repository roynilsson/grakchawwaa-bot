import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, TicketViolation, Player } from "@grakchawwaa/core"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const allyCode = searchParams.get("allyCode")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const filterPlayerId = searchParams.get("playerId") || undefined
    const dateFrom = searchParams.get("dateFrom") || undefined
    const dateTo = searchParams.get("dateTo") || undefined

    if (!allyCode) {
      return NextResponse.json(
        { error: "Ally code required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)
    const ticketViolationRepository = em.getRepository(TicketViolation)
    const playerRepository = em.getRepository(Player)

    // Find the player's guild
    const playerMembership = await guildMemberRepository.findOne(
      { player: allyCode, isActive: true },
      { populate: ["guild"] }
    )

    if (!playerMembership) {
      return NextResponse.json(
        { error: "Player not in any guild" },
        { status: 404 }
      )
    }

    const guildId = playerMembership.guild.unwrap().id

    // Build filter for violations
    const where: any = { guildId }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.$lte = new Date(dateTo)
      }
    }

    // Get all violations for the guild (without pagination first)
    const violations = await ticketViolationRepository.find(where, {
      orderBy: { date: "DESC" },
    })

    // Flatten violations and filter by player if needed
    const flattenedViolations: Array<{
      date: Date
      playerId: string
      tickets: number
    }> = []

    for (const violation of violations) {
      if (violation.ticketCounts) {
        for (const [playerId, tickets] of Object.entries(violation.ticketCounts)) {
          if (!filterPlayerId || playerId === filterPlayerId) {
            flattenedViolations.push({
              date: violation.date,
              playerId,
              tickets,
            })
          }
        }
      }
    }

    // Sort by date descending, then by tickets ascending (worst violations first)
    flattenedViolations.sort((a, b) => {
      const dateCompare = b.date.getTime() - a.date.getTime()
      if (dateCompare !== 0) return dateCompare
      return a.tickets - b.tickets
    })

    // Apply pagination to flattened violations
    const total = flattenedViolations.length
    const paginatedViolations = flattenedViolations.slice(
      (page - 1) * limit,
      page * limit
    )

    // Get player names (only for paginated violations)
    const playerIds = [...new Set(paginatedViolations.map((v) => v.playerId))]
    const players = await playerRepository.find({
      playerId: { $in: playerIds },
    })

    const playerNamesMap = new Map(
      players.map((p) => [p.playerId!, p.name || "Unknown"])
    )

    // Get all players in guild for filter dropdown
    const guildMembers = await guildMemberRepository.find(
      { guild: guildId },
      { populate: ["player"] }
    )

    const guildPlayers = guildMembers.map((m) => {
      const player = m.player.unwrap()
      return {
        playerId: player.playerId,
        name: player.name,
        allyCode: player.allyCode,
      }
    }).filter((p) => p.playerId) // Only players with playerId

    return NextResponse.json({
      violations: paginatedViolations.map((v) => ({
        date: v.date.toISOString(),
        playerId: v.playerId,
        playerName: playerNamesMap.get(v.playerId) || "Unknown",
        tickets: v.tickets,
        missingTickets: 600 - v.tickets,
      })),
      guildPlayers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching violations:", error)
    return NextResponse.json(
      { error: "Failed to fetch violations" },
      { status: 500 }
    )
  }
}
