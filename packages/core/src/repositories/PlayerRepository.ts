import { EntityRepository } from "@mikro-orm/postgresql"
import { Player } from "../entities/Player.entity"
import { normalizeAllyCode } from "../utils/ally-code"

export class PlayerRepository extends EntityRepository<Player> {
  async addUser(discordId: string, allyCode: string, isMain: boolean = false): Promise<boolean> {
    if (!discordId || !allyCode) {
      console.error("Invalid player data")
      return false
    }

    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code")
      return false
    }

    console.log("Adding user", discordId, normalized, "isMain:", isMain)

    try {
      // Check if player with this ally code already exists
      const existing = await this.findOne({ allyCode: normalized })
      if (existing) {
        // Update existing player
        existing.discordId = discordId
        existing.isMain = isMain
      } else {
        // Create new player
        const player = this.create({
          allyCode: normalized,
          discordId,
          isMain,
          registeredAt: new Date(),
        })
        this.getEntityManager().persist(player)
      }

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error adding user:", error)
      return false
    }
  }

  async getMainPlayer(discordId: string): Promise<Player | null> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return null
    }

    try {
      return await this.findOne({ discordId, isMain: true })
    } catch (error) {
      console.error("Error getting main player:", error)
      return null
    }
  }

  async getAllPlayers(discordId: string): Promise<Player[]> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return []
    }

    try {
      return await this.find({ discordId })
    } catch (error) {
      console.error("Error getting all players:", error)
      return []
    }
  }

  async removeAllyCode(allyCode: string): Promise<boolean> {
    if (!allyCode) {
      console.error("Invalid ally code")
      return false
    }

    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code format")
      return false
    }

    try {
      const player = await this.findOne({ allyCode: normalized })
      if (!player) {
        return false
      }

      await this.getEntityManager().removeAndFlush(player)
      return true
    } catch (error) {
      console.error("Error removing ally code:", error)
      return false
    }
  }

  async removeAllPlayers(discordId: string): Promise<boolean> {
    if (!discordId) {
      console.error("Invalid discord ID")
      return false
    }

    try {
      const players = await this.find({ discordId })
      if (players.length === 0) {
        return false
      }

      await this.getEntityManager().removeAndFlush(players)
      return true
    } catch (error) {
      console.error("Error removing all players:", error)
      return false
    }
  }

  async findDiscordIdByAllyCode(allyCode: string): Promise<string | null> {
    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      return null
    }

    try {
      const player = await this.findOne({ allyCode: normalized })
      return player?.discordId ?? null
    } catch (error) {
      console.error("Error finding discord id by ally code:", error)
      return null
    }
  }
}
