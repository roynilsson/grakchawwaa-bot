import { container } from "@sapphire/pieces"

export interface ResolvedPlayer {
  playerName: string
  allyCode: string
}

export class PlayerResolver {
  /**
   * Resolves player names to ally codes using guild member data
   * @param guildId - The SWGOH guild ID
   * @param playerNames - Array of player names to resolve
   * @returns Map of player name → ally code
   */
  public static async resolvePlayerNames(
    guildId: string,
    playerNames: string[],
  ): Promise<Map<string, string>> {
    const resolvedPlayers = new Map<string, string>()

    try {
      // Fetch guild data with member roster
      const guildData = await container.cachedComlinkClient.getGuild(guildId, true)
      if (!guildData?.guild?.member) {
        console.error("Could not fetch guild member data")
        return resolvedPlayers
      }

      // Create a map of normalized name → playerId for fast lookup
      const memberMap = new Map<string, string>()
      for (const member of guildData.guild.member) {
        if (member.playerName && member.playerId) {
          const normalizedName = this.normalizeName(member.playerName)
          memberMap.set(normalizedName, member.playerId)
        }
      }

      // Resolve each player name to ally code
      for (const playerName of playerNames) {
        const normalizedName = this.normalizeName(playerName)
        const playerId = memberMap.get(normalizedName)

        if (playerId) {
          // Fetch player data to get ally code
          const allyCode = await this.getAllyCodeForPlayer(playerId)
          if (allyCode) {
            resolvedPlayers.set(playerName, allyCode)
          } else {
            console.warn(`Could not get ally code for player: ${playerName}`)
          }
        } else {
          console.warn(`Could not find player in guild: ${playerName}`)
        }
      }

      return resolvedPlayers
    } catch (error) {
      console.error("Error resolving player names:", error)
      return resolvedPlayers
    }
  }

  /**
   * Fetches ally code for a player given their player ID
   * @param playerId - The player ID from guild member data
   * @returns The ally code (9 digits) or null
   */
  private static async getAllyCodeForPlayer(
    playerId: string,
  ): Promise<string | null> {
    try {
      const playerData = await container.comlinkClient.getPlayer(
        undefined,
        playerId,
      )
      if (!playerData?.allyCode) {
        return null
      }
      // Normalize to 9 digits
      const digits = playerData.allyCode.toString().replace(/\D/g, "")
      return digits.length === 9 ? digits : null
    } catch (error) {
      console.error(`Error fetching ally code for player ${playerId}:`, error)
      return null
    }
  }

  /**
   * Normalizes a player name for comparison
   * - Converts to lowercase
   * - Removes extra whitespace
   * - Trims leading/trailing spaces
   */
  private static normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, " ")
  }
}
