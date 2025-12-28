import { auth } from "@/lib/auth"
import { getORM } from "@/lib/db"
import { Player } from "@grakchawwaa/core"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orm = await getORM()
    const em = orm.em.fork()
    const playerRepository = em.getRepository(Player)

    // Get all players for this Discord user
    const players = await playerRepository.find(
      { discordId: session.user.discordId },
      { orderBy: { isMain: "DESC", allyCode: "ASC" } }
    )

    return NextResponse.json({
      players: players.map((p) => ({
        allyCode: p.allyCode,
        name: p.name,
        isMain: p.isMain,
      })),
    })
  } catch (error) {
    console.error("Error fetching players:", error)
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    )
  }
}
