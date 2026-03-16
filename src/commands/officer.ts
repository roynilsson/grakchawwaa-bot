import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import {
  channelMention,
  TextChannel,
  type AutocompleteInteraction,
} from "discord.js"
import type { Player, PlayerGuildMembership } from "../api/player-client"

interface CommandResponse<T = undefined> {
  success: boolean
  response: {
    content: string
    ephemeral?: boolean
  }
  value?: T
}

interface PlayerWithMembership {
  player: Player
  membership: PlayerGuildMembership
}

export class OfficerCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "officer",
      subcommands: [
        {
          name: "setup",
          type: "group",
          entries: [
            { name: "register-guild", chatInputRun: "chatInputRegisterGuild" },
            { name: "channel-add", chatInputRun: "chatInputChannelAdd" },
            { name: "channel-remove", chatInputRun: "chatInputChannelRemove" },
          ],
        },
        {
          name: "warn",
          chatInputRun: "chatInputWarn",
        },
        {
          name: "warning-summary",
          chatInputRun: "chatInputWarningSummary",
        },
      ],
    })
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("officer")
        .setDescription("Officer-only guild management commands")
        .addSubcommandGroup((group) =>
          group
            .setName("setup")
            .setDescription("Guild setup and channel management")
            .addSubcommand((sub) =>
              sub
                .setName("register-guild")
                .setDescription(
                  "Register your guild with the bot (Officers/Leaders only)",
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName("channel-add")
                .setDescription("Pre-approve a Discord channel for bot use")
                .addChannelOption((option) =>
                  option
                    .setName("channel")
                    .setDescription("Discord channel to register")
                    .setRequired(true),
                )
                .addStringOption((option) =>
                  option
                    .setName("ally-code")
                    .setDescription("Select one of your registered accounts")
                    .setRequired(false)
                    .setAutocomplete(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName("channel-remove")
                .setDescription(
                  "Remove a pre-approved Discord channel from bot use",
                )
                .addChannelOption((option) =>
                  option
                    .setName("channel")
                    .setDescription("Discord channel to unregister")
                    .setRequired(true),
                )
                .addStringOption((option) =>
                  option
                    .setName("ally-code")
                    .setDescription("Select one of your registered accounts")
                    .setRequired(false)
                    .setAutocomplete(true),
                ),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("warn")
            .setDescription(
              "Issue a warning to a guild member (Officers/Leaders only)",
            )
            .addStringOption((option) =>
              option
                .setName("player")
                .setDescription("Guild member to warn")
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Warning type")
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName("note")
                .setDescription("Optional note (max 500 chars)")
                .setRequired(false)
                .setMaxLength(500),
            )
            .addStringOption((option) =>
              option
                .setName("ally-code")
                .setDescription("Select one of your registered accounts")
                .setRequired(false)
                .setAutocomplete(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("warning-summary")
            .setDescription("Show warning point summary for guild members")
            .addIntegerOption((option) =>
              option
                .setName("limit")
                .setDescription("Number of players to show (default: 10)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50),
            )
            .addStringOption((option) =>
              option
                .setName("periods")
                .setDescription("Comma-separated days, e.g., 30,90,180 (default)")
                .setRequired(false),
            )
            .addStringOption((option) =>
              option
                .setName("ally-code")
                .setDescription("Select one of your registered accounts")
                .setRequired(false)
                .setAutocomplete(true),
            ),
        ),
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

    if (focusedOption.name === "player" || focusedOption.name === "type") {
      try {
        // Get the user's main player to determine guild
        const players = await container.backendApi.players.list({
          discordId: interaction.user.id,
          isMain: true,
        })

        const mainPlayer = players?.[0]
        if (!mainPlayer) {
          return interaction.respond([])
        }

        // Check guild membership (now embedded in player)
        if (!mainPlayer.guildMembership) {
          return interaction.respond([])
        }
        const membership = mainPlayer.guildMembership

        if (focusedOption.name === "player") {
          // Fetch guild members and filter by search
          const members = await container.backendApi.guilds.getMembers(
            membership.guildId,
          )
          const search = focusedOption.value.toLowerCase()
          const filtered = members
            .filter(
              (m: { player: { name?: string; allyCode: string } }) =>
                m.player.name?.toLowerCase().includes(search) ||
                m.player.allyCode.includes(search),
            )
            .slice(0, 25)

          const choices = filtered.map(
            (m: { player: { name?: string; allyCode: string } }) => ({
              name: m.player.name
                ? `${m.player.name} (${m.player.allyCode})`
                : m.player.allyCode,
              value: m.player.allyCode,
            }),
          )

          return interaction.respond(choices)
        }

        if (focusedOption.name === "type") {
          // Fetch warning types with search parameter
          const search = focusedOption.value || undefined
          const types = await container.backendApi.warnings.getTypes(
            membership.guildId,
            search,
            mainPlayer.allyCode,
          )

          const choices = types.slice(0, 25).map(
            (t: {
              id: number
              name: string
              severity: number
              category?: { id: number; name: string } | null
            }) => ({
              name: t.category
                ? `[${t.category.name}] ${t.name} (Severity: ${t.severity})`
                : `${t.name} (Severity: ${t.severity})`,
              value: t.id.toString(),
            }),
          )

          return interaction.respond(choices)
        }
      } catch {
        return interaction.respond([])
      }
    }
  }

  // ============================================
  // /officer setup register-guild
  // ============================================
  public async chatInputRegisterGuild(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
        isMain: true,
      })

      const mainPlayer = players?.[0]
      if (!mainPlayer) {
        return await interaction.editReply({
          content:
            "You don't have a registered main account. Please use `/player register <ally-code>` first.",
        })
      }

      const allyCode = mainPlayer.allyCode

      const verification =
        await container.backendApi.guilds.verifyRegistration(allyCode)

      if (!verification.canRegister) {
        return await interaction.editReply({
          content:
            verification.message || "Failed to verify guild registration.",
        })
      }

      try {
        await container.backendApi.guilds.create(
          {
            guildId: verification.guildId!,
            name: verification.guildName!,
          },
          allyCode,
        )

        return await interaction.editReply({
          content: `Successfully registered guild **${verification.guildName}** with the bot!\n\nYou can now configure automations and channels via the web dashboard.`,
        })
      } catch (error) {
        const errorMessage = (error as Error).message

        if (errorMessage.includes("already registered")) {
          return await interaction.editReply({
            content: `Guild **${verification.guildName}** is already registered with the bot.\n\nYou can configure automations and channels via the web dashboard.`,
          })
        }

        console.error("Failed to register guild:", error)
        return await interaction.editReply({
          content: "Failed to register guild. Please try again later.",
        })
      }
    } catch (error) {
      console.error("Error in register-guild command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while registering your guild. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer setup channel-add
  // ============================================
  public async chatInputChannelAdd(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can register channels for the guild.",
        })
      }

      const registrationResult = await this.registerChannel(
        membership.guildId,
        channel.value.id,
        channel.value.name,
        player.allyCode,
      )
      if (!registrationResult.success) {
        return await interaction.editReply(registrationResult.response)
      }

      return await interaction.editReply({
        content: `Channel ${channelMention(channel.value.id)} has been registered for guild **${membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in channel-add command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer setup channel-remove
  // ============================================
  public async chatInputChannelRemove(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can unregister channels from the guild.",
        })
      }

      const unregistrationResult = await this.unregisterChannel(
        membership.guildId,
        channel.value.id,
        player.allyCode,
      )
      if (!unregistrationResult.success) {
        return await interaction.editReply(unregistrationResult.response)
      }

      return await interaction.editReply({
        content: `Channel ${channelMention(channel.value.id)} has been unregistered from guild **${membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in channel-remove command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer warn
  // ============================================
  public async chatInputWarn(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3) {
        return await interaction.editReply({
          content: "Only guild leaders and officers can issue warnings.",
        })
      }

      // Get command options
      const playerAllyCode = interaction.options.getString("player", true)
      const warningTypeId = parseInt(
        interaction.options.getString("type", true),
        10,
      )
      const note = interaction.options.getString("note") ?? undefined

      // Validate player exists in guild
      let targetMember
      try {
        targetMember = await container.backendApi.guilds.getMember(
          membership.guildId,
          playerAllyCode,
        )
      } catch {
        return await interaction.editReply({
          content: "Player not found in your guild.",
        })
      }

      // Issue the warning
      try {
        const warning = await container.backendApi.warnings.issue({
          guildId: membership.guildId,
          playerId: playerAllyCode,
          warningTypeId,
          note,
          issuedBy: player.allyCode,
          callerAllyCode: player.allyCode,
        })

        const playerName = targetMember.player.name || playerAllyCode
        let response = `Warned **${playerName}** with **${warning.warningType.name}** (Severity: ${warning.warningType.severity})`

        if (note) {
          const truncatedNote =
            note.length > 100 ? note.slice(0, 100) + "..." : note
          response += `\nNote: ${truncatedNote}`
        }

        return await interaction.editReply({ content: response })
      } catch (error) {
        container.logger.error("Failed to issue warning:", error)
        return await interaction.editReply({
          content: "Failed to issue warning. Please try again later.",
        })
      }
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in warn command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer warning-summary
  // ============================================
  public async chatInputWarningSummary(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3) {
        return await interaction.editReply({
          content: "Only guild leaders and officers can view warning summaries.",
        })
      }

      // Get command options
      const limit = interaction.options.getInteger("limit") ?? 10
      const periodsStr = interaction.options.getString("periods")
      const periods = periodsStr
        ? periodsStr
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0)
        : [30, 90, 180]

      if (periods.length === 0) {
        return await interaction.editReply({
          content:
            "Invalid periods format. Use comma-separated numbers, e.g., 30,90,180",
        })
      }

      // Fetch summary from backend
      const summary = await container.backendApi.warnings.getSummary(
        membership.guildId,
        periods,
        limit,
        { callerAllyCode: player.allyCode },
      )

      // Format response
      const message = this.formatWarningSummary(
        membership.guildName ?? "Guild",
        summary,
        limit,
      )
      return await interaction.editReply({ content: message })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in warning-summary command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  private formatWarningSummary(
    guildName: string,
    summary: {
      periods: number[]
      basePeriod: number
      players: Array<{
        allyCode: string
        name: string | null
        values: number[]
      }>
    },
    limit: number,
  ): string {
    const lines: string[] = []

    lines.push(`**Warning Summary for ${guildName}** (Top ${limit})`)
    lines.push("")
    lines.push("```")

    // Build header
    const headers = ["Player"]
    for (let i = 0; i < summary.periods.length; i++) {
      const period = summary.periods[i]
      if (i === 0) {
        headers.push(`${period}d`)
      } else {
        headers.push(`${period}d avg`)
      }
    }

    // Calculate column widths
    const colWidths = headers.map((h, i) => {
      if (i === 0) return 16 // Player name column
      return Math.max(h.length, 5)
    })

    // Format header row
    const headerRow = headers.map((h, i) => h.padEnd(colWidths[i]!)).join(" | ")
    lines.push(headerRow)
    lines.push(colWidths.map((w) => "-".repeat(w)).join("-+-"))

    // Format player rows
    if (summary.players.length === 0) {
      lines.push("No warnings in the selected period")
    } else {
      for (const player of summary.players) {
        const name = (player.name || player.allyCode).substring(0, 16).padEnd(16)
        const values = player.values.map((v, i) =>
          String(v).padStart(colWidths[i + 1]!),
        )
        lines.push(`${name} | ${values.join(" | ")}`)
      }
    }

    lines.push("```")
    lines.push(`Generated: ${new Date().toISOString().split("T")[0]}`)

    return lines.join("\n")
  }

  // ============================================
  // Helper methods
  // ============================================
  private validateChannel(
    interaction: Subcommand.ChatInputCommandInteraction,
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

  /**
   * Resolves player and guild membership in a single API call.
   * - If ally-code option provided: validates caller owns it
   * - If no ally-code: uses caller's main player
   * - Returns player with guild membership data
   */
  private async resolvePlayerWithMembership(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<CommandResponse<PlayerWithMembership>> {
    const inputAllyCode = interaction.options.getString("ally-code")?.replace(/-/g, "")
    const discordId = interaction.user.id

    // Fetch all players for this Discord user (single API call)
    const players = await container.backendApi.players.list({ discordId })

    if (players.length === 0) {
      return {
        success: false,
        response: {
          content:
            "You don't have a registered ally code. Please register with `/player register` first.",
        },
      }
    }

    // Find the target player
    let player: Player
    if (inputAllyCode) {
      // Validate caller owns the specified ally code
      const found = players.find((p) => p.allyCode === inputAllyCode)
      if (!found) {
        return {
          success: false,
          response: {
            content:
              "You can only manage channels for guilds using your own registered ally codes.",
          },
        }
      }
      player = found
    } else {
      // Use main player or first player (we know players.length > 0 from check above)
      player = players.find((p) => p.isMain) ?? players[0]!
    }

    // Check guild membership
    if (!player.guildMembership) {
      return {
        success: false,
        response: {
          content: `Player ${player.allyCode} is not a member of any registered guild. Please ensure the guild is registered with \`/officer setup register-guild\` first.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: { player, membership: player.guildMembership },
    }
  }

  private async registerChannel(
    guildId: string,
    discordChannelId: string,
    channelName: string,
    callerAllyCode: string,
  ): Promise<CommandResponse> {
    try {
      const existingChannel =
        await container.backendApi.guilds.findChannelByDiscordId(
          guildId,
          discordChannelId,
          callerAllyCode,
        )

      if (existingChannel) {
        return {
          success: false,
          response: {
            content: "This channel is already registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.addChannel(
        guildId,
        {
          discordChannelId,
          name: channelName,
        },
        callerAllyCode,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to register channel:", error)
      return {
        success: false,
        response: {
          content: "Failed to register channel. Please try again later.",
        },
      }
    }
  }

  private async unregisterChannel(
    guildId: string,
    discordChannelId: string,
    callerAllyCode: string,
  ): Promise<CommandResponse> {
    try {
      const registeredChannel =
        await container.backendApi.guilds.findChannelByDiscordId(
          guildId,
          discordChannelId,
          callerAllyCode,
        )

      if (!registeredChannel) {
        return {
          success: false,
          response: {
            content: "This channel is not registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.removeChannel(
        guildId,
        registeredChannel.id,
        callerAllyCode,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to unregister channel:", error)
      return {
        success: false,
        response: {
          content: "Failed to unregister channel. Please try again later.",
        },
      }
    }
  }
}
