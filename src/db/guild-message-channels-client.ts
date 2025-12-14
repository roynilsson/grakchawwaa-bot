import { Pool, QueryResult, QueryResultRow } from "pg"

interface TicketChannelRow extends QueryResultRow {
  guild_id: string
  ticket_collection_channel_id: string | null
  next_ticket_collection_refresh_time: string | null
  ticket_reminder_channel_id: string | null
  anniversary_channel_id: string | null
}

interface GuildConfigRow extends QueryResultRow {
  guild_id: string
  name: string
  value: string
}

const CONFIG_KEYS = {
  TICKET_COLLECTION_CHANNEL: "ticket_collection_channel_id",
  NEXT_REFRESH_TIME: "next_ticket_collection_refresh_time",
  TICKET_REMINDER_CHANNEL: "ticket_reminder_channel_id",
  ANNIVERSARY_CHANNEL: "anniversary_channel_id",
} as const

export class GuildMessageChannelsClient {
  private pool: Pool

  constructor() {
    const isProduction = process.env.NODE_ENV === "production"
    const connectionConfig = isProduction
      ? {
          connectionString: process.env.PG_DATABASE_URL,
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {
          user: process.env.PGUSER,
          host: process.env.PGHOST,
          database: process.env.PGDATABASE,
          password: process.env.PGPASSWORD,
          port: parseInt(process.env.PGPORT || "5432", 10),
        }

    this.pool = new Pool(connectionConfig)

    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err)
    })
  }

  public async disconnect(): Promise<void> {
    await this.pool.end()
  }

  private async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect()
    try {
      return await client.query<T>(text, params)
    } finally {
      client.release()
    }
  }

  private async setConfig(
    guildId: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.query(
      `INSERT INTO guild_configs (guild_id, name, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, name) DO UPDATE
       SET value = EXCLUDED.value`,
      [guildId, key, value],
    )
  }

  private async deleteConfig(guildId: string, key: string): Promise<void> {
    await this.query(
      `DELETE FROM guild_configs WHERE guild_id = $1 AND name = $2`,
      [guildId, key],
    )
  }

  private async getGuildConfigs(guildId: string): Promise<Map<string, string>> {
    const result = await this.query<GuildConfigRow>(
      `SELECT name, value FROM guild_configs WHERE guild_id = $1`,
      [guildId],
    )

    const configMap = new Map<string, string>()
    for (const row of result.rows) {
      configMap.set(row.name, row.value)
    }
    return configMap
  }

  public async registerTicketCollectionChannel(
    guildId: string,
    channelId: string,
    nextRefreshTime: string,
    reminderChannelId?: string | null,
  ): Promise<boolean> {
    if (!guildId || !channelId || !nextRefreshTime) {
      console.error("Invalid guild, channel ID, or refresh time")
      return false
    }

    try {
      // Ensure guild exists in guilds table
      await this.query(
        `INSERT INTO guilds (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
        [guildId],
      )

      // Set ticket collection channel
      await this.setConfig(
        guildId,
        CONFIG_KEYS.TICKET_COLLECTION_CHANNEL,
        channelId,
      )

      // Set next refresh time
      await this.setConfig(
        guildId,
        CONFIG_KEYS.NEXT_REFRESH_TIME,
        nextRefreshTime,
      )

      // Set reminder channel if provided, otherwise preserve existing value
      if (reminderChannelId) {
        await this.setConfig(
          guildId,
          CONFIG_KEYS.TICKET_REMINDER_CHANNEL,
          reminderChannelId,
        )
      }

      return true
    } catch (error) {
      console.error("Error registering ticket collection channel:", error)
      return false
    }
  }

  public async registerAnniversaryChannel(
    guildId: string,
    channelId: string,
  ): Promise<boolean> {
    if (!guildId || !channelId) {
      console.error("Invalid guild or channel ID")
      return false
    }

    try {
      // Ensure guild exists
      await this.query(
        `INSERT INTO guilds (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
        [guildId],
      )

      await this.setConfig(guildId, CONFIG_KEYS.ANNIVERSARY_CHANNEL, channelId)
      return true
    } catch (error) {
      console.error("Error registering anniversary channel:", error)
      return false
    }
  }

  public async unregisterAnniversaryChannel(guildId: string): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      await this.deleteConfig(guildId, CONFIG_KEYS.ANNIVERSARY_CHANNEL)
      return true
    } catch (error) {
      console.error("Error unregistering anniversary channel:", error)
      return false
    }
  }

  public async getAllGuilds(): Promise<TicketChannelRow[]> {
    try {
      // Get all unique guild IDs from guild_configs
      const guildsResult = await this.query<{ guild_id: string }>(
        `SELECT DISTINCT guild_id FROM guild_configs`,
      )

      const guilds: TicketChannelRow[] = []
      for (const row of guildsResult.rows) {
        const config = await this.getGuildConfigs(row.guild_id)
        guilds.push({
          guild_id: row.guild_id,
          ticket_collection_channel_id:
            config.get(CONFIG_KEYS.TICKET_COLLECTION_CHANNEL) || null,
          next_ticket_collection_refresh_time:
            config.get(CONFIG_KEYS.NEXT_REFRESH_TIME) || null,
          ticket_reminder_channel_id:
            config.get(CONFIG_KEYS.TICKET_REMINDER_CHANNEL) || null,
          anniversary_channel_id:
            config.get(CONFIG_KEYS.ANNIVERSARY_CHANNEL) || null,
        })
      }

      return guilds
    } catch (error) {
      console.error("Error getting all guild ticket collections:", error)
      return []
    }
  }

  public async getGuildMessageChannels(
    guildId: string,
  ): Promise<TicketChannelRow | null> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return null
    }

    try {
      const config = await this.getGuildConfigs(guildId)

      // If no config exists, return null
      if (config.size === 0) {
        return null
      }

      return {
        guild_id: guildId,
        ticket_collection_channel_id:
          config.get(CONFIG_KEYS.TICKET_COLLECTION_CHANNEL) || null,
        next_ticket_collection_refresh_time:
          config.get(CONFIG_KEYS.NEXT_REFRESH_TIME) || null,
        ticket_reminder_channel_id:
          config.get(CONFIG_KEYS.TICKET_REMINDER_CHANNEL) || null,
        anniversary_channel_id:
          config.get(CONFIG_KEYS.ANNIVERSARY_CHANNEL) || null,
      }
    } catch (error) {
      console.error("Error getting guild message channels:", error)
      return null
    }
  }

  public async unregisterTicketCollectionChannel(
    guildId: string,
  ): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      // Delete all configs for this guild
      await this.query(`DELETE FROM guild_configs WHERE guild_id = $1`, [
        guildId,
      ])
      // Also delete from guilds table if no configs remain
      await this.query(
        `DELETE FROM guilds
         WHERE guild_id = $1
         AND NOT EXISTS (SELECT 1 FROM guild_configs WHERE guild_id = $1)`,
        [guildId],
      )
      return true
    } catch (error) {
      console.error("Error unregistering ticket collection channel:", error)
      return false
    }
  }
}
