import { EntityRepository } from "@mikro-orm/postgresql"
import { GuildMember } from "../entities/GuildMember.entity"

export class GuildMemberRepository extends EntityRepository<GuildMember> {
  async addMember(guildId: string, allyCode: string): Promise<boolean> {
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
        }
      } else {
        // Create new member
        member = this.create({
          guildId,
          allyCode,
          joinedAt: new Date(),
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
}
