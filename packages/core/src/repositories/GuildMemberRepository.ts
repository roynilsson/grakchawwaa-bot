import { EntityRepository } from "@mikro-orm/postgresql"
import { GuildMember } from "../entities/GuildMember.entity"

export class GuildMemberRepository extends EntityRepository<GuildMember> {
  async addMember(
    guildId: string,
    allyCode: string,
    joinedAt?: Date,
  ): Promise<boolean> {
    if (!guildId || !allyCode) {
      console.error("Invalid guild member data")
      return false
    }

    try {
      const em = this.getEntityManager()

      // Check if member already exists
      let member = await this.findOne({ guildId, allyCode })

      if (member) {
        // Reactivate if previously left
        if (!member.isActive) {
          member.isActive = true
          member.leftAt = undefined
          // Update joinedAt if provided (rejoining with known date)
          if (joinedAt) {
            member.joinedAt = joinedAt
          }
        }
        // If member is already active and we have joinedAt, update it
        // (this handles initial population from Comlink)
        else if (joinedAt && !member.joinedAt) {
          member.joinedAt = joinedAt
        }
      } else {
        // Create new member
        member = this.create({
          guildId,
          allyCode,
          joinedAt: joinedAt || new Date(),
          isActive: true,
        })
        em.persist(member)
      }

      await em.flush()
      return true
    } catch (error) {
      console.error("Error adding guild member:", error)
      return false
    }
  }

  async removeMember(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      console.error("Invalid guild member data")
      return false
    }

    try {
      const member = await this.findOne({ guildId, allyCode })
      if (!member) {
        return false
      }

      // Soft delete: set leftAt and isActive
      member.leftAt = new Date()
      member.isActive = false

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error removing guild member:", error)
      return false
    }
  }

  async getActiveMembers(guildId: string): Promise<GuildMember[]> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return []
    }

    try {
      return await this.find({ guildId, isActive: true })
    } catch (error) {
      console.error("Error getting active guild members:", error)
      return []
    }
  }

  async getAllMembers(guildId: string): Promise<GuildMember[]> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return []
    }

    try {
      return await this.find({ guildId })
    } catch (error) {
      console.error("Error getting all guild members:", error)
      return []
    }
  }

  async getMemberHistory(allyCode: string): Promise<GuildMember[]> {
    if (!allyCode) {
      console.error("Invalid ally code")
      return []
    }

    try {
      return await this.find({ allyCode })
    } catch (error) {
      console.error("Error getting member history:", error)
      return []
    }
  }

  async isActiveMember(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      return false
    }

    try {
      const member = await this.findOne({ guildId, allyCode, isActive: true })
      return member !== null
    } catch (error) {
      console.error("Error checking active member:", error)
      return false
    }
  }

  /**
   * Sync guild members from Comlink data
   * Adds new members, reactivates returning members, and soft-deletes members who left
   */
  async syncMembers(
    guildId: string,
    comlinkMembers: Array<{ allyCode: string; joinedAt: Date }>,
  ): Promise<{ added: number; removed: number; reactivated: number }> {
    if (!guildId) {
      console.error("Invalid guild ID")
      return { added: 0, removed: 0, reactivated: 0 }
    }

    try {
      const em = this.getEntityManager()
      let added = 0
      let removed = 0
      let reactivated = 0

      // Get all current members (active and inactive)
      const existingMembers = await this.find({ guildId })
      const existingMap = new Map(
        existingMembers.map((m) => [m.allyCode, m]),
      )

      // Track which ally codes are in Comlink data
      const comlinkAllyCodes = new Set(
        comlinkMembers.map((m) => m.allyCode),
      )

      // Add or reactivate members from Comlink
      for (const comlinkMember of comlinkMembers) {
        const existing = existingMap.get(comlinkMember.allyCode)

        if (!existing) {
          // New member - create
          const member = this.create({
            guildId,
            allyCode: comlinkMember.allyCode,
            joinedAt: comlinkMember.joinedAt,
            isActive: true,
          })
          em.persist(member)
          added++
        } else if (!existing.isActive) {
          // Previously left, now returned - reactivate
          existing.isActive = true
          existing.leftAt = undefined
          existing.joinedAt = comlinkMember.joinedAt
          reactivated++
        } else if (!existing.joinedAt) {
          // Active member but missing joinedAt - populate it
          existing.joinedAt = comlinkMember.joinedAt
        }
      }

      // Soft delete members who are no longer in guild
      for (const existing of existingMembers) {
        if (existing.isActive && !comlinkAllyCodes.has(existing.allyCode)) {
          existing.isActive = false
          existing.leftAt = new Date()
          removed++
        }
      }

      await em.flush()
      return { added, removed, reactivated }
    } catch (error) {
      console.error("Error syncing guild members:", error)
      return { added: 0, removed: 0, reactivated: 0 }
    }
  }
}
