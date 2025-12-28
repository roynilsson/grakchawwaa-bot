import { EntityRepository } from "@mikro-orm/postgresql"
import { WarningType } from "../entities/WarningType.entity"

export class WarningTypeRepository extends EntityRepository<WarningType> {
  /**
   * Get all warning types for a guild
   */
  async getGuildWarningTypes(guildId: string): Promise<WarningType[]> {
    return this.find(
      { guild: guildId },
      { orderBy: { severity: "DESC", name: "ASC" } }
    )
  }

  /**
   * Create a new warning type for a guild
   */
  async createWarningType(
    guildId: string,
    name: string,
    severity: number
  ): Promise<WarningType> {
    const now = new Date()
    const warningType = this.create({
      guild: guildId,
      name,
      severity,
      createdAt: now,
      updatedAt: now,
    })
    await this.getEntityManager().persistAndFlush(warningType)
    return warningType
  }

  /**
   * Update a warning type
   */
  async updateWarningType(
    id: number,
    data: { name?: string; severity?: number }
  ): Promise<WarningType | null> {
    const warningType = await this.findOne({ id })
    if (!warningType) {
      return null
    }

    if (data.name !== undefined) {
      warningType.name = data.name
    }
    if (data.severity !== undefined) {
      warningType.severity = data.severity
    }

    await this.getEntityManager().flush()
    return warningType
  }

  /**
   * Delete a warning type
   */
  async deleteWarningType(id: number): Promise<boolean> {
    const warningType = await this.findOne({ id })
    if (!warningType) {
      return false
    }

    await this.getEntityManager().removeAndFlush(warningType)
    return true
  }
}
