import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, TicketViolation, Player } from "@grakchawwaa/core"
import { NextRequest, NextResponse } from "next/server"

interface ViolationSummary {
  playerName: string
  playerId: string
  violationCount: number
  averageTickets: number
  totalMissingTickets: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const allyCode = searchParams.get("allyCode")
    const days = parseInt(searchParams.get("days") || "7")
    const includeFormer = searchParams.get("includeFormer") === "true"

    if (!allyCode) {
      return NextResponse.json(
        { error: "Ally code required" },
        { status: 400 }
      )
    }

    if (days < 1 || days > 90) {
      return NextResponse.json(
        { error: "Days must be between 1 and 90" },
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

    const guild = playerMembership.guild.unwrap()
    const guildId = guild.id

    // Get current active members if filtering
    let activePlayerIds: Set<string> | null = null
    if (!includeFormer) {
      const activeMembers = await guildMemberRepository.find(
        { guild: guildId, isActive: true },
        { populate: ["player"] }
      )
      activePlayerIds = new Set(
        activeMembers.map((m) => m.player.unwrap().playerId).filter((id): id is string => !!id)
      )
    }

    // Get violations for the time period
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const violations = await ticketViolationRepository.find(
      {
        guildId,
        date: { $gte: startDate },
      },
      {
        orderBy: { date: "DESC" },
      }
    )

    if (violations.length === 0) {
      return NextResponse.json({
        guildName: guild.name,
        daysInPeriod: days,
        violationsLogged: 0,
        playersFlagged: 0,
        totalMissingTickets: 0,
        playerStats: [],
      })
    }

    // Group violations by player (filtering by active members if requested)
    const playerViolations = new Map<string, { count: number; ticketSum: number }>()

    for (const violation of violations) {
      // Skip former members if not including them
      if (activePlayerIds && !activePlayerIds.has(violation.playerId)) {
        continue
      }

      const existing = playerViolations.get(violation.playerId) || {
        count: 0,
        ticketSum: 0,
      }
      existing.count++
      existing.ticketSum += violation.ticketCount
      playerViolations.set(violation.playerId, existing)
    }

    // Get player names
    const playerIds = Array.from(playerViolations.keys())
    const players = await playerRepository.find({
      playerId: { $in: playerIds },
    })

    const playerNamesMap = new Map(
      players.map((p) => [p.playerId!, p.name || "Unknown"])
    )

    // Calculate statistics
    const playerStats: ViolationSummary[] = []
    let totalMissingTickets = 0

    for (const [playerId, stats] of playerViolations.entries()) {
      const averageTickets = stats.ticketSum / stats.count
      const missingPerViolation = 600 - averageTickets
      const totalMissing = Math.round(missingPerViolation * stats.count)

      totalMissingTickets += totalMissing

      playerStats.push({
        playerId,
        playerName: playerNamesMap.get(playerId) || "Unknown",
        violationCount: stats.count,
        averageTickets: Math.round(averageTickets * 10) / 10, // Round to 1 decimal
        totalMissingTickets: totalMissing,
      })
    }

    // Sort by average tickets (worst first)
    playerStats.sort((a, b) => a.averageTickets - b.averageTickets)

    return NextResponse.json({
      guildName: guild.name,
      daysInPeriod: days,
      violationsLogged: violations.length,
      playersFlagged: playerStats.length,
      totalMissingTickets,
      playerStats,
    })
  } catch (error) {
    console.error("Error fetching violations summary:", error)
    return NextResponse.json(
      { error: "Failed to fetch violations summary" },
      { status: 500 }
    )
  }
}
