import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, WarningType, PermissionService } from "@grakchawwaa/core"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { allyCode, name, severity } = body
    const id = parseInt(params.id)

    if (!allyCode || isNaN(id)) {
      return NextResponse.json(
        { error: "Valid ally code and warning type ID required" },
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
        { error: "Only officers and leaders can update warning types" },
        { status: 403 }
      )
    }

    // Verify the warning type belongs to the guild
    const existingWarningType = await warningTypeRepository.findOne({ id })
    if (!existingWarningType || existingWarningType.guild.id !== guildId) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      )
    }

    // Update the warning type
    const warningType = await warningTypeRepository.updateWarningType(id, {
      name,
      severity,
    })

    if (!warningType) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ warningType })
  } catch (error) {
    console.error("Error updating warning type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const allyCode = searchParams.get("allyCode")
    const id = parseInt(params.id)

    if (!allyCode || isNaN(id)) {
      return NextResponse.json(
        { error: "Valid ally code and warning type ID required" },
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
        { error: "Only officers and leaders can delete warning types" },
        { status: 403 }
      )
    }

    // Verify the warning type belongs to the guild
    const existingWarningType = await warningTypeRepository.findOne({ id })
    if (!existingWarningType || existingWarningType.guild.id !== guildId) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      )
    }

    // Delete the warning type
    const deleted = await warningTypeRepository.deleteWarningType(id)

    if (!deleted) {
      return NextResponse.json(
        { error: "Warning type not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting warning type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
