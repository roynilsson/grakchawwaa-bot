import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import { channelMention, TextChannel } from "discord.js"

interface CommandResponse<T = undefined> {
  success: boolean
  response: {
    content: string
    ephemeral?: boolean
  }
  value?: T
}

interface ComlinkPlayerData {
  playerId: string
  guildId?: string
  guildName?: string
}

export class RegisterAnniversaryChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("register-anniversary-channel")
          .setDescription(
            "Register a channel for guild member anniversary notifications",
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription(
                "Discord channel to post guild member anniversary announcements",
              )
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Ally code of a guild member (optional)")
              .setRequired(false),
          ),
      { idHints: ["1374799120535126056"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Validate initial requirements before deferring
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      const allyCodeResponse = await this.resolveAllyCode(interaction)
      if (!allyCodeResponse.success || !allyCodeResponse.value) {
        return await interaction.reply(allyCodeResponse.response)
      }

      // If initial validations pass, defer the reply for longer operations
      await interaction.deferReply()

      const guildData = await this.fetchGuildData(allyCodeResponse.value)
      if (!guildData.success || !guildData.value) {
        return await interaction.editReply(guildData.response)
      }

      // Check permissions using database instead of Comlink
      const hasPermission = await container.permissionService.isOfficerOrLeader(
        guildData.value.guildId,
        allyCodeResponse.value,
      )
      if (!hasPermission) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can register the guild for anniversary notifications.",
        })
      }

      const registration = await this.registerGuildChannel(
        guildData.value.guildId,
        channel.value.id,
        guildData.value.guildName,
      )
      if (!registration.success) {
        return await interaction.editReply(registration.response)
      }

      return await interaction.editReply({
        content: this.formatSuccessMessage(
          channel.value.id,
          guildData.value.guildName,
        ),
      })
    } catch (error) {
      // If we haven't deferred yet, use reply instead of editReply
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      console.error("Error in register-anniversary-channel command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  private validateChannel(
    interaction: Command.ChatInputCommandInteraction,
  ): CommandResponse<TextChannel> {
    const channel = interaction.options.getChannel("channel")
    if (!channel || !(channel instanceof TextChannel)) {
      return {
        success: false,
        response: {
          content: "Please provide a valid text channel.",
          ephemeral: true,
        },
      }
    }
    return {
      success: true,
      response: { content: "" },
      value: channel,
    }
  }

  private async resolveAllyCode(
    interaction: Command.ChatInputCommandInteraction,
  ): Promise<CommandResponse<string>> {
    const inputAllyCode = interaction.options.getString("ally-code")
    const allyCode = inputAllyCode?.replace(/-/g, "") ?? null

    if (!allyCode) {
      const player = await container.playerService.getMainPlayer(
        interaction.user.id,
      )
      if (!player?.allyCode) {
        return {
          success: false,
          response: {
            content:
              "You don't have a registered ally code. Please provide an ally code or register with `/register-player`.",
            ephemeral: true,
          },
        }
      }
      return {
        success: true,
        response: { content: "" },
        value: player.allyCode,
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: allyCode,
    }
  }

  private async fetchGuildData(allyCode: string): Promise<
    CommandResponse<{
      guildId: string
      guildName: string
    }>
  > {
    const playerData = await container.comlinkClient.getPlayer(allyCode)
    if (!playerData?.guildId) {
      return {
        success: false,
        response: {
          content: `Could not find a guild for ally code ${allyCode}. Please make sure the ally code belongs to a guild member.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: {
        guildId: playerData.guildId,
        guildName: playerData.guildName || "Unknown Guild",
      },
    }
  }

  private async registerGuildChannel(
    guildId: string,
    channelId: string,
    guildName: string,
  ): Promise<CommandResponse> {
    try {
      await container.guildService.registerAnniversaryChannel(
        guildId,
        channelId,
        guildName,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      return {
        success: false,
        response: {
          content:
            "Failed to register anniversary channel. Please try again later.",
        },
      }
    }
  }

  private formatSuccessMessage(channelId: string, guildName: string): string {
    return `Successfully registered ${channelMention(
      channelId,
    )} for anniversary notifications for guild: ${guildName}`
  }
}
