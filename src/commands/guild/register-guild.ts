import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

interface CommandResponse<T = undefined> {
  success: boolean
  response: {
    content: string
    ephemeral?: boolean
  }
  value?: T
}

interface ComlinkGuildMember {
  playerId: string
  memberLevel: number
}

interface ComlinkPlayerData {
  playerId: string
  guildId?: string
  guildName?: string
}

interface ComlinkGuildData {
  profile: {
    id: string
    name: string
  }
  member?: ComlinkGuildMember[]
  nextChallengesRefresh?: string
}

export class RegisterGuildCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("register-guild")
        .setDescription("Register your guild with the bot (Officers/Leaders only)")
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Defer reply immediately
      await interaction.deferReply()

      // 1. Get user's main ally code from backend API
      const allyCodeResponse = await this.getUserMainAllyCode(
        interaction.user.id,
      )
      if (!allyCodeResponse.success || !allyCodeResponse.value) {
        return await interaction.editReply(allyCodeResponse.response)
      }

      // 2. Fetch player's guild from Comlink
      const playerData = await this.fetchPlayerData(allyCodeResponse.value)
      if (!playerData.success || !playerData.value) {
        return await interaction.editReply(playerData.response)
      }

      // 3. Fetch guild roster from Comlink
      const guildData = await this.fetchGuildData(
        playerData.value.guildId!,
      )
      if (!guildData.success || !guildData.value) {
        return await interaction.editReply(guildData.response)
      }

      // 4. Verify user is Officer/Leader
      const hasPermission = await this.checkGuildPermission(
        playerData.value,
        guildData.value,
      )
      if (!hasPermission.success) {
        return await interaction.editReply(hasPermission.response)
      }

      // 5. Register guild in backend
      const registration = await this.registerGuild(guildData.value)
      if (!registration.success) {
        return await interaction.editReply(registration.response)
      }

      return await interaction.editReply({
        content: `Successfully registered guild **${guildData.value.profile.name}** with the bot!\n\nYou can now configure channels using:\n- \`/register-ticket-collection\`\n- \`/register-anniversary-channel\``,
      })
    } catch (error) {
      console.error("Error in register-guild command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while registering your guild. Please try again later.",
      })
    }
  }

  private async getUserMainAllyCode(
    discordId: string,
  ): Promise<CommandResponse<string>> {
    try {
      const players = await container.backendApi.players.list({
        discordId,
        isMain: true,
      })

      if (!players || players.length === 0) {
        return {
          success: false,
          response: {
            content:
              "You don't have a registered main account. Please use `/register-player <ally-code>` first.",
            ephemeral: true,
          },
        }
      }

      const mainPlayer = players[0]
      if (!mainPlayer) {
        return {
          success: false,
          response: {
            content: "Failed to retrieve your main player information.",
            ephemeral: true,
          },
        }
      }

      return {
        success: true,
        response: { content: "" },
        value: mainPlayer.allyCode,
      }
    } catch (error) {
      return {
        success: false,
        response: {
          content: "Failed to retrieve your player information.",
          ephemeral: true,
        },
      }
    }
  }

  private async fetchPlayerData(
    allyCode: string,
  ): Promise<CommandResponse<ComlinkPlayerData>> {
    const playerData = await container.comlinkClient.getPlayer(allyCode)

    if (!playerData) {
      return {
        success: false,
        response: {
          content: `Could not retrieve player data for ally code ${allyCode}. Please try again later.`,
        },
      }
    }

    if (!playerData.guildId) {
      return {
        success: false,
        response: {
          content: "You must be in a guild to register it with the bot.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: playerData,
    }
  }

  private async fetchGuildData(
    guildId: string,
  ): Promise<CommandResponse<ComlinkGuildData>> {
    const guildData = await container.comlinkClient.getGuild(guildId, true)

    if (!guildData?.guild) {
      return {
        success: false,
        response: {
          content: "Could not retrieve guild data. Please try again later.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: guildData.guild,
    }
  }

  private async checkGuildPermission(
    playerData: ComlinkPlayerData,
    guildData: ComlinkGuildData,
  ): Promise<CommandResponse> {
    const guildMember = guildData.member?.find(
      (m: ComlinkGuildMember) => m.playerId === playerData.playerId,
    )

    if (!guildMember || guildMember.memberLevel < 3) {
      return {
        success: false,
        response: {
          content:
            "Only guild leaders and officers can register the guild with the bot.",
        },
      }
    }

    return { success: true, response: { content: "" } }
  }

  private async registerGuild(
    guildData: ComlinkGuildData,
  ): Promise<CommandResponse> {
    try {
      await container.backendApi.guilds.create({
        guildId: guildData.profile.id,
        name: guildData.profile.name,
      })

      return {
        success: true,
        response: { content: "" },
      }
    } catch (error) {
      const errorMessage = (error as Error).message

      if (errorMessage.includes("already registered")) {
        return {
          success: false,
          response: {
            content: `Guild **${guildData.profile.name}** is already registered with the bot.\n\nYou can configure channels using:\n- \`/register-ticket-collection\`\n- \`/register-anniversary-channel\``,
          },
        }
      }

      console.error("Failed to register guild:", error)
      return {
        success: false,
        response: {
          content: "Failed to register guild in database. Please try again later.",
        },
      }
    }
  }
}
