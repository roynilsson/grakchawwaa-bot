import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember, PermissionService } from "@grakchawwaa/core"
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
    const permissionService = new PermissionService(em)

    // Find the player's guild
    const playerMembership = await guildMemberRepository.findOne(
      { player: allyCode, isActive: true },
      { populate: ["guild"] }
    )

    if (!playerMembership) {
      return NextResponse.json(
        { isOfficerOrLeader: false, isLeader: false, memberLevel: null },
        { status: 200 }
      )
    }

    const guildId = playerMembership.guild.unwrap().id

    // Get permissions
    const isOfficerOrLeader = await permissionService.isOfficerOrLeader(guildId, allyCode)
    const isLeader = await permissionService.isLeader(guildId, allyCode)
    const memberLevel = await permissionService.getMemberLevel(guildId, allyCode)

    return NextResponse.json({
      isOfficerOrLeader,
      isLeader,
      memberLevel,
    })
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
