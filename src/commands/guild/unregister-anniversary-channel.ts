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

export class UnregisterAnniversaryChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("unregister-anniversary-channel")
          .setDescription(
            "Unregister a guild from anniversary notifications",
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Select one of your registered accounts")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      { idHints: ["1374809370524782695"] },
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
            "Only guild leaders and officers can unregister the guild from anniversary notifications.",
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
        content: `Successfully unregistered **${membershipResult.value.membership.guildName}** from anniversary notifications.`,
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
        "Error in unregister-anniversary-channel command:",
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
      // Find the anniversary automation for this guild
      const automations = await container.backendApi.automations.listByGuild(guildId)
      const anniversaryAutomation = automations.find(
        (a) => a.automationType === "anniversary",
      )

      if (!anniversaryAutomation) {
        return {
          success: false,
          response: {
            content:
              "Anniversary automation not found for this guild. Please contact support.",
          },
        }
      }

      // Update the automation config to clear the guild channel ID
      const config = { ...anniversaryAutomation.config } as Record<string, unknown>
      delete config.guildChannelId
      await container.backendApi.automations.update(anniversaryAutomation.id, {
        config,
      })

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error(
        "Failed to unregister anniversary channel:",
        error,
      )
      return {
        success: false,
        response: {
          content:
            "Failed to unregister anniversary channel. Please try again later.",
        },
      }
    }
  }
}
