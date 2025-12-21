import { EntityRepository } from "@mikro-orm/postgresql"
import { Player } from "../entities/Player.entity"
import { normalizeAllyCode } from "../utils/ally-code"

export class PlayerRepository extends EntityRepository<Player> {
  async addUser(
    discordId: string,
    allyCode: string,
    isMain: boolean = false,
    name?: string,
    playerId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!discordId || !allyCode) {
      console.error("Invalid player data")
      return { success: false, error: "Invalid player data" }
    }

    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code")
      return { success: false, error: "Invalid ally code" }
    }

    console.log("Adding user", discordId, normalized, "isMain:", isMain)

    try {
      // Check if player with this ally code already exists
      const existing = await this.findOne({ allyCode: normalized })
      if (existing) {
        // If player already has a discord_id and it's different, reject
        if (existing.discordId && existing.discordId !== discordId) {
          return {
            success: false,
            error: "This ally code is already registered to another Discord user. Please unregister it first.",
          }
        }

        // If discord_id is null or matches, update the player
        existing.discordId = discordId
        existing.isMain = isMain
        if (name) existing.name = name
        if (playerId) existing.playerId = playerId
      } else {
        // Create new player
        const player = this.create({
          allyCode: normalized,
          discordId,
          isMain,
          name,
          playerId,
          registeredAt: new Date(),
        })
        this.getEntityManager().persist(player)
      }

      await this.getEntityManager().flush()
      return { success: true }
    } catch (error) {
      console.error("Error adding user:", error)
      return { success: false, error: "Database error" }
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

      // Clear discord_id instead of deleting the row
      // This preserves the player data for guild sync
      player.discordId = undefined
      player.isMain = false

      await this.getEntityManager().flush()
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

      // Clear discord_id from all players instead of deleting
      for (const player of players) {
        player.discordId = undefined
        player.isMain = false
      }

      await this.getEntityManager().flush()
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

  /**
   * Create or update a player from Comlink data
   * Used by guild sync to ensure all guild members exist in the players table
   */
  async upsertFromComlink(
    allyCode: string,
    name: string,
    playerId: string,
  ): Promise<boolean> {
    const normalized = normalizeAllyCode(allyCode)
    if (!normalized) {
      console.error("Invalid ally code")
      return false
    }

    try {
      const existing = await this.findOne({ allyCode: normalized })

      if (existing) {
        // Update name and playerId if they've changed
        if (name && existing.name !== name) {
          existing.name = name
        }
        if (playerId && existing.playerId !== playerId) {
          existing.playerId = playerId
        }
      } else {
        // Create new player without discord_id (unregistered)
        const player = this.create({
          allyCode: normalized,
          discordId: undefined,
          name,
          playerId,
          isMain: false,
          registeredAt: new Date(),
        })
        this.getEntityManager().persist(player)
      }

      await this.getEntityManager().flush()
      return true
    } catch (error) {
      console.error("Error upserting player from Comlink:", error)
      return false
    }
  }
}
