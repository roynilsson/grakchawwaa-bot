import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import {
  channelMention,
  roleMention,
  TextChannel,
  Role,
  type AutocompleteInteraction,
} from "discord.js"
import type { Player, PlayerGuildMembership } from "../api/player-client"
import type { LeaveType } from "../api/leave-client"
import { buildPlayerWarningSummaryEmbed } from "../utils/warning-embed"

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
            { name: "role-add", chatInputRun: "chatInputRoleAdd" },
            { name: "role-remove", chatInputRun: "chatInputRoleRemove" },
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
        {
          name: "warnings",
          chatInputRun: "chatInputWarningsPlayer",
        },
        {
          name: "leave-create",
          chatInputRun: "chatInputLeaveCreate",
        },
        {
          name: "leave-list",
          chatInputRun: "chatInputLeaveList",
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
            )
            .addSubcommand((sub) =>
              sub
                .setName("role-add")
                .setDescription("Pre-approve a Discord role for bot use")
                .addRoleOption((option) =>
                  option
                    .setName("role")
                    .setDescription("Discord role to register")
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
                .setName("role-remove")
                .setDescription(
                  "Remove a pre-approved Discord role from bot use",
                )
                .addRoleOption((option) =>
                  option
                    .setName("role")
                    .setDescription("Discord role to unregister")
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
        )
        .addSubcommand((sub) =>
          sub
            .setName("warnings")
            .setDescription("View warning history for a guild member (Officers/Leaders only)")
            .addStringOption((option) =>
              option
                .setName("player")
                .setDescription("Guild member to view warnings for")
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addIntegerOption((option) =>
              option
                .setName("days")
                .setDescription("Number of days to look back (default: 30, max: 365)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365),
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
            .setName("leave-create")
            .setDescription("Create a leave of absence for a guild member")
            .addStringOption((option) =>
              option
                .setName("player")
                .setDescription("Guild member to create leave for")
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName("start-date")
                .setDescription("Start date (YYYY-MM-DD)")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("end-date")
                .setDescription("End date (YYYY-MM-DD)")
                .setRequired(true),
            )
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Leave type (default: away)")
                .setRequired(false)
                .addChoices(
                  { name: "Away - Fully unavailable", value: "away" },
                  { name: "Busy - May be unreliable", value: "busy" },
                ),
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
            .setName("leave-list")
            .setDescription("View leaves of absence for guild members")
            .addStringOption((option) =>
              option
                .setName("player")
                .setDescription("Filter by guild member (optional)")
                .setRequired(false)
                .setAutocomplete(true),
            )
            .addBooleanOption((option) =>
              option
                .setName("active-only")
                .setDescription("Only show active/upcoming leaves (default: true)")
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
  // /officer setup role-add
  // ============================================
  public async chatInputRoleAdd(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const role = this.validateRole(interaction)
      if (!role.success || !role.value) {
        return await interaction.reply(role.response)
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
            "Only guild leaders and officers can register roles for the guild.",
        })
      }

      const registrationResult = await this.registerRole(
        membership.guildId,
        role.value.id,
        role.value.name,
        player.allyCode,
      )
      if (!registrationResult.success) {
        return await interaction.editReply(registrationResult.response)
      }

      return await interaction.editReply({
        content: `Role ${roleMention(role.value.id)} has been registered for guild **${membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in role-add command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer setup role-remove
  // ============================================
  public async chatInputRoleRemove(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const role = this.validateRole(interaction)
      if (!role.success || !role.value) {
        return await interaction.reply(role.response)
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
            "Only guild leaders and officers can unregister roles from the guild.",
        })
      }

      const unregistrationResult = await this.unregisterRole(
        membership.guildId,
        role.value.id,
        player.allyCode,
      )
      if (!unregistrationResult.success) {
        return await interaction.editReply(unregistrationResult.response)
      }

      return await interaction.editReply({
        content: `Role ${roleMention(role.value.id)} has been unregistered from guild **${membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in role-remove command:", error)
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

  // ============================================
  // /officer warnings
  // ============================================
  public async chatInputWarningsPlayer(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3 && !membership.isAdmin) {
        return await interaction.editReply({
          content: "Only guild leaders, officers, and admins can view other players' warnings.",
        })
      }

      // Get command options
      const targetAllyCode = interaction.options.getString("player", true)
      const days = interaction.options.getInteger("days") ?? 30

      // Validate target is in guild
      try {
        await container.backendApi.guilds.getMember(
          membership.guildId,
          targetAllyCode,
        )
      } catch {
        return await interaction.editReply({
          content: "Player not found in your guild.",
        })
      }

      // Fetch warning summary
      const summary = await container.backendApi.warnings.getPlayerSummary(
        membership.guildId,
        targetAllyCode,
        days,
        player.allyCode,
      )

      // Build and send embed
      const embed = buildPlayerWarningSummaryEmbed(summary)
      return await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content: "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in warnings command:", error)
      return await interaction.editReply({
        content: "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer leave-create
  // ============================================
  public async chatInputLeaveCreate(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3 && !membership.isAdmin) {
        return await interaction.editReply({
          content: "Only guild leaders, officers, and admins can create leaves for members.",
        })
      }

      // Get command options
      const targetAllyCode = interaction.options.getString("player", true)
      const startDateInput = interaction.options.getString("start-date", true)
      const endDateInput = interaction.options.getString("end-date", true)
      const leaveType = (interaction.options.getString("type") as LeaveType) ?? "away"
      const note = interaction.options.getString("note") ?? undefined

      // Parse dates
      const startDate = this.parseDate(startDateInput)
      const endDate = this.parseDate(endDateInput)

      if (!startDate) {
        return await interaction.editReply({
          content: "Invalid start date format. Use YYYY-MM-DD (e.g., 2026-03-20).",
        })
      }

      if (!endDate) {
        return await interaction.editReply({
          content: "Invalid end date format. Use YYYY-MM-DD (e.g., 2026-03-25).",
        })
      }

      if (startDate > endDate) {
        return await interaction.editReply({
          content: "Start date must be before or equal to end date.",
        })
      }

      // Validate target is in guild
      let targetMember
      try {
        targetMember = await container.backendApi.guilds.getMember(
          membership.guildId,
          targetAllyCode,
        )
      } catch {
        return await interaction.editReply({
          content: "Player not found in your guild.",
        })
      }

      // Create the leave
      const leave = await container.backendApi.leaves.create(
        membership.guildId,
        {
          playerAllyCode: targetAllyCode,
          startDate,
          endDate,
          leaveType,
          note,
        },
        player.allyCode,
      )

      const playerName = targetMember.player.name || targetAllyCode
      const typeLabel = leave.leaveType === "away" ? "Away" : "Busy"

      let response = `Created leave for **${playerName}**:\n`
      response += `**Type:** ${typeLabel}\n`
      response += `**From:** ${startDate}\n`
      response += `**To:** ${endDate}\n`
      if (leave.note) {
        response += `**Note:** ${leave.note}`
      }

      return await interaction.editReply({ content: response })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content: "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in leave-create command:", error)
      return await interaction.editReply({
        content: `Failed to create leave. ${(error as Error).message}`,
      })
    }
  }

  // ============================================
  // /officer leave-list
  // ============================================
  public async chatInputLeaveList(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const result = await this.resolvePlayerWithMembership(interaction)
      if (!result.success || !result.value) {
        return await interaction.editReply(result.response)
      }

      const { player, membership } = result.value
      if (membership.memberLevel < 3 && !membership.isAdmin) {
        return await interaction.editReply({
          content: "Only guild leaders, officers, and admins can view all guild leaves.",
        })
      }

      // Get command options
      const targetAllyCode = interaction.options.getString("player")?.replace(/-/g, "")
      const activeOnly = interaction.options.getBoolean("active-only") ?? true

      // Fetch leaves
      const leaves = await container.backendApi.leaves.listByGuild(
        membership.guildId,
        { active: activeOnly },
        { callerAllyCode: player.allyCode },
      )

      // Filter by player if specified
      const filteredLeaves = targetAllyCode
        ? leaves.filter((l) => l.playerAllyCode === targetAllyCode)
        : leaves

      if (filteredLeaves.length === 0) {
        const msg = activeOnly
          ? "No active or upcoming leaves found."
          : "No leaves found."
        return await interaction.editReply({ content: msg })
      }

      // Format response
      let response = `**Guild Leaves**${activeOnly ? " (Active/Upcoming)" : ""}:\n\n`

      for (const leave of filteredLeaves.slice(0, 15)) {
        const typeIcon = leave.leaveType === "away" ? "🚫" : "⚠️"
        const playerName = leave.playerName || leave.playerAllyCode || "Unknown"
        const startDate = leave.startDate.split("T")[0]
        const endDate = leave.endDate.split("T")[0]
        response += `${typeIcon} **${playerName}:** ${startDate} to ${endDate}`
        if (leave.note) {
          const truncatedNote =
            leave.note.length > 40 ? leave.note.slice(0, 40) + "..." : leave.note
          response += ` - ${truncatedNote}`
        }
        response += "\n"
      }

      if (filteredLeaves.length > 15) {
        response += `\n_...and ${filteredLeaves.length - 15} more_`
      }

      return await interaction.editReply({ content: response })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content: "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in leave-list command:", error)
      return await interaction.editReply({
        content: `Failed to fetch leaves. ${(error as Error).message}`,
      })
    }
  }

  private parseDate(input: string): string | null {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null

    const year = parseInt(match[1]!, 10)
    const month = parseInt(match[2]!, 10)
    const day = parseInt(match[3]!, 10)

    if (month < 1 || month > 12) return null
    if (day < 1 || day > 31) return null
    if (year < 2020 || year > 2100) return null

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
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

  private validateRole(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): CommandResponse<Role> {
    const role = interaction.options.getRole("role")
    if (!role || !(role instanceof Role)) {
      return {
        success: false,
        response: {
          content: "Please provide a valid role.",
          ephemeral: true,
        },
      }
    }
    return {
      success: true,
      response: { content: "" },
      value: role,
    }
  }

  private async registerRole(
    guildId: string,
    discordRoleId: string,
    roleName: string,
    callerAllyCode: string,
  ): Promise<CommandResponse> {
    try {
      const existingRole =
        await container.backendApi.guilds.findRoleByDiscordId(
          guildId,
          discordRoleId,
          callerAllyCode,
        )

      if (existingRole) {
        return {
          success: false,
          response: {
            content: "This role is already registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.addRole(
        guildId,
        {
          discordRoleId,
          name: roleName,
        },
        callerAllyCode,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to register role:", error)
      return {
        success: false,
        response: {
          content: "Failed to register role. Please try again later.",
        },
      }
    }
  }

  private async unregisterRole(
    guildId: string,
    discordRoleId: string,
    callerAllyCode: string,
  ): Promise<CommandResponse> {
    try {
      const registeredRole =
        await container.backendApi.guilds.findRoleByDiscordId(
          guildId,
          discordRoleId,
          callerAllyCode,
        )

      if (!registeredRole) {
        return {
          success: false,
          response: {
            content: "This role is not registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.removeRole(
        guildId,
        registeredRole.id,
        callerAllyCode,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to unregister role:", error)
      return {
        success: false,
        response: {
          content: "Failed to unregister role. Please try again later.",
        },
      }
    }
  }
}
