import { EntityManager } from "@mikro-orm/postgresql"
import { GuildMember } from "@grakchawwaa/core"

/**
 * GuildMemberService - Business logic for guild member management
 * Repositories should only contain minimal CRUD operations
 */
export class GuildMemberService {
  private readonly em: EntityManager

  constructor(em: EntityManager) {
    this.em = em
  }

  private get guildMemberRepository() {
    return this.em.getRepository(GuildMember)
  }

  /**
   * Add a member to a guild
   * Reactivates member if they previously left
   */
  async addMember(
    guildId: string,
    allyCode: string,
    joinedAt?: Date,
  ): Promise<void> {
    if (!guildId || !allyCode) {
      throw new Error("Invalid guild member data")
    }

    // Check if member already exists
    let member = await this.guildMemberRepository.findOne({ guildId, allyCode })

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
      member = this.guildMemberRepository.create({
        guildId,
        allyCode,
        joinedAt: joinedAt || new Date(),
        isActive: true,
      })
      this.em.persist(member)
    }

    await this.em.flush()
  }

  /**
   * Remove a member from a guild (soft delete)
   */
  async removeMember(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      throw new Error("Invalid guild member data")
    }

    const member = await this.guildMemberRepository.findOne({
      guildId,
      allyCode,
    })
    if (!member) {
      return false
    }

    // Soft delete: set leftAt and isActive
    member.leftAt = new Date()
    member.isActive = false

    await this.em.flush()
    return true
  }

  /**
   * Get all active members of a guild
   */
  async getActiveMembers(guildId: string): Promise<GuildMember[]> {
    if (!guildId) {
      throw new Error("Invalid guild ID")
    }

    return this.guildMemberRepository.find({ guildId, isActive: true })
  }

  /**
   * Get all members of a guild (active and inactive)
   */
  async getAllMembers(guildId: string): Promise<GuildMember[]> {
    if (!guildId) {
      throw new Error("Invalid guild ID")
    }

    return this.guildMemberRepository.find({ guildId })
  }

  /**
   * Get membership history for a player across all guilds
   */
  async getMemberHistory(allyCode: string): Promise<GuildMember[]> {
    if (!allyCode) {
      throw new Error("Invalid ally code")
    }

    return this.guildMemberRepository.find({ allyCode })
  }

  /**
   * Check if a player is an active member of a guild
   */
  async isActiveMember(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      return false
    }

    const member = await this.guildMemberRepository.findOne({
      guildId,
      allyCode,
      isActive: true,
    })
    return member !== null
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
      throw new Error("Invalid guild ID")
    }

    let added = 0
    let removed = 0
    let reactivated = 0

    // Get all current members (active and inactive)
    const existingMembers = await this.guildMemberRepository.find({ guildId })
    const existingMap = new Map(existingMembers.map((m) => [m.allyCode, m]))

    // Track which ally codes are in Comlink data
    const comlinkAllyCodes = new Set(comlinkMembers.map((m) => m.allyCode))

    // Add or reactivate members from Comlink
    for (const comlinkMember of comlinkMembers) {
      const existing = existingMap.get(comlinkMember.allyCode)

      if (!existing) {
        // New member - create
        const member = this.guildMemberRepository.create({
          guildId,
          allyCode: comlinkMember.allyCode,
          joinedAt: comlinkMember.joinedAt,
          isActive: true,
        })
        this.em.persist(member)
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

    await this.em.flush()
    return { added, removed, reactivated }
  }
}
