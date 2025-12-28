import { container } from "@sapphire/pieces"
import { normalizeAllyCode } from "@grakchawwaa/core"

export class GuildSyncService {
  private static instance: GuildSyncService
  private syncInterval: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL = 60 * 60 * 1000 // 1 hour

  private constructor() {}

  public static getInstance(): GuildSyncService {
    if (!GuildSyncService.instance) {
      GuildSyncService.instance = new GuildSyncService()
    }
    return GuildSyncService.instance
  }

  public start(): void {
    if (this.syncInterval) {
      console.log("Guild sync service is already running")
      return
    }

    console.log("Starting guild sync service (runs every hour)")

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
      console.log("Guild sync service stopped")
    }
  }

  private async syncAllGuilds(): Promise<void> {
    console.log("Starting guild sync...")

    try {
      // Get all registered guilds from database
      const guilds = await container.guildRepository.find({})

      if (guilds.length === 0) {
        console.log("No guilds to sync")
        return
      }

      console.log(`Syncing ${guilds.length} guild(s)...`)

      for (const guild of guilds) {
        await this.syncGuild(guild.id, guild.name || "Unknown Guild")
      }

      console.log("Guild sync completed")
    } catch (error) {
      console.error("Error syncing guilds:", error)
    }
  }

  private async syncGuild(guildId: string, guildName: string): Promise<void> {
    try {
      console.log(`Syncing guild: ${guildName} (${guildId})`)

      // Fetch guild data from Comlink
      const guildData = await container.cachedComlinkClient.getGuild(
        guildId,
        false, // Don't need activity info for sync
      )

      if (!guildData?.guild?.member) {
        console.warn(`No member data found for guild ${guildId}`)
        return
      }

      // Update guild name if it changed
      const dbGuild = await container.guildRepository.findOne({ id: guildId })
      if (dbGuild && guildData.guild.profile?.name) {
        const newName = guildData.guild.profile.name
        if (dbGuild.name !== newName) {
          await container.guildService.updateGuildName(guildId, newName)
          console.log(`Updated guild name: ${newName}`)
        }
      }

      // Sync players: ensure all guild members exist in players table
      // We need to fetch each player's full data to get their ally code
      let playersCreated = 0
      let playersUpdated = 0
      const memberDataList: Array<{ allyCode: string; joinedAt: Date; memberLevel: number }> = []

      for (const member of guildData.guild.member) {
        try {
          // Fetch full player data to get ally code
          const playerData = await container.comlinkClient.getPlayer(
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
          const existing = await container.playerRepository.findOne({
            allyCode,
          })
          const isNew = !existing

          await container.playerService.upsertPlayerFromComlink(
            allyCode,
            member.playerName,
            member.playerId,
          )

          if (isNew) {
            playersCreated++
          } else {
            playersUpdated++
          }

          // Store for guild member sync
          const joinedAt = member.guildJoinTime
            ? new Date(parseInt(member.guildJoinTime) * 1000)
            : new Date()

          memberDataList.push({
            allyCode,
            joinedAt,
            memberLevel: member.memberLevel || 2, // Default to regular member if missing
          })
        } catch (error) {
          console.warn(
            `Error fetching player ${member.playerName} (${member.playerId}):`,
            error,
          )
        }
      }

      // Sync guild members: add/remove/reactivate
      const comlinkMembers = memberDataList

      const memberStats = await container.guildMemberService.syncMembers(
        guildId,
        comlinkMembers,
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
}
