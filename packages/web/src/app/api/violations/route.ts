import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, TicketViolation, Player, PermissionService } from "@grakchawwaa/core"
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
    const permissionService = new PermissionService(em)

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

    // Check permissions
    const hasPermission = await permissionService.isOfficerOrLeader(guildId, allyCode)

    // Find the player record to get playerId for filtering
    const player = await playerRepository.findOne({ allyCode })
    const playerId = player?.playerId

    // Build filter for violations
    const where: any = { guildId }

    // If regular member, force filter to only their violations
    if (!hasPermission && playerId) {
      where.playerId = playerId
    } else if (filterPlayerId) {
      // Officers/leaders can filter by any player
      where.playerId = filterPlayerId
    }
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.$lte = new Date(dateTo)
      }
    }

    // Get violations with pagination (no need to flatten - already individual rows!)
    const [violations, total] = await ticketViolationRepository.findAndCount(
      where,
      {
        orderBy: { date: "DESC", ticketCount: "ASC" },
        limit,
        offset: (page - 1) * limit,
      }
    )

    // Get player names for the violations on this page
    const playerIds = [...new Set(violations.map((v) => v.playerId))]
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
      violations: violations.map((v) => ({
        date: v.date.toISOString(),
        playerId: v.playerId,
        playerName: playerNamesMap.get(v.playerId) || "Unknown",
        tickets: v.ticketCount,
        missingTickets: 600 - v.ticketCount,
      })),
      guildPlayers: hasPermission ? guildPlayers : [], // Only return player list for officers/leaders
      hasPermission,
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
