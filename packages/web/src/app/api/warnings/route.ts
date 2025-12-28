import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, Warning, PermissionService, WarningFilters } from "@grakchawwaa/core"
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
    const limit = parseInt(searchParams.get("limit") || "20")
    const playerId = searchParams.get("playerId") || undefined
    const warningTypeId = searchParams.get("warningTypeId")
      ? parseInt(searchParams.get("warningTypeId")!)
      : undefined
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined

    if (!allyCode) {
      return NextResponse.json(
        { error: "Ally code required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)
    const warningRepository = em.getRepository(Warning)
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

    // Check permissions - officers/leaders can see all warnings, regular members only see their own
    const hasPermission = await permissionService.isOfficerOrLeader(guildId, allyCode)

    const filters: WarningFilters = {
      guildId,
      playerId: hasPermission ? playerId : allyCode, // Regular members can only see their own
      warningTypeId,
      startDate,
      endDate,
      limit,
      offset: (page - 1) * limit,
    }

    const { warnings, total } = await warningRepository.getGuildWarnings(filters)

    return NextResponse.json({
      warnings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Error fetching warnings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { allyCode, playerId, warningTypeId, note } = body

    if (!allyCode || !playerId || !warningTypeId) {
      return NextResponse.json(
        { error: "Ally code, player ID, and warning type ID required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)
    const warningRepository = em.getRepository(Warning)
    const permissionService = new PermissionService(em)

    // Find the issuer's guild
    const issuerMembership = await guildMemberRepository.findOne(
      { player: allyCode, isActive: true },
      { populate: ["guild"] }
    )

    if (!issuerMembership) {
      return NextResponse.json(
        { error: "Player not in any guild" },
        { status: 404 }
      )
    }

    const guildId = issuerMembership.guild.unwrap().id

    // Check if issuer is officer or leader
    const hasPermission = await permissionService.isOfficerOrLeader(guildId, allyCode)
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only officers and leaders can issue warnings" },
        { status: 403 }
      )
    }

    // Verify the target player is in the same guild
    const targetMembership = await guildMemberRepository.findOne(
      { player: playerId, guild: guildId, isActive: true }
    )

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Target player not found in guild" },
        { status: 404 }
      )
    }

    // Create the warning
    const warning = await warningRepository.createWarning(
      guildId,
      playerId,
      warningTypeId,
      note
    )

    return NextResponse.json({ warning }, { status: 201 })
  } catch (error) {
    console.error("Error creating warning:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
