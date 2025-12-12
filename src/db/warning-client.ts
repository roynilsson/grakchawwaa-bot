import { Pool, QueryResult, QueryResultRow } from "pg"

export interface WarningRow extends QueryResultRow {
  id: number
  guild_id: string
  ally_code: string
  warning_type_id: number
  notes: string | null
  created_at: Date
  created_by: string | null
}

export interface WarningWithTypeRow extends WarningRow {
  type_name: string
  type_label: string
  weight: number
}

export interface CreateWarningParams {
  guildId: string
  allyCode: string
  warningTypeId: number
  notes?: string
  createdBy?: string
}

export interface ListWarningsParams {
  guildId: string
  allyCode?: string
  days?: number
  limit?: number
}

export interface WarningStats {
  ally_code: string
  player_name: string | null
  warning_count: number
  total_weight: number
  warnings: WarningWithTypeRow[]
}

const QUERIES = {
  CREATE_WARNING: `
    INSERT INTO warnings (guild_id, ally_code, warning_type_id, notes, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, guild_id, ally_code, warning_type_id, notes, created_at, created_by;
  `,
  GET_WARNING_BY_ID: `
    SELECT w.id, w.guild_id, w.ally_code, w.warning_type_id, w.notes, w.created_at, w.created_by,
           wt.name as type_name, wt.label as type_label, wt.weight
    FROM warnings w
    JOIN warningTypes wt ON w.warning_type_id = wt.id
    WHERE w.id = $1;
  `,
  LIST_WARNINGS_BASE: `
    SELECT w.id, w.guild_id, w.ally_code, w.warning_type_id, w.notes, w.created_at, w.created_by,
           wt.name as type_name, wt.label as type_label, wt.weight
    FROM warnings w
    JOIN warningTypes wt ON w.warning_type_id = wt.id
    WHERE w.guild_id = $1
  `,
  DELETE_WARNING: `
    DELETE FROM warnings
    WHERE id = $1
    RETURNING id;
  `,
  GET_PLAYER_WARNING_COUNT: `
    SELECT ally_code, COUNT(*) as warning_count, SUM(wt.weight) as total_weight
    FROM warnings w
    JOIN warningTypes wt ON w.warning_type_id = wt.id
    WHERE w.guild_id = $1
      AND w.created_at >= NOW() - INTERVAL '$2 days'
    GROUP BY ally_code
    ORDER BY total_weight DESC, warning_count DESC;
  `,
} as const

export class WarningPGClient {
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

  public async createWarning(
    params: CreateWarningParams,
  ): Promise<WarningRow | null> {
    if (!params.guildId || !params.allyCode || !params.warningTypeId) {
      console.error("Invalid warning parameters")
      return null
    }

    try {
      const result = await this.query<WarningRow>(QUERIES.CREATE_WARNING, [
        params.guildId,
        params.allyCode,
        params.warningTypeId,
        params.notes ?? null,
        params.createdBy ?? null,
      ])
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error creating warning:", error)
      return null
    }
  }

  public async getWarningById(id: number): Promise<WarningWithTypeRow | null> {
    if (!id) {
      console.error("Invalid warning ID")
      return null
    }

    try {
      const result = await this.query<WarningWithTypeRow>(
        QUERIES.GET_WARNING_BY_ID,
        [id],
      )
      return result.rows[0] ?? null
    } catch (error) {
      console.error("Error getting warning by ID:", error)
      return null
    }
  }

  public async listWarnings(
    params: ListWarningsParams,
  ): Promise<WarningWithTypeRow[]> {
    if (!params.guildId) {
      console.error("Invalid guild ID")
      return []
    }

    try {
      const queryParts: string[] = [QUERIES.LIST_WARNINGS_BASE]
      const queryParams: unknown[] = [params.guildId]
      let paramIndex = 2

      if (params.allyCode) {
        queryParts.push(`AND w.ally_code = $${paramIndex}`)
        queryParams.push(params.allyCode)
        paramIndex++
      }

      if (params.days && params.days > 0) {
        queryParts.push(`AND w.created_at >= NOW() - INTERVAL '${params.days} days'`)
      }

      queryParts.push("ORDER BY w.created_at DESC")

      if (params.limit && params.limit > 0) {
        queryParts.push(`LIMIT $${paramIndex}`)
        queryParams.push(params.limit)
      }

      const fullQuery: string = queryParts.join("\n")
      const result = await this.query<WarningWithTypeRow>(
        fullQuery,
        queryParams,
      )
      return result.rows
    } catch (error) {
      console.error("Error listing warnings:", error)
      return []
    }
  }

  public async deleteWarning(id: number): Promise<boolean> {
    if (!id) {
      console.error("Invalid warning ID")
      return false
    }

    try {
      const result = await this.query(QUERIES.DELETE_WARNING, [id])
      return result.rowCount !== null && result.rowCount > 0
    } catch (error) {
      console.error("Error deleting warning:", error)
      return false
    }
  }

  public async getTopOffenders(
    guildId: string,
    days: number = 30,
    limit?: number,
  ): Promise<{ ally_code: string; warning_count: number; total_weight: number }[]> {
    if (!guildId || days < 1) {
      console.error("Invalid parameters for top offenders")
      return []
    }

    try {
      let query: string = QUERIES.GET_PLAYER_WARNING_COUNT
      const params: unknown[] = [guildId, days]

      if (limit && limit > 0) {
        query += ` LIMIT $3`
        params.push(limit)
      }

      // Replace the interval placeholder with actual days value
      query = query.replace("INTERVAL '$2 days'", `INTERVAL '${days} days'`)
      params.splice(1, 1) // Remove days from params since we're using it in string

      const result = await this.query<{
        ally_code: string
        warning_count: number
        total_weight: number
      }>(query, params)
      return result.rows.map(row => ({
        ally_code: row.ally_code,
        warning_count: parseInt(row.warning_count.toString(), 10),
        total_weight: parseInt(row.total_weight.toString(), 10),
      }))
    } catch (error) {
      console.error("Error getting top offenders:", error)
      return []
    }
  }

  public async getWeeklyWarnings(guildId: string): Promise<WarningWithTypeRow[]> {
    return this.listWarnings({ guildId, days: 7 })
  }

  public async getMonthlyWarnings(guildId: string): Promise<WarningWithTypeRow[]> {
    return this.listWarnings({ guildId, days: 30 })
  }
}
