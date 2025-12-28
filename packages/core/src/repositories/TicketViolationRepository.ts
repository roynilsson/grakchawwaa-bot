import { EntityRepository } from "@mikro-orm/postgresql"
import { TicketViolation } from "../entities/TicketViolation.entity"

export class TicketViolationRepository extends EntityRepository<TicketViolation> {
  /**
   * Record ticket violations for multiple players
   * @param guildId - Guild ID
   * @param ticketCounts - Map of playerId to ticket count
   * @param date - Optional date (defaults to now)
   */
  async recordViolations(
    guildId: string,
    ticketCounts: Record<string, number>,
    date?: Date,
  ): Promise<boolean> {
    if (!guildId || Object.keys(ticketCounts).length === 0) {
      console.error("Invalid guild or empty ticket counts")
      return false
    }

    try {
      const violationDate = date || new Date()
      const violations: TicketViolation[] = []

      // Create individual violation records for each player
      for (const [playerId, ticketCount] of Object.entries(ticketCounts)) {
        const violation = this.create({
          guildId,
          playerId,
          date: violationDate,
          ticketCount,
        })
        violations.push(violation)
      }

      await this.getEntityManager().persistAndFlush(violations)
      return true
    } catch (error) {
      console.error("Error recording ticket violations:", error)
      return false
    }
  }

  /**
   * Get recent violations for a guild (last 7 days worth of data)
   */
  async getRecentViolations(guildId: string): Promise<TicketViolation[]> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return []
    }

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      return await this.find(
        {
          guildId,
          date: { $gte: startDate },
        },
        {
          orderBy: { date: "DESC", ticketCount: "ASC" },
        },
      )
    } catch (error) {
      console.error("Error getting recent ticket violations:", error)
      return []
    }
  }

  /**
   * Get weekly violations (last 7 days)
   */
  async getWeeklyViolations(guildId: string): Promise<TicketViolation[]> {
    return this.getCustomPeriodViolations(guildId, 7)
  }

  /**
   * Get monthly violations (last 30 days)
   */
  async getMonthlyViolations(guildId: string): Promise<TicketViolation[]> {
    return this.getCustomPeriodViolations(guildId, 30)
  }

  /**
   * Get violations for a custom time period
   */
  async getCustomPeriodViolations(
    guildId: string,
    days: number,
  ): Promise<TicketViolation[]> {
    if (!guildId || days < 1 || days > 90) {
      console.error("Invalid guild ID or days value")
      return []
    }

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      return await this.find(
        {
          guildId,
          date: { $gte: startDate },
        },
        {
          orderBy: { date: "DESC", ticketCount: "ASC" },
        },
      )
    } catch (error) {
      console.error(`Error getting ${days}-day ticket violations:`, error)
      return []
    }
  }
}
