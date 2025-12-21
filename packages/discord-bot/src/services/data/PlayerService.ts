import { EntityManager } from "@mikro-orm/core"
import { Player, normalizeAllyCode } from "@grakchawwaa/core"

export class PlayerService {
  constructor(private readonly em: EntityManager) {}

  private get playerRepository() {
    return this.em.getRepository(Player)
  }

  /**
   * Register a player to a Discord user
   * Creates new player if doesn't exist, updates if discord_id is null
   * Throws error if already registered to different Discord user
   */
  async registerPlayer(
    discordId: string,
    allyCode: string,
    isMain: boolean,
    name?: string,
    playerId?: string,
  ): Promise<void> {
    const existing = await this.playerRepository.findOne({ allyCode })

    if (existing) {
      // Check if already registered to a different Discord user
      if (existing.discordId && existing.discordId !== discordId) {
        throw new Error(
          "This ally code is already registered to another Discord user. Please unregister it first.",
        )
      }

      // Update existing player
      existing.discordId = discordId
      existing.isMain = isMain
      if (name) existing.name = name
      if (playerId) existing.playerId = playerId
    } else {
      // Create new player
      const player = this.playerRepository.create({
        allyCode,
        discordId,
        isMain,
        name,
        playerId,
        registeredAt: new Date(),
      })
      this.em.persist(player)
    }

    await this.em.flush()
  }

  /**
   * Unregister a player from Discord (clears discord_id)
   * Preserves player data for guild sync
   */
  async unregisterPlayer(allyCode: string): Promise<boolean> {
    const player = await this.playerRepository.findOne({ allyCode })
    if (!player || !player.discordId) {
      return false
    }

    player.discordId = undefined
    player.isMain = false
    await this.em.flush()
    return true
  }

  /**
   * Unregister all players for a Discord user
   */
  async unregisterAllPlayers(discordId: string): Promise<number> {
    const players = await this.playerRepository.find({ discordId })

    for (const player of players) {
      player.discordId = undefined
      player.isMain = false
    }

    await this.em.flush()
    return players.length
  }

  /**
   * Get the main player for a Discord user
   */
  async getMainPlayer(discordId: string): Promise<Player | null> {
    return this.playerRepository.findOne({ discordId, isMain: true })
  }

  /**
   * Get all players (main + alts) for a Discord user
   */
  async getAllPlayers(discordId: string): Promise<Player[]> {
    return this.playerRepository.find({ discordId })
  }

  /**
   * Create or update a player from Comlink data
   * Used by guild sync to ensure all guild members exist in database
   */
  async upsertPlayerFromComlink(
    allyCode: string,
    name: string,
    playerId: string,
  ): Promise<void> {
    const existing = await this.playerRepository.findOne({ allyCode })

    if (existing) {
      // Update name and playerId if changed
      if (name && existing.name !== name) {
        existing.name = name
      }
      if (playerId && existing.playerId !== playerId) {
        existing.playerId = playerId
      }
    } else {
      // Create new unregistered player
      const player = this.playerRepository.create({
        allyCode,
        discordId: undefined,
        name,
        playerId,
        isMain: false,
        registeredAt: new Date(),
      })
      this.em.persist(player)
    }

    await this.em.flush()
  }

  /**
   * Find Discord ID by ally code
   */
  async findDiscordIdByAllyCode(allyCode: string): Promise<string | null> {
    const player = await this.playerRepository.findOne({ allyCode })
    return player?.discordId ?? null
  }
}
