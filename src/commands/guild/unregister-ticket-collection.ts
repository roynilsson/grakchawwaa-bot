import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import type { AutocompleteInteraction } from "discord.js"
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

export class UnregisterTicketCollectionCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("unregister-ticket-collection")
          .setDescription(
            "Unregister a guild from ticket collection monitoring",
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Select one of your registered accounts")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      { idHints: ["1371170913122517124"] },
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
            "Only guild leaders and officers can unregister the guild from ticket monitoring.",
        })
      }

      // Unregister the guild channel
      const unregistrationResult = await this.unregisterGuildChannel(
        membershipResult.value.membership.guildId,
      )
      if (!unregistrationResult.success) {
        return await interaction.editReply(unregistrationResult.response)
      }

      return await interaction.editReply({
        content: `Successfully unregistered **${membershipResult.value.membership.guildName}** from ticket collection monitoring.`,
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
        "Error in unregister-ticket-collection command:",
        error,
      )
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
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
            "You can only unregister guilds using your own registered ally codes.",
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
          content: `Player ${allyCode} is not a member of any registered guild.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: { allyCode, membership },
    }
  }

  private async unregisterGuildChannel(
    guildId: string,
  ): Promise<CommandResponse> {
    try {
      await container.backendApi.guilds.update(guildId, {
        ticketCollectionChannelId: null,
        nextTicketCollectionRefreshTime: null,
        ticketReminderChannelId: null,
      })

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error(
        "Failed to unregister ticket collection channel:",
        error,
      )
      return {
        success: false,
        response: {
          content:
            "Failed to unregister ticket collection channel. Please try again later.",
        },
      }
    }
  }
}
