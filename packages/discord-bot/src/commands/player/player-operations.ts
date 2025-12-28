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
    return this.container.playerService.getMainPlayer(userId)
  }

  public async getAllPlayers(userId: string): Promise<Player[]> {
    return this.container.playerService.getAllPlayers(userId)
  }

  public async addUser(
    discordUserId: string,
    allyCode: string,
    isMain: boolean = false,
  ): Promise<void> {
    // Fetch player data from Comlink to get name and player ID
    let name: string | undefined
    let playerId: string | undefined

    try {
      const playerData = await this.container.comlinkClient.getPlayer(allyCode)
      if (playerData) {
        name = playerData.name
        playerId = playerData.playerId
      }
    } catch (error) {
      console.warn("Failed to fetch player data from Comlink:", error)
      // Continue without name/playerId
    }

    // Service will throw error if registration fails
    await this.container.playerService.registerPlayer(
      discordUserId,
      allyCode,
      isMain,
      name,
      playerId,
    )
  }

  public async removeAllyCode(allyCode: string): Promise<boolean> {
    return this.container.playerService.unregisterPlayer(allyCode)
  }

  public async removeAllPlayers(discordUserId: string): Promise<number> {
    return this.container.playerService.unregisterAllPlayers(discordUserId)
  }
}
