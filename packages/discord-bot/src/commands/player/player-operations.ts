import { Command } from "@sapphire/framework"
import { Player } from "@grakchawwaa/core"

export class PlayerOperationsCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "player-operations",
      description: "Player management operations",
    })
  }

  public async getMainPlayer(userId: string): Promise<Player | null> {
    const repository = this.container.playerRepository
    return repository.getMainPlayer(userId)
  }

  public async getAllPlayers(userId: string): Promise<Player[]> {
    const repository = this.container.playerRepository
    return repository.getAllPlayers(userId)
  }

  public async addUser(
    discordUserId: string,
    allyCode: string,
    isMain: boolean = false,
  ): Promise<boolean> {
    const repository = this.container.playerRepository

    // Fetch player data from Comlink to get name and player ID
    try {
      const playerData = await this.container.comlinkClient.getPlayer(allyCode)
      if (playerData) {
        return repository.addUser(
          discordUserId,
          allyCode,
          isMain,
          playerData.name,
          playerData.playerId,
        )
      }
    } catch (error) {
      console.warn("Failed to fetch player data from Comlink:", error)
      // Fall back to adding without name/playerId
    }

    return repository.addUser(discordUserId, allyCode, isMain)
  }

  public async removeAllyCode(allyCode: string): Promise<boolean> {
    const repository = this.container.playerRepository
    return repository.removeAllyCode(allyCode)
  }

  public async removeAllPlayers(discordUserId: string): Promise<boolean> {
    const repository = this.container.playerRepository
    return repository.removeAllPlayers(discordUserId)
  }
}
