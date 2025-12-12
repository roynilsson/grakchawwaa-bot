import { Pool, QueryResult, QueryResultRow } from "pg"

export interface WarningTypeRow extends QueryResultRow {
  id: number
  guild_id: string
  name: string
  label: string
  weight: number
  created_at: Date
  updated_at: Date
}

export interface CreateWarningTypeParams {
  guildId: string
  name: string
  label: string
  weight: number
}

export interface UpdateWarningTypeParams {
  id: number
  label?: string
  weight?: number
}

const QUERIES = {
  CREATE_WARNING_TYPE: `
    INSERT INTO warningTypes (guild_id, name, label, weight)
    VALUES ($1, $2, $3, $4)
    RETURNING id, guild_id, name, label, weight, created_at, updated_at;
  `,
  GET_WARNING_TYPE_BY_ID: `
    SELECT id, guild_id, name, label, weight, created_at, updated_at
    FROM warningTypes
    WHERE id = $1;
  `,
  GET_WARNING_TYPE_BY_NAME: `
    SELECT id, guild_id, name, label, weight, created_at, updated_at
    FROM warningTypes
    WHERE guild_id = $1 AND name = $2;
  `,
  LIST_WARNING_TYPES: `
    SELECT id, guild_id, name, label, weight, created_at, updated_at
    FROM warningTypes
    WHERE guild_id = $1
    ORDER BY weight DESC, name ASC;
  `,
  UPDATE_WARNING_TYPE: `
    UPDATE warningTypes
    SET label = COALESCE($2, label),
        weight = COALESCE($3, weight),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, guild_id, name, label, weight, created_at, updated_at;
  `,
  DELETE_WARNING_TYPE: `
    DELETE FROM warningTypes
    WHERE id = $1;
  `,
} as const

export class WarningTypePGClient {
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

  public async createWarningType(
    params: CreateWarningTypeParams,
  ): Promise<WarningTypeRow | null> {
    if (!params.guildId || !params.name || !params.label) {
      console.error("Invalid warning type parameters")
      return null
    }

    try {
      const result = await this.query<WarningTypeRow>(
        QUERIES.CREATE_WARNING_TYPE,
        [params.guildId, params.name, params.label, params.weight],
      )
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error creating warning type:", error)
      return null
    }
  }

  public async getWarningTypeById(id: number): Promise<WarningTypeRow | null> {
    if (!id) {
      console.error("Invalid warning type ID")
      return null
    }

    try {
      const result = await this.query<WarningTypeRow>(
        QUERIES.GET_WARNING_TYPE_BY_ID,
        [id],
      )
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error getting warning type by ID:", error)
      return null
    }
  }

  public async getWarningTypeByName(
    guildId: string,
    name: string,
  ): Promise<WarningTypeRow | null> {
    if (!guildId || !name) {
      console.error("Invalid guild ID or warning type name")
      return null
    }

    try {
      const result = await this.query<WarningTypeRow>(
        QUERIES.GET_WARNING_TYPE_BY_NAME,
        [guildId, name],
      )
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error getting warning type by name:", error)
      return null
    }
  }

  public async listWarningTypes(guildId: string): Promise<WarningTypeRow[]> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return []
    }

    try {
      const result = await this.query<WarningTypeRow>(
        QUERIES.LIST_WARNING_TYPES,
        [guildId],
      )
      return result.rows
    } catch (error) {
      console.error("Error listing warning types:", error)
      return []
    }
  }

  public async updateWarningType(
    params: UpdateWarningTypeParams,
  ): Promise<WarningTypeRow | null> {
    if (!params.id || (!params.label && params.weight === undefined)) {
      console.error("Invalid update parameters")
      return null
    }

    try {
      const result = await this.query<WarningTypeRow>(
        QUERIES.UPDATE_WARNING_TYPE,
        [params.id, params.label ?? null, params.weight ?? null],
      )
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error updating warning type:", error)
      return null
    }
  }

  public async deleteWarningType(id: number): Promise<boolean> {
    if (!id) {
      console.error("Invalid warning type ID")
      return false
    }

    try {
      await this.query(QUERIES.DELETE_WARNING_TYPE, [id])
      return true
    } catch (error) {
      console.error("Error deleting warning type:", error)
      return false
    }
  }
}
