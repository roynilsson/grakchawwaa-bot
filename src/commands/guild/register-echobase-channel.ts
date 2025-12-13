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
  member?: ComlinkGuildMember[]
}

export class RegisterEchobaseChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("register-echobase-channel")
          .setDescription(
            "Register a channel where Echobase posts TB platoon assignments",
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription(
                "Discord channel where Echobase posts TB assignments",
              )
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Ally code of a guild member (optional)")
              .setRequired(false),
          ),
      { idHints: ["1449422735380975841"] },
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

      const hasPermission = await this.checkGuildPermission(
        guildData.value.playerData,
        guildData.value.guild,
      )
      if (!hasPermission.success) {
        return await interaction.editReply(hasPermission.response)
      }

      const registration = await this.registerGuildChannel(
        guildData.value.guildId,
        channel.value.id,
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

      console.error("Error in register-echobase-channel command:", error)
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

    if (allyCode && allyCode.length !== 9) {
      return {
        success: false,
        response: {
          content: "Invalid ally code. Please provide a valid 9-digit ally code.",
          ephemeral: true,
        },
      }
    }

    if (!allyCode) {
      const player = await container.playerClient.getPlayer(interaction.user.id)
      if (!player) {
        return {
          success: false,
          response: {
            content:
              "You don't have a registered ally code. Please provide one or register with `/register-player`.",
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

  private async fetchGuildData(
    allyCode: string,
  ): Promise<
    CommandResponse<{
      guildId: string
      guildName: string
      playerData: ComlinkPlayerData
      guild: ComlinkGuildData
    }>
  > {
    const playerData = (await container.comlinkClient.getPlayer(
      allyCode,
    )) as ComlinkPlayerData

    if (!playerData || !playerData.guildId) {
      return {
        success: false,
        response: {
          content: `No guild found for ally code ${allyCode}. Please ensure the player is in a guild.`,
        },
      }
    }

    const guildData = await container.comlinkClient.getGuild(
      playerData.guildId,
      true,
    )

    if (!guildData?.guild) {
      return {
        success: false,
        response: {
          content: `Could not retrieve guild data for guild: ${
            playerData.guildName || "Unknown Guild"
          }. Please try again later.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: {
        guildId: playerData.guildId,
        guildName: playerData.guildName ?? "Unknown Guild",
        playerData,
        guild: guildData.guild,
      },
    }
  }

  private async checkGuildPermission(
    playerData: ComlinkPlayerData,
    guild: ComlinkGuildData,
  ): Promise<CommandResponse> {
    const member = guild.member?.find(
      (m: ComlinkGuildMember) => m.playerId === playerData.playerId,
    )

    if (!member) {
      return {
        success: false,
        response: {
          content: "You are not a member of this guild.",
        },
      }
    }

    // Check if member is an officer (memberLevel 2) or guild leader (memberLevel 3 or 4)
    if (member.memberLevel < 2) {
      return {
        success: false,
        response: {
          content:
            "You must be an officer or guild leader to register an Echobase channel.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
    }
  }

  private async registerGuildChannel(
    guildId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    const success = await container.ticketChannelClient.registerEchobaseChannel(
      guildId,
      channelId,
    )

    if (!success) {
      return {
        success: false,
        response: {
          content:
            "Failed to register Echobase channel. Please try again later.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
    }
  }

  private formatSuccessMessage(channelId: string, guildName: string): string {
    return (
      `Successfully registered ${channelMention(channelId)} as the Echobase channel for **${guildName}**.\n\n` +
      `The bot will now monitor this channel for TB platoon assignments posted by Echobase.`
    )
  }
}
