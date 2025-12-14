import { Pool, QueryResult, QueryResultRow } from "pg"
import { Player } from "../model/player"
import { normalizeAllyCode } from "../utils/ally-code"

interface PlayerRow extends QueryResultRow {
  ally_code: string
  discord_id: string
  alt: number
  player_id: string | null
  player_name: string | null
  guild_id: string | null
  registered_at: Date | string
}

export class PlayerPGClient {
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

  private rowToPlayer(row: PlayerRow): Player {
    return {
      allyCode: row.ally_code,
      alt: row.alt,
      playerId: row.player_id ?? undefined,
      playerName: row.player_name ?? undefined,
      guildId: row.guild_id ?? undefined,
      registeredAt:
        typeof row.registered_at === "string"
          ? new Date(row.registered_at)
          : row.registered_at,
    }
  }

  /**
   * Get all players (ally codes) for a Discord user, ordered by alt number
   */
  public async getPlayersByDiscordId(discordId: string): Promise<Player[]> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return []
    }

    try {
      const result = await this.query<PlayerRow>(
        `SELECT ally_code, discord_id, alt, player_id, player_name, guild_id, registered_at
         FROM players
         WHERE discord_id = $1
         ORDER BY alt ASC`,
        [discordId],
      )

      return result.rows.map((row) => this.rowToPlayer(row))
    } catch (error) {
      console.error("Error getting players by discord ID:", error)
      return []
    }
  }

  /**
   * Get specific player by ally code
   */
  public async getPlayerByAllyCode(allyCode: string): Promise<Player | null> {
    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code")
      return null
    }

    try {
      const result = await this.query<PlayerRow>(
        `SELECT ally_code, discord_id, alt, player_id, player_name, guild_id, registered_at
         FROM players
         WHERE ally_code = $1`,
        [normalized],
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.rowToPlayer(result.rows[0]!)
    } catch (error) {
      console.error("Error getting player by ally code:", error)
      return null
    }
  }

  /**
   * Register a new ally code for a Discord user
   * @param isPrimary If true, replaces existing primary (alt=1). If false, adds as new alt.
   */
  public async registerAllyCode(
    discordId: string,
    allyCode: string,
    isPrimary: boolean,
  ): Promise<boolean> {
    if (!discordId || !allyCode) {
      console.error("Invalid discord ID or ally code")
      return false
    }

    try {
      if (isPrimary) {
        // Replace primary: delete old alt=1, insert new as alt=1
        await this.query(`DELETE FROM players WHERE discord_id = $1 AND alt = 1`, [
          discordId,
        ])

        await this.query(
          `INSERT INTO players (ally_code, discord_id, alt, registered_at)
           VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
          [allyCode, discordId],
        )
      } else {
        // Add as new alt: find next alt number
        const maxAltResult = await this.query<{ max_alt: number | null }>(
          `SELECT MAX(alt) as max_alt FROM players WHERE discord_id = $1`,
          [discordId],
        )

        const nextAlt = (maxAltResult.rows[0]?.max_alt ?? 0) + 1

        await this.query(
          `INSERT INTO players (ally_code, discord_id, alt, registered_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [allyCode, discordId, nextAlt],
        )
      }

      return true
    } catch (error) {
      console.error("Error registering ally code:", error)
      return false
    }
  }

  /**
   * Remove specific ally code
   */
  public async removeAllyCode(allyCode: string): Promise<boolean> {
    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code")
      return false
    }

    try {
      await this.query(`DELETE FROM players WHERE ally_code = $1`, [normalized])
      return true
    } catch (error) {
      console.error("Error removing ally code:", error)
      return false
    }
  }

  /**
   * Remove all players for a Discord user
   */
  public async removeAllForDiscordId(discordId: string): Promise<boolean> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return false
    }

    try {
      await this.query(`DELETE FROM players WHERE discord_id = $1`, [discordId])
      return true
    } catch (error) {
      console.error("Error removing all players for discord ID:", error)
      return false
    }
  }

  /**
   * Find Discord ID by ally code
   */
  public async findDiscordIdByAllyCode(
    allyCode: string,
  ): Promise<string | null> {
    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      return null
    }

    try {
      const result = await this.query<{ discord_id: string }>(
        `SELECT discord_id FROM players WHERE ally_code = $1`,
        [normalized],
      )

      return result.rows[0]?.discord_id ?? null
    } catch (error) {
      console.error("Error finding discord id by ally code:", error)
      return null
    }
  }

  /**
   * Get primary player (alt=1) for a Discord user
   * Returns null if no players exist for this user
   */
  public async getPrimaryPlayer(discordId: string): Promise<Player | null> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return null
    }

    try {
      const result = await this.query<PlayerRow>(
        `SELECT ally_code, discord_id, alt, player_id, player_name, guild_id, registered_at
         FROM players
         WHERE discord_id = $1 AND alt = 1`,
        [discordId],
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.rowToPlayer(result.rows[0]!)
    } catch (error) {
      console.error("Error getting primary player:", error)
      return null
    }
  }

  // Legacy compatibility methods

  /**
   * @deprecated Use getPlayersByDiscordId instead
   * Returns primary player for backward compatibility
   */
  public async getPlayer(discordId: string): Promise<Player | null> {
    return this.getPrimaryPlayer(discordId)
  }

  /**
   * @deprecated Use registerAllyCode instead
   * Legacy method for adding user - treats as primary
   */
  public async addUser(player: {
    discordUser: { id: string }
    allyCode: string
  }): Promise<boolean> {
    return this.registerAllyCode(player.discordUser.id, player.allyCode, true)
  }

  /**
   * @deprecated Use removeAllForDiscordId instead
   */
  public async removePlayer(player: { discordUser: { id: string } }): Promise<boolean> {
    return this.removeAllForDiscordId(player.discordUser.id)
  }
}
