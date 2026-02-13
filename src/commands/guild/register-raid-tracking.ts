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

export class RegisterRaidTrackingCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("register-raid-tracking")
          .setDescription("Register a guild for raid tracking with reminders")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Discord channel to post raid reminders")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Select one of your registered accounts")
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("api-key")
              .setDescription("Your Mhanndalorian Bot API key")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("reminder-hours")
              .setDescription('Hours before raid end to send reminders (comma-separated, e.g., "24,6")')
              .setRequired(false),
          ),
      { idHints: [] },
    )
  }

  public override async autocompleteRun(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "ally-code") {
      try {
        const players = await container.backendApi.players.list({
          discordId: interaction.user.id,
        })

        const choices = players.map((player: { name?: string; allyCode: string; isMain?: boolean }) => ({
          name: player.name
            ? `${player.name} (${player.allyCode})${player.isMain ? " - Main" : ""}`
            : `${player.allyCode}${player.isMain ? " - Main" : ""}`,
          value: player.allyCode,
        }))

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

      // Validate API key
      const apiKey = interaction.options.getString("api-key", true)
      if (!apiKey || apiKey.trim().length === 0) {
        return await interaction.reply({
          content: "Please provide a valid API key.",
          ephemeral: true,
        })
      }

      // Parse and validate reminder hours
      const reminderHoursResult = this.parseReminderHours(interaction)
      if (!reminderHoursResult.success || !reminderHoursResult.value) {
        return await interaction.reply(reminderHoursResult.response)
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
            "Only guild leaders and officers can register the guild for raid tracking.",
        })
      }

      // Register the guild channel via automations
      const registrationResult = await this.registerGuildAutomations(
        membershipResult.value.membership,
        channel.value.id,
        channel.value.name,
        allyCodeResult.value,
        apiKey,
        interaction.user.id,
        reminderHoursResult.value,
      )
      if (!registrationResult.success) {
        return await interaction.editReply(registrationResult.response)
      }

      return await interaction.editReply({
        content: this.formatSuccessMessage(
          channel.value.id,
          membershipResult.value.membership.guildName,
          reminderHoursResult.value,
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
        "Error in register-raid-tracking command:",
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

  private parseReminderHours(
    interaction: Command.ChatInputCommandInteraction,
  ): CommandResponse<number[]> {
    const reminderHoursStr = interaction.options.getString("reminder-hours") || "24,6"

    const reminderHours = reminderHoursStr
      .split(",")
      .map((h) => parseInt(h.trim()))
      .filter((h) => !isNaN(h) && h > 0)

    if (reminderHours.length === 0) {
      return {
        success: false,
        response: {
          content: 'Please provide valid reminder hours (e.g., "24,6").',
          ephemeral: true,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: reminderHours,
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
    const ownsAllyCode = players.some((p: { allyCode: string }) => p.allyCode === allyCode)

    if (!ownsAllyCode) {
      return {
        success: false,
        response: {
          content:
            "You can only register raid tracking using your own registered ally codes.",
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

  private async registerGuildAutomations(
    membership: PlayerGuildMembership,
    channelId: string,
    channelName: string,
    allyCode: string,
    apiKey: string,
    discordId: string,
    reminderHours: number[],
  ): Promise<CommandResponse> {
    try {
      // Get automations for this guild
      const automations = await container.backendApi.automations.listByGuild(membership.guildId)

      // Register the guild channel (or get existing)
      let guildChannel = await container.backendApi.guilds.findChannelByDiscordId(membership.guildId, channelId)
      if (!guildChannel) {
        guildChannel = await container.backendApi.guilds.addChannel(membership.guildId, {
          discordChannelId: channelId,
          name: channelName,
        })
      }

      // Find existing raid_collection automation or create new one
      const raidCollection = automations.find(a => a.automationType === 'raid_collection')
      if (raidCollection) {
        await container.backendApi.automations.update(raidCollection.id, {
          config: {
            allyCode,
            apiKey,
            discordId,
            reminderHours,
            guildChannelId: guildChannel.id,
          },
          enabled: true,
        })
      } else {
        await container.backendApi.automations.create({
          guildId: membership.guildId,
          automationType: 'raid_collection',
          config: {
            allyCode,
            apiKey,
            discordId,
            reminderHours,
            guildChannelId: guildChannel.id,
          },
          enabled: true,
        })
      }

      // Find existing raid_reminder automation or create new one
      const raidReminder = automations.find(a => a.automationType === 'raid_reminder')
      if (raidReminder) {
        await container.backendApi.automations.update(raidReminder.id, {
          config: {
            guildChannelId: guildChannel.id,
          },
          enabled: true,
        })
      } else {
        await container.backendApi.automations.create({
          guildId: membership.guildId,
          automationType: 'raid_reminder',
          config: {
            guildChannelId: guildChannel.id,
          },
          enabled: true,
        })
      }

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error(
        "Failed to register raid tracking channel:",
        error,
      )
      return {
        success: false,
        response: {
          content:
            "Failed to register raid tracking channel. Please try again later.",
        },
      }
    }
  }

  private formatSuccessMessage(
    channelId: string,
    guildName: string,
    reminderHours: number[],
  ): string {
    const reminderText = reminderHours.join("h, ") + "h"

    return `Successfully registered raid tracking for guild: **${guildName}**
Reminder channel: ${channelMention(channelId)}
Reminders will be sent ${reminderText} before raid ends.

**Important:** Raid data collection will disconnect you from the game. This happens once per day and before each reminder.`
  }
}
