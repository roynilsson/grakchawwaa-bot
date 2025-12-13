import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import { EmbedBuilder } from "discord.js"
import { WarningWithTypeRow } from "../../db/warning-client"

interface PlayerWarningStats {
  allyCode: string
  playerName: string | null
  warnings: WarningWithTypeRow[]
  totalWeight: number
}

export class ListWarningsCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "list-warnings",
      description: "List warnings for your guild with optional filters",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("ally-code")
            .setDescription("Filter by specific player's ally code")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("days")
            .setDescription("Number of days to look back (default: 30)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(365),
        )
        .addIntegerOption((option) =>
          option
            .setName("top")
            .setDescription("Show only top X players with most warnings")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50),
        )
        .addIntegerOption((option) =>
          option
            .setName("worst")
            .setDescription("Show only worst X players by total weight")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50),
        ),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Get filter options
      const allyCodeInput = interaction.options.getString("ally-code")
      const days = interaction.options.getInteger("days") ?? 30
      const topCount = interaction.options.getInteger("top")
      const worstCount = interaction.options.getInteger("worst")

      // Validate that top and worst aren't both specified
      if (topCount && worstCount) {
        return await interaction.reply({
          content: "You can only specify one of `top` or `worst`, not both.",
          ephemeral: true,
        })
      }

      await interaction.deferReply()

      // Get player's ally code
      const player = await container.playerClient.getPlayer(interaction.user.id)
      if (!player?.allyCode) {
        return await interaction.editReply({
          content:
            "You need to register your ally code first using `/register-player`.",
        })
      }

      // Get player info from comlink
      const comlinkPlayer = await container.cachedComlinkClient.getPlayer(
        player.allyCode,
      )
      if (!comlinkPlayer?.guildId) {
        return await interaction.editReply({
          content: "You must be in a guild to use this command.",
        })
      }

      // Get guild info and verify permissions
      const comlinkGuild = await container.cachedComlinkClient.getGuild(
        comlinkPlayer.guildId,
        true,
      )
      if (!comlinkGuild?.guild?.member) {
        return await interaction.editReply({
          content:
            "Could not verify your guild information. Please try again later.",
        })
      }

      // Check if user is officer or leader
      const guildMember = comlinkGuild.guild.member.find(
        (m) => m.playerId === comlinkPlayer.playerId,
      )
      if (!guildMember || guildMember.memberLevel < 3) {
        return await interaction.editReply({
          content: "Only guild leaders and officers can view warnings.",
        })
      }

      // Normalize ally code if provided
      const filterAllyCode = allyCodeInput?.replace(/-/g, "") ?? undefined

      // Fetch warnings
      const warnings = await container.warningClient.listWarnings({
        guildId: comlinkPlayer.guildId,
        allyCode: filterAllyCode,
        days,
      })

      if (!warnings.length) {
        const message = filterAllyCode
          ? `No warnings found for ally code ${filterAllyCode} in the last ${days} days.`
          : `No warnings found in the last ${days} days.`
        return await interaction.editReply({ content: message })
      }

      // Group warnings by player
      const playerStats = await this.groupWarningsByPlayer(
        warnings,
        comlinkGuild.guild.member,
      )

      // Apply sorting and limiting
      let filteredStats = playerStats
      if (topCount) {
        // Sort by warning count, take top N
        filteredStats = playerStats
          .sort((a, b) => b.warnings.length - a.warnings.length)
          .slice(0, topCount)
      } else if (worstCount) {
        // Sort by total weight, take worst N
        filteredStats = playerStats
          .sort((a, b) => b.totalWeight - a.totalWeight)
          .slice(0, worstCount)
      } else {
        // Default: sort by total weight descending
        filteredStats = playerStats.sort(
          (a, b) => b.totalWeight - a.totalWeight,
        )
      }

      // Build response embed(s)
      const embeds = await this.buildWarningsEmbeds(
        filteredStats,
        comlinkGuild.guild.profile.name,
        days,
        warnings.length,
        topCount,
        worstCount,
      )

      return await interaction.editReply({ embeds })
    } catch (error) {
      console.error("Error in list-warnings command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while listing warnings. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while listing warnings. Please try again later.",
      })
    }
  }

  private async groupWarningsByPlayer(
    warnings: WarningWithTypeRow[],
    guildMembers: { playerId: string; playerName: string }[],
  ): Promise<PlayerWarningStats[]> {
    const playerMap = new Map<string, PlayerWarningStats>()

    // Create a map of ally codes to player names
    const allyCodeToName = new Map<string, string>()
    for (const member of guildMembers) {
      const playerData = await container.comlinkClient.getPlayer(
        undefined,
        member.playerId,
      )
      if (playerData?.allyCode) {
        const normalized = playerData.allyCode.toString().replace(/-/g, "")
        allyCodeToName.set(normalized, member.playerName)
      }
    }

    for (const warning of warnings) {
      if (!playerMap.has(warning.ally_code)) {
        playerMap.set(warning.ally_code, {
          allyCode: warning.ally_code,
          playerName: allyCodeToName.get(warning.ally_code) ?? null,
          warnings: [],
          totalWeight: 0,
        })
      }

      const stats = playerMap.get(warning.ally_code)!
      stats.warnings.push(warning)
      stats.totalWeight += warning.weight
    }

    return Array.from(playerMap.values())
  }

  private async buildWarningsEmbeds(
    playerStats: PlayerWarningStats[],
    guildName: string,
    days: number,
    totalWarnings: number,
    topCount: number | null,
    worstCount: number | null,
  ): Promise<EmbedBuilder[]> {
    const embeds: EmbedBuilder[] = []

    let title = `Warning Report - ${guildName}`
    if (topCount) {
      title += ` (Top ${topCount})`
    } else if (worstCount) {
      title += ` (Worst ${worstCount})`
    }

    const description = [
      `**Period:** Last ${days} days`,
      `**Total Warnings:** ${totalWarnings}`,
      `**Players Flagged:** ${playerStats.length}`,
      "",
    ].join("\n")

    // Create embeds with max 25 fields each
    const playersPerEmbed = 10 // Keep it readable
    for (let i = 0; i < playerStats.length; i += playersPerEmbed) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245) // Red color
        .setTimestamp()

      if (i === 0) {
        embed.setTitle(title)
        embed.setDescription(description)
      } else {
        embed.setTitle(`${title} (continued)`)
      }

      const chunk = playerStats.slice(i, i + playersPerEmbed)
      for (const stats of chunk) {
        const playerName = stats.playerName ?? stats.allyCode
        const rank = playerStats.indexOf(stats) + 1

        const warningsList = stats.warnings
          .slice(0, 5) // Limit to 5 most recent
          .map((w) => {
            const date = new Date(w.created_at).toLocaleDateString()
            const notesPreview = w.notes
              ? ` - ${w.notes.substring(0, 30)}${w.notes.length > 30 ? "..." : ""}`
              : ""
            return `• ${w.type_label} (${w.weight}) - ${date}${notesPreview}`
          })
          .join("\n")

        const moreWarnings =
          stats.warnings.length > 5
            ? `\n_...and ${stats.warnings.length - 5} more_`
            : ""

        const fieldValue =
          `**Count:** ${stats.warnings.length} | **Total Weight:** ${stats.totalWeight}\n` +
          warningsList +
          moreWarnings

        embed.addFields({
          name: `${rank}. ${playerName}`,
          value:
            fieldValue.length > 1024
              ? fieldValue.substring(0, 1021) + "..."
              : fieldValue,
          inline: false,
        })
      }

      if (i + playersPerEmbed >= playerStats.length && playerStats.length > playersPerEmbed) {
        embed.setFooter({
          text: `Total: ${playerStats.length} players`,
        })
      }

      embeds.push(embed)
    }

    return embeds
  }
}
