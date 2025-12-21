import { EntityManager } from "@mikro-orm/postgresql"
import { Guild } from "@grakchawwaa/core"

/**
 * GuildService - Business logic for guild management
 * Repositories should only contain minimal CRUD operations
 */
export class GuildService {
  private readonly em: EntityManager

  constructor(em: EntityManager) {
    this.em = em
  }

  private get guildRepository() {
    return this.em.getRepository(Guild)
  }

  /**
   * Register or update ticket collection channel for a guild
   */
  async registerTicketCollectionChannel(
    guildId: string,
    channelId: string,
    nextRefreshTime: string,
    reminderChannelId?: string | null,
    guildName?: string,
  ): Promise<void> {
    if (!guildId || !channelId || !nextRefreshTime) {
      throw new Error("Invalid guild, channel ID, or refresh time")
    }

    // Convert Unix timestamp (seconds) to Date
    const refreshDate = new Date(parseInt(nextRefreshTime) * 1000)

    let guild = await this.guildRepository.findOne({ id: guildId })

    if (guild) {
      guild.ticketCollectionChannelId = channelId
      guild.nextTicketCollectionRefreshTime = refreshDate
      if (guildName) guild.name = guildName
      if (reminderChannelId !== undefined) {
        guild.ticketReminderChannelId = reminderChannelId ?? undefined
      }
    } else {
      guild = this.guildRepository.create({
        id: guildId,
        name: guildName,
        ticketCollectionChannelId: channelId,
        nextTicketCollectionRefreshTime: refreshDate,
        ticketReminderChannelId: reminderChannelId ?? undefined,
      })
      this.em.persist(guild)
    }

    await this.em.flush()
  }

  /**
   * Register or update anniversary channel for a guild
   */
  async registerAnniversaryChannel(
    guildId: string,
    channelId: string,
    guildName?: string,
  ): Promise<void> {
    if (!guildId || !channelId) {
      throw new Error("Invalid guild or channel ID")
    }

    let guild = await this.guildRepository.findOne({ id: guildId })

    if (guild) {
      guild.anniversaryChannelId = channelId
      if (guildName) guild.name = guildName
    } else {
      guild = this.guildRepository.create({
        id: guildId,
        name: guildName,
        anniversaryChannelId: channelId,
      })
      this.em.persist(guild)
    }

    await this.em.flush()
  }

  /**
   * Unregister anniversary channel for a guild
   */
  async unregisterAnniversaryChannel(guildId: string): Promise<boolean> {
    if (!guildId) {
      throw new Error("Invalid guild ID")
    }

    const guild = await this.guildRepository.findOne({ id: guildId })
    if (!guild) {
      return false
    }

    guild.anniversaryChannelId = undefined
    await this.em.flush()
    return true
  }

  /**
   * Unregister ticket collection channel for a guild
   * This removes the entire guild record
   */
  async unregisterTicketCollectionChannel(guildId: string): Promise<boolean> {
    if (!guildId) {
      throw new Error("Invalid guild ID")
    }

    const guild = await this.guildRepository.findOne({ id: guildId })
    if (!guild) {
      return false
    }

    await this.em.removeAndFlush(guild)
    return true
  }

  /**
   * Get all guilds
   */
  async getAllGuilds(): Promise<Guild[]> {
    return this.guildRepository.findAll()
  }

  /**
   * Get a specific guild by ID
   */
  async getGuild(guildId: string): Promise<Guild | null> {
    if (!guildId) {
      throw new Error("Invalid guild ID")
    }

    return this.guildRepository.findOne({ id: guildId })
  }

  /**
   * Update guild name
   */
  async updateGuildName(guildId: string, name: string): Promise<void> {
    const guild = await this.guildRepository.findOne({ id: guildId })
    if (!guild) {
      throw new Error(`Guild not found: ${guildId}`)
    }

    guild.name = name
    await this.em.flush()
  }
}
