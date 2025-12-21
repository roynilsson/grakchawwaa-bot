import { EntityRepository } from "@mikro-orm/postgresql"
import { Guild } from "../entities/Guild.entity"

export class GuildRepository extends EntityRepository<Guild> {
  async registerTicketCollectionChannel(
    guildId: string,
    channelId: string,
    nextRefreshTime: string,
    reminderChannelId?: string | null,
    guildName?: string,
  ): Promise<boolean> {
    if (!guildId || !channelId || !nextRefreshTime) {
      console.error("Invalid guild, channel ID, or refresh time")
      return false
    }

    try {
      let guild = await this.findOne({ id: guildId })

      // Convert Unix timestamp (seconds) to Date
      const refreshDate = new Date(parseInt(nextRefreshTime) * 1000)

      if (guild) {
        guild.ticketCollectionChannelId = channelId
        guild.nextTicketCollectionRefreshTime = refreshDate
        if (guildName) guild.name = guildName
        if (reminderChannelId !== undefined) {
          guild.ticketReminderChannelId = reminderChannelId ?? undefined
        }
      } else {
        guild = this.create({
          id: guildId,
          name: guildName,
          ticketCollectionChannelId: channelId,
          nextTicketCollectionRefreshTime: refreshDate,
          ticketReminderChannelId: reminderChannelId ?? undefined,
        })
        this.getEntityManager().persist(guild)
      }

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error registering ticket collection channel:", error)
      return false
    }
  }

  async registerAnniversaryChannel(
    guildId: string,
    channelId: string,
    guildName?: string,
  ): Promise<boolean> {
    if (!guildId || !channelId) {
      console.error("Invalid guild or channel ID")
      return false
    }

    try {
      let guild = await this.findOne({ id: guildId })

      if (guild) {
        guild.anniversaryChannelId = channelId
        if (guildName) guild.name = guildName
      } else {
        guild = this.create({
          id: guildId,
          name: guildName,
          anniversaryChannelId: channelId,
        })
        this.getEntityManager().persist(guild)
      }

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error registering anniversary channel:", error)
      return false
    }
  }

  async unregisterAnniversaryChannel(guildId: string): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      const guild = await this.findOne({ id: guildId })

      if (!guild) {
        return false
      }

      guild.anniversaryChannelId = undefined

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error unregistering anniversary channel:", error)
      return false
    }
  }

  async getAllGuilds(): Promise<Guild[]> {
    try {
      return await this.findAll()
    } catch (error) {
      console.error("Error getting all guild ticket collections:", error)
      return []
    }
  }

  async getGuild(
    guildId: string,
  ): Promise<Guild | null> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return null
    }

    try {
      return await this.findOne({ id: guildId })
    } catch (error) {
      console.error("Error getting guild message channels:", error)
      return null
    }
  }

  async unregisterTicketCollectionChannel(guildId: string): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      const guild = await this.findOne({ id: guildId })

      if (!guild) {
        return false
      }

      await this.getEntityManager().removeAndFlush(guild)
      return true
    } catch (error) {
      console.error("Error unregistering ticket collection channel:", error)
      return false
    }
  }
}
