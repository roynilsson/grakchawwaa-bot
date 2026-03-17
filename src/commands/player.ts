import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import { AutocompleteInteraction, userMention } from "discord.js"
import { normalizeAllyCode, formatAllyCode } from "../utils/ally-code"
import { buildPlayerWarningSummaryEmbed } from "../utils/warning-embed"
import type { LeaveType } from "../api/leave-client"

export class PlayerCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "player",
      subcommands: [
        { name: "register", chatInputRun: "chatInputRegister" },
        { name: "unregister", chatInputRun: "chatInputUnregister" },
        { name: "identify", chatInputRun: "chatInputIdentify" },
        { name: "warnings", chatInputRun: "chatInputWarnings" },
        { name: "leave-create", chatInputRun: "chatInputLeaveCreate" },
        { name: "leave-list", chatInputRun: "chatInputLeaveList" },
        { name: "leave-delete", chatInputRun: "chatInputLeaveDelete" },
      ],
    })
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("player")
        .setDescription("Player account management")
        .addSubcommand((sub) =>
          sub
            .setName("register")
            .setDescription("Register a player with an ally code")
            .addStringOption((option) =>
              option
                .setName("ally-code")
                .setDescription("Ally code to register")
                .setRequired(true),
            )
            .addBooleanOption((option) =>
              option
                .setName("is-alt")
                .setDescription("Mark the ally code as an alternate")
                .setRequired(false),
            )
            .addUserOption((option) =>
              option
                .setName("discord-user")
                .setDescription("Discord user to register")
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("unregister")
            .setDescription("Unregister a player by ally code")
            .addStringOption((option) =>
              option
                .setName("ally-code")
                .setDescription("Ally code to unregister")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("identify")
            .setDescription("Show your registered ally codes"),
        )
        .addSubcommand((sub) =>
          sub
            .setName("warnings")
            .setDescription("View your warning history and summary")
            .addIntegerOption((option) =>
              option
                .setName("days")
                .setDescription(
                  "Number of days to look back (default: 30, max: 365)",
                )
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
            .setDescription("Create a new leave of absence")
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
            .setDescription("View your leaves of absence")
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
        )
        .addSubcommand((sub) =>
          sub
            .setName("leave-delete")
            .setDescription("Delete a leave of absence")
            .addIntegerOption((option) =>
              option
                .setName("leave-id")
                .setDescription("ID of the leave to delete")
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
  }

  public async chatInputRegister(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)
    const isAlt = interaction.options.getBoolean("is-alt") ?? false
    const targetUser =
      interaction.options.getUser("discord-user") ?? interaction.user
    const targetTag = userMention(targetUser.id)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    await interaction.deferReply()

    console.log(
      "Received register player command",
      normalizedAllyCode,
      "isAlt:",
      isAlt,
    )

    try {
      let player
      try {
        player = await container.backendApi.players.get(normalizedAllyCode)
      } catch {
        player = null
      }

      const accountType = isAlt ? "alternate" : "main"
      const requesterNote =
        targetUser.id === interaction.user.id
          ? ""
          : ` (requested by ${userMention(interaction.user.id)})`

      if (player) {
        await container.backendApi.players.update(normalizedAllyCode, {
          discordId: targetUser.id,
          discordUsername: targetUser.username,
          isMain: !isAlt,
        })

        return interaction.editReply({
          content: `Updated ${accountType} account with ally code ${normalizedAllyCode} for ${targetTag}${requesterNote}.`,
        })
      } else {
        await container.backendApi.players.create({
          allyCode: normalizedAllyCode,
          discordId: targetUser.id,
          discordUsername: targetUser.username,
          isMain: !isAlt,
        })

        return interaction.editReply({
          content: `Registered ${accountType} account with ally code ${normalizedAllyCode} for ${targetTag}${requesterNote}.`,
        })
      }
    } catch (error) {
      console.error("Error registering player:", error)
      return interaction.editReply({
        content: `Failed to register ally code. ${(error as Error).message}`,
      })
    }
  }

  public async chatInputUnregister(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    await interaction.deferReply()

    try {
      await container.backendApi.players.delete(normalizedAllyCode)

      const userCallerToMention = userMention(interaction.user.id)
      return interaction.editReply({
        content: `Unregistered player with ally code ${normalizedAllyCode} for ${userCallerToMention}`,
      })
    } catch (error) {
      console.error("Error unregistering player:", error)
      return interaction.editReply({
        content: `Failed to unregister ally code. ${(error as Error).message}`,
      })
    }
  }

  public async chatInputIdentify(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply()

    try {
      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
      })

      if (!players || players.length === 0) {
        return interaction.editReply({
          content: "You have no registered ally codes.",
        })
      }

      const userCallerToMention = userMention(interaction.user.id)
      const mainPlayer = players.find((p) => p.isMain)
      const altPlayers = players.filter((p) => !p.isMain)

      const lines = [`Registered ally codes for ${userCallerToMention}:`]

      if (mainPlayer) {
        lines.push(`Main: ${formatAllyCode(mainPlayer.allyCode)}`)
      }

      if (altPlayers.length > 0) {
        const altCodes = altPlayers
          .map((p) => formatAllyCode(p.allyCode))
          .join(", ")
        lines.push(`Alts: ${altCodes}`)
      }

      return interaction.editReply({
        content: lines.join("\n"),
      })
    } catch (error) {
      console.error("Error identifying player:", error)
      return interaction.editReply({
        content: `Failed to identify player. ${(error as Error).message}`,
      })
    }
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

  public async chatInputWarnings(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: true })

    try {
      const days = interaction.options.getInteger("days") ?? 30
      const inputAllyCode = interaction.options
        .getString("ally-code")
        ?.replace(/-/g, "")

      // Get caller's players
      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
      })

      if (players.length === 0) {
        return interaction.editReply({
          content:
            "You don't have any registered ally codes. Use `/player register` first.",
        })
      }

      // Find target player
      const player = inputAllyCode
        ? players.find((p) => p.allyCode === inputAllyCode)
        : (players.find((p) => p.isMain) ?? players[0])

      if (!player) {
        return interaction.editReply({
          content:
            "You can only view warnings for your own registered ally codes.",
        })
      }

      // Check guild membership
      if (!player.guildMembership) {
        return interaction.editReply({
          content: `Player ${player.allyCode} is not a member of any registered guild.`,
        })
      }

      // Fetch warning summary
      const summary = await container.backendApi.warnings.getPlayerSummary(
        player.guildMembership.guildId,
        player.allyCode,
        days,
        player.allyCode,
      )

      // Build and send embed
      const embed = buildPlayerWarningSummaryEmbed(summary)
      return interaction.editReply({ embeds: [embed] })
    } catch (error) {
      console.error("Error in warnings command:", error)
      return interaction.editReply({
        content: `Failed to fetch warnings. ${(error as Error).message}`,
      })
    }
  }

  // ============================================
  // /player leave-create
  // ============================================
  public async chatInputLeaveCreate(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const inputAllyCode = interaction.options
        .getString("ally-code")
        ?.replace(/-/g, "")

      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
      })

      if (players.length === 0) {
        return interaction.editReply({
          content:
            "You don't have any registered ally codes. Use `/player register` first.",
        })
      }

      const player = inputAllyCode
        ? players.find((p) => p.allyCode === inputAllyCode)
        : (players.find((p) => p.isMain) ?? players[0])

      if (!player) {
        return interaction.editReply({
          content:
            "You can only create leaves for your own registered ally codes.",
        })
      }

      if (!player.guildMembership) {
        return interaction.editReply({
          content: `Player ${player.allyCode} is not a member of any registered guild.`,
        })
      }

      // Parse dates
      const startDateInput = interaction.options.getString("start-date", true)
      const endDateInput = interaction.options.getString("end-date", true)

      const startDate = this.parseDate(startDateInput)
      const endDate = this.parseDate(endDateInput)

      if (!startDate) {
        return interaction.editReply({
          content: "Invalid start date format. Use YYYY-MM-DD (e.g., 2026-03-20).",
        })
      }

      if (!endDate) {
        return interaction.editReply({
          content: "Invalid end date format. Use YYYY-MM-DD (e.g., 2026-03-25).",
        })
      }

      if (startDate > endDate) {
        return interaction.editReply({
          content: "Start date must be before or equal to end date.",
        })
      }

      const leaveType =
        (interaction.options.getString("type") as LeaveType) ?? "away"
      const note = interaction.options.getString("note") ?? undefined

      // Create the leave
      const leave = await container.backendApi.leaves.create(
        player.guildMembership.guildId,
        {
          playerAllyCode: player.allyCode,
          startDate,
          endDate,
          leaveType,
          note,
        },
        player.allyCode,
      )

      const typeLabel = leave.leaveType === "away" ? "Away" : "Busy"
      let response = `Created leave of absence:\n`
      response += `**Type:** ${typeLabel}\n`
      response += `**From:** ${startDate}\n`
      response += `**To:** ${endDate}\n`
      if (leave.note) {
        response += `**Note:** ${leave.note}`
      }

      return interaction.editReply({ content: response })
    } catch (error) {
      console.error("Error creating leave:", error)
      return interaction.editReply({
        content: `Failed to create leave. ${(error as Error).message}`,
      })
    }
  }

  // ============================================
  // /player leave-list
  // ============================================
  public async chatInputLeaveList(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const inputAllyCode = interaction.options
        .getString("ally-code")
        ?.replace(/-/g, "")
      const activeOnly = interaction.options.getBoolean("active-only") ?? true

      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
      })

      if (players.length === 0) {
        return interaction.editReply({
          content:
            "You don't have any registered ally codes. Use `/player register` first.",
        })
      }

      const player = inputAllyCode
        ? players.find((p) => p.allyCode === inputAllyCode)
        : (players.find((p) => p.isMain) ?? players[0])

      if (!player) {
        return interaction.editReply({
          content:
            "You can only view leaves for your own registered ally codes.",
        })
      }

      // Fetch leaves
      const leaves = await container.backendApi.leaves.listByPlayer(
        player.allyCode,
        { active: activeOnly },
      )

      if (leaves.length === 0) {
        const msg = activeOnly
          ? "You have no active or upcoming leaves."
          : "You have no recorded leaves."
        return interaction.editReply({ content: msg })
      }

      // Format response
      let response = `**Your Leaves of Absence**${activeOnly ? " (Active/Upcoming)" : ""}:\n\n`

      for (const leave of leaves.slice(0, 10)) {
        const typeIcon = leave.leaveType === "away" ? "🚫" : "⚠️"
        const startDate = leave.startDate.split("T")[0]
        const endDate = leave.endDate.split("T")[0]
        response += `${typeIcon} **ID ${leave.id}:** ${startDate} to ${endDate}`
        response += ` (${leave.leaveType === "away" ? "Away" : "Busy"})`
        if (leave.note) {
          const truncatedNote =
            leave.note.length > 50 ? leave.note.slice(0, 50) + "..." : leave.note
          response += ` - ${truncatedNote}`
        }
        response += "\n"
      }

      if (leaves.length > 10) {
        response += `\n_...and ${leaves.length - 10} more_`
      }

      return interaction.editReply({ content: response })
    } catch (error) {
      console.error("Error listing leaves:", error)
      return interaction.editReply({
        content: `Failed to fetch leaves. ${(error as Error).message}`,
      })
    }
  }

  // ============================================
  // /player leave-delete
  // ============================================
  public async chatInputLeaveDelete(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const leaveId = interaction.options.getInteger("leave-id", true)
      const inputAllyCode = interaction.options
        .getString("ally-code")
        ?.replace(/-/g, "")

      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
      })

      if (players.length === 0) {
        return interaction.editReply({
          content:
            "You don't have any registered ally codes. Use `/player register` first.",
        })
      }

      const player = inputAllyCode
        ? players.find((p) => p.allyCode === inputAllyCode)
        : (players.find((p) => p.isMain) ?? players[0])

      if (!player) {
        return interaction.editReply({
          content:
            "You can only delete leaves for your own registered ally codes.",
        })
      }

      // Delete the leave
      await container.backendApi.leaves.delete(leaveId, player.allyCode)

      return interaction.editReply({
        content: `Leave #${leaveId} has been deleted.`,
      })
    } catch (error) {
      console.error("Error deleting leave:", error)
      return interaction.editReply({
        content: `Failed to delete leave. ${(error as Error).message}`,
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
}
