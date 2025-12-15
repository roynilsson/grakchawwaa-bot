import { BasePGClient } from "./base-pg-client"
import { QueryResultRow } from "pg"

interface GuildConfigRow extends QueryResultRow {
  guild_id: string
  name: string
  value: string
}

/**
 * Generic guild configuration client
 * Manages key-value pairs in the guild_configs table
 */
export class GuildConfigPGClient extends BasePGClient {
  /**
   * Set a configuration value for a guild
   * Creates or updates the config key-value pair
   */
  public async setConfig(
    guildId: string,
    key: string,
    value: string,
  ): Promise<boolean> {
    if (!guildId || !key || !value) {
      console.error("Invalid guild ID, key, or value")
      return false
    }

    try {
      await this.query(
        `INSERT INTO guild_configs (guild_id, name, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, name) DO UPDATE
         SET value = EXCLUDED.value`,
        [guildId, key, value],
      )
      return true
    } catch (error) {
      console.error(`Error setting config ${key} for guild ${guildId}:`, error)
      return false
    }
  }

  /**
   * Get a configuration value for a guild
   * Returns null if the config key doesn't exist
   */
  public async getConfig(guildId: string, key: string): Promise<string | null> {
    if (!guildId || !key) {
      console.error("Invalid guild ID or key")
      return null
    }

    try {
      const result = await this.query<GuildConfigRow>(
        `SELECT value FROM guild_configs WHERE guild_id = $1 AND name = $2`,
        [guildId, key],
      )

      return result.rows[0]?.value ?? null
    } catch (error) {
      console.error(`Error getting config ${key} for guild ${guildId}:`, error)
      return null
    }
  }

  /**
   * Get all configuration key-value pairs for a guild
   * Returns a Map of config key -> value
   */
  public async getAllConfigs(guildId: string): Promise<Map<string, string>> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return new Map()
    }

    try {
      const result = await this.query<GuildConfigRow>(
        `SELECT name, value FROM guild_configs WHERE guild_id = $1`,
        [guildId],
      )

      const configMap = new Map<string, string>()
      for (const row of result.rows) {
        configMap.set(row.name, row.value)
      }
      return configMap
    } catch (error) {
      console.error(`Error getting all configs for guild ${guildId}:`, error)
      return new Map()
    }
  }

  /**
   * Delete a specific configuration key for a guild
   */
  public async deleteConfig(guildId: string, key: string): Promise<boolean> {
    if (!guildId || !key) {
      console.error("Invalid guild ID or key")
      return false
    }

    try {
      await this.query(
        `DELETE FROM guild_configs WHERE guild_id = $1 AND name = $2`,
        [guildId, key],
      )
      return true
    } catch (error) {
      console.error(`Error deleting config ${key} for guild ${guildId}:`, error)
      return false
    }
  }

  /**
   * Delete all configuration keys for a guild
   */
  public async deleteAllConfigs(guildId: string): Promise<boolean> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return false
    }

    try {
      await this.query(`DELETE FROM guild_configs WHERE guild_id = $1`, [
        guildId,
      ])
      return true
    } catch (error) {
      console.error(`Error deleting all configs for guild ${guildId}:`, error)
      return false
    }
  }

  /**
   * Get all guild IDs that have at least one config
   */
  public async getAllGuildIds(): Promise<string[]> {
    try {
      const result = await this.query<{ guild_id: string }>(
        `SELECT DISTINCT guild_id FROM guild_configs ORDER BY guild_id`,
      )
      return result.rows.map((row) => row.guild_id)
    } catch (error) {
      console.error("Error getting all guild IDs:", error)
      return []
    }
  }
}
