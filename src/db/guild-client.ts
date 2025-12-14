import { QueryResultRow } from "pg"
import { Guild } from "../model/guild"
import { BasePGClient } from "./base-pg-client"

interface GuildRow extends QueryResultRow {
  guild_id: string
  guild_name: string | null
  discord_server_id: string | null
  created_at: Date
  updated_at: Date
}

export class GuildPGClient extends BasePGClient {

  /**
   * Ensure a guild exists in the guilds table
   * Creates if it doesn't exist, does nothing if it already exists
   */
  public async ensureGuildExists(
    guildId: string,
    guildName?: string,
  ): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      await this.query(
        `INSERT INTO guilds (guild_id, guild_name)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE
         SET guild_name = COALESCE(EXCLUDED.guild_name, guilds.guild_name),
             updated_at = CURRENT_TIMESTAMP`,
        [guildId, guildName],
      )
      return true
    } catch (error) {
      console.error("Error ensuring guild exists:", error)
      return false
    }
  }

  /**
   * Get guild by ID
   */
  public async getGuild(guildId: string): Promise<Guild | null> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return null
    }

    try {
      const result = await this.query<GuildRow>(
        `SELECT guild_id, guild_name, discord_server_id, created_at, updated_at
         FROM guilds
         WHERE guild_id = $1`,
        [guildId],
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]!
      return {
        guildId: row.guild_id,
        guildName: row.guild_name || undefined,
        discordServerId: row.discord_server_id || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    } catch (error) {
      console.error("Error getting guild:", error)
      return null
    }
  }
}
