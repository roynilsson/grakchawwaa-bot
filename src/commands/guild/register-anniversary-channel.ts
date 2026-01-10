import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import {
  channelMention,
  TextChannel,
  type AutocompleteInteraction,
} from "discord.js"
import type { PlayerGuildMembership } from "../../api/player-client"

interface CommandResponse<T = undefined> {
  success: boolean
  response: {
    content: string
    ephemeral?: boolean
  }
  value?: T
}

interface GuildMembershipData {
  allyCode: string
  membership: PlayerGuildMembership
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
              .setDescription("Select one of your registered accounts")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      { idHints: ["1374799120535126056"] },
    )
  }

  public override async autocompleteRun(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "ally-code") {
      try {
        const players = await container.backendApi.players.list({
          discordId: interaction.user.id,
        })

        const choices = players.map(
          (player: { name?: string; allyCode: string; isMain?: boolean }) => ({
            name: player.name
              ? `${player.name} (${player.allyCode})${player.isMain ? " - Main" : ""}`
              : `${player.allyCode}${player.isMain ? " - Main" : ""}`,
            value: player.allyCode,
          }),
        )

        return interaction.respond(choices.slice(0, 25))
      } catch {
        return interaction.respond([])
      }
    }
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Validate Discord channel
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      // Defer reply for API calls
      await interaction.deferReply()

      // Get ally code (from autocomplete selection or user's main account)
      const allyCodeResult = await this.resolveAllyCode(interaction)
      if (!allyCodeResult.success || !allyCodeResult.value) {
        return await interaction.editReply(allyCodeResult.response)
      }

      // Validate ally code belongs to this user
      const validationResult = await this.validateAllyCodeOwnership(
        interaction.user.id,
        allyCodeResult.value,
      )
      if (!validationResult.success) {
        return await interaction.editReply(validationResult.response)
      }

      // Get guild membership from backend
      const membershipResult = await this.getGuildMembership(
        allyCodeResult.value,
      )
      if (!membershipResult.success || !membershipResult.value) {
        return await interaction.editReply(membershipResult.response)
      }

      // Check permission (must be officer or leader)
      if (membershipResult.value.membership.memberLevel < 3) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can register the guild for anniversary notifications.",
        })
      }

      // Register the guild channel
      const registrationResult = await this.registerGuildChannel(
        membershipResult.value.membership.guildId,
        channel.value.id,
      )
      if (!registrationResult.success) {
        return await interaction.editReply(registrationResult.response)
      }

      return await interaction.editReply({
        content: this.formatSuccessMessage(
          channel.value.id,
          membershipResult.value.membership.guildName,
        ),
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error(
        "Error in register-anniversary-channel command:",
        error,
      )
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

    if (inputAllyCode) {
      // User selected from autocomplete
      return {
        success: true,
        response: { content: "" },
        value: inputAllyCode.replace(/-/g, ""),
      }
    }

    // No ally code provided, use main account
    const players = await container.backendApi.players.list({
      discordId: interaction.user.id,
      isMain: true,
    })

    const mainPlayer = players[0]
    if (!mainPlayer) {
      return {
        success: false,
        response: {
          content:
            "You don't have a registered ally code. Please register with `/register-player` first.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: mainPlayer.allyCode,
    }
  }

  private async validateAllyCodeOwnership(
    discordId: string,
    allyCode: string,
  ): Promise<CommandResponse> {
    const players = await container.backendApi.players.list({ discordId })
    const ownsAllyCode = players.some(
      (p: { allyCode: string }) => p.allyCode === allyCode,
    )

    if (!ownsAllyCode) {
      return {
        success: false,
        response: {
          content:
            "You can only register guilds using your own registered ally codes.",
        },
      }
    }

    return { success: true, response: { content: "" } }
  }

  private async getGuildMembership(
    allyCode: string,
  ): Promise<CommandResponse<GuildMembershipData>> {
    const membership =
      await container.backendApi.players.getGuildMembership(allyCode)

    if (!membership) {
      return {
        success: false,
        response: {
          content: `Player ${allyCode} is not a member of any registered guild. Please ensure the guild is registered with \`/register-guild\` first.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: { allyCode, membership },
    }
  }

  private async registerGuildChannel(
    guildId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      await container.backendApi.guilds.update(guildId, {
        anniversaryChannelId: channelId,
      })

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to register anniversary channel:", error)
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
    return `Successfully registered ${channelMention(channelId)} for anniversary notifications for guild: **${guildName}**`
  }
}
