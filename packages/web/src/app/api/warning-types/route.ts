import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, WarningType, PermissionService } from "@grakchawwaa/core"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const allyCode = searchParams.get("allyCode")

    if (!allyCode) {
      return NextResponse.json(
        { error: "Ally code required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)
    const warningTypeRepository = em.getRepository(WarningType)
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

    // Check if user is officer or leader
    const hasPermission = await permissionService.isOfficerOrLeader(guildId, allyCode)
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only officers and leaders can view warning types" },
        { status: 403 }
      )
    }

    // Get all warning types for the guild
    const warningTypes = await warningTypeRepository.getGuildWarningTypes(guildId)

    return NextResponse.json({ warningTypes })
  } catch (error) {
    console.error("Error fetching warning types:", error)
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
    const { allyCode, name, severity } = body

    if (!allyCode || !name || severity === undefined) {
      return NextResponse.json(
        { error: "Ally code, name, and severity required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)
    const warningTypeRepository = em.getRepository(WarningType)
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

    // Check if user is officer or leader
    const hasPermission = await permissionService.isOfficerOrLeader(guildId, allyCode)
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only officers and leaders can create warning types" },
        { status: 403 }
      )
    }

    // Create the warning type
    const warningType = await warningTypeRepository.createWarningType(
      guildId,
      name,
      severity
    )

    return NextResponse.json({ warningType }, { status: 201 })
  } catch (error) {
    console.error("Error creating warning type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
