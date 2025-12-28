import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { GuildMember } from "@grakchawwaa/core"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const allyCode = searchParams.get("allyCode")
    const includeFormer = searchParams.get("includeFormer") === "true"

    if (!allyCode) {
      return NextResponse.json(
        { error: "Ally code required" },
        { status: 400 }
      )
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const guildMemberRepository = em.getRepository(GuildMember)

    // First, find the player's guild
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

    // Get all members of the guild
    const filter: any = { guild: guildId }
    if (!includeFormer) {
      filter.isActive = true
    }

    const members = await guildMemberRepository.find(filter, {
      populate: ["player"],
      orderBy: { joinedAt: "ASC" },
    })

    return NextResponse.json({
      guildId,
      guildName: playerMembership.guild.unwrap().name,
      members: members.map((m) => {
        const player = m.player.unwrap()
        return {
          allyCode: player.allyCode,
          name: player.name,
          joinedAt: m.joinedAt.toISOString(),
          leftAt: m.leftAt?.toISOString() || null,
          isActive: m.isActive,
        }
      }),
    })
  } catch (error) {
    console.error("Error fetching guild members:", error)
    return NextResponse.json(
      { error: "Failed to fetch guild members" },
      { status: 500 }
    )
  }
}
