import { Pool, QueryResult, QueryResultRow } from "pg"

interface TBInstanceRow extends QueryResultRow {
  id: number
  guild_id: string
  tb_event_id: string
  start_time: string
  end_time: string | null
  is_active: boolean
  created_at: string
}

interface PlatoonAssignmentRow extends QueryResultRow {
  id: number
  tb_instance_id: number
  zone_id: string
  platoon_number: number
  squad_number: number
  slot_number: number
  assigned_player_name: string
  assigned_unit_name: string
  message_id: string | null
  assigned_at: string
}

interface UnitMappingRow extends QueryResultRow {
  id: number
  echobase_name: string
  api_identifier: string
  created_at: string
  updated_at: string
}

const QUERIES = {
  // TB Instance queries
  CREATE_TB_INSTANCE: `
    INSERT INTO tb_instances (guild_id, tb_event_id, start_time, is_active)
    VALUES ($1, $2, $3, true)
    RETURNING id;
  `,
  GET_ACTIVE_TB_INSTANCE: `
    SELECT * FROM tb_instances
    WHERE guild_id = $1 AND is_active = true
    ORDER BY start_time DESC
    LIMIT 1;
  `,
  END_TB_INSTANCE: `
    UPDATE tb_instances
    SET is_active = false, end_time = CURRENT_TIMESTAMP
    WHERE id = $1;
  `,

  // Platoon Assignment queries
  UPSERT_PLATOON_ASSIGNMENT: `
    INSERT INTO platoon_assignments (
      tb_instance_id, zone_id, platoon_number, squad_number, slot_number,
      assigned_player_name, assigned_unit_name, message_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (tb_instance_id, zone_id, platoon_number, squad_number, slot_number)
    DO UPDATE SET
      assigned_player_name = EXCLUDED.assigned_player_name,
      assigned_unit_name = EXCLUDED.assigned_unit_name,
      message_id = EXCLUDED.message_id,
      assigned_at = CURRENT_TIMESTAMP
    RETURNING id;
  `,
  GET_ASSIGNMENTS_FOR_TB: `
    SELECT * FROM platoon_assignments
    WHERE tb_instance_id = $1
    ORDER BY zone_id, platoon_number, squad_number, slot_number;
  `,
  GET_ASSIGNMENTS_BY_ZONE: `
    SELECT * FROM platoon_assignments
    WHERE tb_instance_id = $1 AND zone_id = $2
    ORDER BY platoon_number, squad_number, slot_number;
  `,
  DELETE_ASSIGNMENTS_FOR_TB: `
    DELETE FROM platoon_assignments
    WHERE tb_instance_id = $1;
  `,

  // Unit Mapping queries
  UPSERT_UNIT_MAPPING: `
    INSERT INTO unit_name_mappings (echobase_name, api_identifier)
    VALUES ($1, $2)
    ON CONFLICT (echobase_name)
    DO UPDATE SET
      api_identifier = EXCLUDED.api_identifier,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id;
  `,
  GET_UNIT_MAPPING: `
    SELECT * FROM unit_name_mappings
    WHERE echobase_name = $1;
  `,
  GET_ALL_UNIT_MAPPINGS: `
    SELECT * FROM unit_name_mappings
    ORDER BY echobase_name;
  `,
} as const

export class PlatoonAssignmentsClient {
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

  // TB Instance methods
  public async createTBInstance(
    guildId: string,
    tbEventId: string,
    startTime: Date,
  ): Promise<number | null> {
    try {
      const result = await this.query<{ id: number }>(
        QUERIES.CREATE_TB_INSTANCE,
        [guildId, tbEventId, startTime],
      )
      return result.rows[0]?.id || null
    } catch (error) {
      console.error("Error creating TB instance:", error)
      return null
    }
  }

  public async getActiveTBInstance(
    guildId: string,
  ): Promise<TBInstanceRow | null> {
    try {
      const result = await this.query<TBInstanceRow>(
        QUERIES.GET_ACTIVE_TB_INSTANCE,
        [guildId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error("Error getting active TB instance:", error)
      return null
    }
  }

  public async endTBInstance(tbInstanceId: number): Promise<boolean> {
    try {
      await this.query(QUERIES.END_TB_INSTANCE, [tbInstanceId])
      return true
    } catch (error) {
      console.error("Error ending TB instance:", error)
      return false
    }
  }

  // Platoon Assignment methods
  public async upsertPlatoonAssignment(
    tbInstanceId: number,
    zoneId: string,
    platoonNumber: number,
    squadNumber: number,
    slotNumber: number,
    playerName: string,
    unitName: string,
    messageId?: string,
  ): Promise<number | null> {
    try {
      const result = await this.query<{ id: number }>(
        QUERIES.UPSERT_PLATOON_ASSIGNMENT,
        [
          tbInstanceId,
          zoneId,
          platoonNumber,
          squadNumber,
          slotNumber,
          playerName,
          unitName,
          messageId || null,
        ],
      )
      return result.rows[0]?.id || null
    } catch (error) {
      console.error("Error upserting platoon assignment:", error)
      return null
    }
  }

  public async getAssignmentsForTB(
    tbInstanceId: number,
  ): Promise<PlatoonAssignmentRow[]> {
    try {
      const result = await this.query<PlatoonAssignmentRow>(
        QUERIES.GET_ASSIGNMENTS_FOR_TB,
        [tbInstanceId],
      )
      return result.rows
    } catch (error) {
      console.error("Error getting assignments for TB:", error)
      return []
    }
  }

  public async getAssignmentsByZone(
    tbInstanceId: number,
    zoneId: string,
  ): Promise<PlatoonAssignmentRow[]> {
    try {
      const result = await this.query<PlatoonAssignmentRow>(
        QUERIES.GET_ASSIGNMENTS_BY_ZONE,
        [tbInstanceId, zoneId],
      )
      return result.rows
    } catch (error) {
      console.error("Error getting assignments by zone:", error)
      return []
    }
  }

  public async deleteAssignmentsForTB(tbInstanceId: number): Promise<boolean> {
    try {
      await this.query(QUERIES.DELETE_ASSIGNMENTS_FOR_TB, [tbInstanceId])
      return true
    } catch (error) {
      console.error("Error deleting assignments for TB:", error)
      return false
    }
  }

  // Unit Mapping methods
  public async upsertUnitMapping(
    echobaseName: string,
    apiIdentifier: string,
  ): Promise<number | null> {
    try {
      const result = await this.query<{ id: number }>(
        QUERIES.UPSERT_UNIT_MAPPING,
        [echobaseName, apiIdentifier],
      )
      return result.rows[0]?.id || null
    } catch (error) {
      console.error("Error upserting unit mapping:", error)
      return null
    }
  }

  public async getUnitMapping(
    echobaseName: string,
  ): Promise<UnitMappingRow | null> {
    try {
      const result = await this.query<UnitMappingRow>(
        QUERIES.GET_UNIT_MAPPING,
        [echobaseName],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error("Error getting unit mapping:", error)
      return null
    }
  }

  public async getAllUnitMappings(): Promise<UnitMappingRow[]> {
    try {
      const result = await this.query<UnitMappingRow>(
        QUERIES.GET_ALL_UNIT_MAPPINGS,
      )
      return result.rows
    } catch (error) {
      console.error("Error getting all unit mappings:", error)
      return []
    }
  }
}
