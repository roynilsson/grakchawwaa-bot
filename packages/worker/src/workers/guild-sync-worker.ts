import { MikroORM, EntityRepository } from "@mikro-orm/core"
import { normalizeAllyCode, Guild, Player, GuildMember, CachedComlinkClient } from "@grakchawwaa/core"
import ComlinkStub from "@swgoh-utils/comlink"

export class GuildSyncWorker {
  private syncInterval: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL = 60 * 60 * 1000 // 1 hour

  constructor(
    private orm: MikroORM,
    private comlinkClient: InstanceType<typeof ComlinkStub>,
    private cachedComlinkClient: CachedComlinkClient,
  ) {}

  public start(): void {
    if (this.syncInterval) {
      console.log("Guild sync worker is already running")
      return
    }

    console.log("Starting guild sync worker (runs every hour)")

    // Run immediately on start
    this.syncAllGuilds().catch((error) => {
      console.error("Error in initial guild sync:", error)
    })

    // Then run every hour
    this.syncInterval = setInterval(() => {
      this.syncAllGuilds().catch((error) => {
        console.error("Error in scheduled guild sync:", error)
      })
    }, this.SYNC_INTERVAL)
  }

  public stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log("Guild sync worker stopped")
    }
  }

  private async syncAllGuilds(): Promise<void> {
    console.log("Starting guild sync...")

    try {
      const em = this.orm.em.fork()
      const guildRepository = em.getRepository(Guild)

      // Get all registered guilds from database
      const guilds = await guildRepository.findAll()

      if (guilds.length === 0) {
        console.log("No guilds to sync")
        return
      }

      console.log(`Syncing ${guilds.length} guild(s)...`)

      for (const guild of guilds) {
        await this.syncGuild(em, guild.id, guild.name || "Unknown Guild")
      }

      console.log("Guild sync completed")
    } catch (error) {
      console.error("Error syncing guilds:", error)
    }
  }

  private async syncGuild(em: any, guildId: string, guildName: string): Promise<void> {
    try {
      console.log(`Syncing guild: ${guildName} (${guildId})`)

      // Fetch guild data from Comlink
      const guildData = await this.cachedComlinkClient.getGuild(
        guildId,
        false, // Don't need activity info for sync
      )

      if (!guildData?.guild?.member) {
        console.warn(`No member data found for guild ${guildId}`)
        return
      }

      // Update guild name if it changed
      const guildRepository = em.getRepository(Guild)
      const dbGuild = await guildRepository.findOne({ id: guildId })
      if (dbGuild && guildData.guild.profile?.name) {
        const newName = guildData.guild.profile.name
        if (dbGuild.name !== newName) {
          dbGuild.name = newName
          await em.persistAndFlush(dbGuild)
          console.log(`Updated guild name: ${newName}`)
        }
      }

      // Sync players: ensure all guild members exist in players table
      let playersCreated = 0
      let playersUpdated = 0
      const memberDataList: Array<{ allyCode: string; joinedAt: Date }> = []

      const playerRepository = em.getRepository(Player)

      for (const member of guildData.guild.member) {
        try {
          // Fetch full player data to get ally code
          const playerData = await this.comlinkClient.getPlayer(
            undefined,
            member.playerId,
          )

          if (!playerData?.allyCode) {
            console.warn(`No ally code found for player ${member.playerName}`)
            continue
          }

          const allyCode = normalizeAllyCode(playerData.allyCode.toString())
          if (!allyCode) {
            console.warn(`Invalid ally code for player ${member.playerName}`)
            continue
          }

          // Upsert player into database
          const existing = await playerRepository.findOne({ allyCode })
          const isNew = !existing

          if (existing) {
            // Update existing player
            existing.name = member.playerName
            existing.playerId = member.playerId
            await em.persistAndFlush(existing)
            playersUpdated++
          } else {
            // Create new player (without discord_id)
            const newPlayer = playerRepository.create({
              allyCode,
              name: member.playerName,
              playerId: member.playerId,
              isMain: false,
              registeredAt: new Date(),
            })
            await em.persistAndFlush(newPlayer)
            playersCreated++
          }

          // Store for guild member sync
          const joinedAt = member.guildJoinTime
            ? new Date(parseInt(member.guildJoinTime) * 1000)
            : new Date()

          memberDataList.push({ allyCode, joinedAt })
        } catch (error) {
          console.warn(
            `Error fetching player ${member.playerName} (${member.playerId}):`,
            error,
          )
        }
      }

      // Sync guild members: add/remove/reactivate
      const guildMemberRepository = em.getRepository(GuildMember)
      const memberStats = await this.syncMembers(
        em,
        guildMemberRepository,
        playerRepository,
        guildId,
        memberDataList,
      )

      console.log(
        `Guild sync complete for ${guildName}: ` +
        `Players (${playersCreated} created, ${playersUpdated} updated), ` +
        `Members (${memberStats.added} added, ${memberStats.removed} removed, ${memberStats.reactivated} reactivated)`,
      )
    } catch (error) {
      console.error(`Error syncing guild ${guildId}:`, error)
    }
  }

  private async syncMembers(
    em: any,
    guildMemberRepository: EntityRepository<GuildMember>,
    playerRepository: EntityRepository<Player>,
    guildId: string,
    comlinkMembers: Array<{ allyCode: string; joinedAt: Date }>,
  ): Promise<{ added: number; removed: number; reactivated: number }> {
    const stats = { added: 0, removed: 0, reactivated: 0 }

    // Get current active members from database
    const currentMembers = await guildMemberRepository.find({
      guild: guildId,
      isActive: true,
    })

    const currentAllyCodes = new Set(
      currentMembers.map((m: GuildMember) => m.player.unwrap().allyCode),
    )
    const comlinkAllyCodes = new Set(
      comlinkMembers.map((m) => m.allyCode),
    )

    // Find members to add (in Comlink but not in DB or previously left)
    for (const comlinkMember of comlinkMembers) {
      if (!currentAllyCodes.has(comlinkMember.allyCode)) {
        // Check if this member previously left
        const previousMembership = await guildMemberRepository.findOne({
          guild: guildId,
          player: { allyCode: comlinkMember.allyCode },
          isActive: false,
        })

        if (previousMembership) {
          // Reactivate
          previousMembership.isActive = true
          previousMembership.leftAt = undefined
          previousMembership.joinedAt = comlinkMember.joinedAt
          await em.persistAndFlush(previousMembership)
          stats.reactivated++
        } else {
          // Add new member
          const player = await playerRepository.findOne({
            allyCode: comlinkMember.allyCode,
          })
          if (player) {
            const newMember = guildMemberRepository.create({
              guild: guildId,
              player: player,
              joinedAt: comlinkMember.joinedAt,
              isActive: true,
            })
            await em.persistAndFlush(newMember)
            stats.added++
          }
        }
      }
    }

    // Find members to remove (in DB but not in Comlink)
    for (const currentMember of currentMembers) {
      const allyCode = currentMember.player.unwrap().allyCode
      if (!comlinkAllyCodes.has(allyCode)) {
        currentMember.isActive = false
        currentMember.leftAt = new Date()
        await em.persistAndFlush(currentMember)
        stats.removed++
      }
    }

    return stats
  }
}
