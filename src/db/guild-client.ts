import { Pool, QueryResult, QueryResultRow } from "pg"

interface GuildRow extends QueryResultRow {
  guild_id: string
  guild_name: string | null
  discord_server_id: string | null
  created_at: Date
  updated_at: Date
}

export interface Guild {
  guildId: string
  guildName?: string
  discordServerId?: string
  createdAt: Date
  updatedAt: Date
}

export class GuildPGClient {
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
