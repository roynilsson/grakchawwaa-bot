import { EntityManager } from "@mikro-orm/postgresql"
import { GuildMember } from "../entities/GuildMember.entity"

/**
 * Member level constants from SWGOH
 */
export enum MemberLevel {
  MEMBER = 2,
  OFFICER = 3,
  LEADER = 4,
}

/**
 * PermissionService - Handles guild permission checks
 */
export class PermissionService {
  private readonly em: EntityManager

  constructor(em: EntityManager) {
    this.em = em
  }

  /**
   * Check if a player has officer or leader permissions in a guild
   * @param guildId - The guild ID to check
   * @param allyCode - The player's ally code
   * @returns true if player is an officer (level 3) or leader (level 4)
   */
  async isOfficerOrLeader(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      return false
    }

    const member = await this.em.getRepository(GuildMember).findOne({
      guild: guildId,
      player: allyCode,
      isActive: true,
    })

    if (!member || !member.memberLevel) {
      return false
    }

    return member.memberLevel >= MemberLevel.OFFICER
  }

  /**
   * Check if a player is a guild leader
   * @param guildId - The guild ID to check
   * @param allyCode - The player's ally code
   * @returns true if player is a leader (level 4)
   */
  async isLeader(guildId: string, allyCode: string): Promise<boolean> {
    if (!guildId || !allyCode) {
      return false
    }

    const member = await this.em.getRepository(GuildMember).findOne({
      guild: guildId,
      player: allyCode,
      isActive: true,
    })

    if (!member || !member.memberLevel) {
      return false
    }

    return member.memberLevel === MemberLevel.LEADER
  }

  /**
   * Get a player's member level in a guild
   * @param guildId - The guild ID to check
   * @param allyCode - The player's ally code
   * @returns the member level (2, 3, or 4) or null if not found
   */
  async getMemberLevel(guildId: string, allyCode: string): Promise<number | null> {
    if (!guildId || !allyCode) {
      return null
    }

    const member = await this.em.getRepository(GuildMember).findOne({
      guild: guildId,
      player: allyCode,
      isActive: true,
    })

    return member?.memberLevel ?? null
  }
}
