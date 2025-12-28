import { EntityRepository, FilterQuery } from "@mikro-orm/postgresql"
import { Warning } from "../entities/Warning.entity"

export interface WarningFilters {
  guildId: string
  playerId?: string
  warningTypeId?: number
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export class WarningRepository extends EntityRepository<Warning> {
  /**
   * Get warnings for a specific player
   */
  async getPlayerWarnings(guildId: string, playerId: string): Promise<Warning[]> {
    return this.find(
      { guild: guildId, player: playerId },
      {
        populate: ["warningType", "player"],
        orderBy: { createdAt: "DESC" }
      }
    )
  }

  /**
   * Get all warnings for a guild with optional filters
   */
  async getGuildWarnings(filters: WarningFilters): Promise<{ warnings: Warning[]; total: number }> {
    const where: FilterQuery<Warning> = { guild: filters.guildId }

    if (filters.playerId) {
      where.player = filters.playerId
    }

    if (filters.warningTypeId) {
      where.warningType = filters.warningTypeId
    }

    if (filters.startDate) {
      where.createdAt = { $gte: filters.startDate }
    }

    if (filters.endDate) {
      where.createdAt = { ...(where.createdAt as any), $lte: filters.endDate }
    }

    const [warnings, total] = await this.findAndCount(where, {
      populate: ["warningType", "player"],
      orderBy: { createdAt: "DESC" },
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    })

    return { warnings, total }
  }

  /**
   * Create a new warning
   */
  async createWarning(
    guildId: string,
    playerId: string,
    warningTypeId: number,
    note?: string
  ): Promise<Warning> {
    const warning = this.create({
      guild: guildId,
      player: playerId,
      warningType: warningTypeId,
      createdAt: new Date(),
      note,
    })
    await this.getEntityManager().persistAndFlush(warning)
    return warning
  }

  /**
   * Get warning count for a player
   */
  async getPlayerWarningCount(guildId: string, playerId: string): Promise<number> {
    return this.count({ guild: guildId, player: playerId })
  }

  /**
   * Get recent warnings count (last N days)
   */
  async getRecentWarningCount(
    guildId: string,
    playerId: string,
    days: number
  ): Promise<number> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    return this.count({
      guild: guildId,
      player: playerId,
      createdAt: { $gte: since },
    })
  }
}
