import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import type { AutocompleteInteraction } from "discord.js"
import { EmbedBuilder } from "discord.js"
import type { GuildMember } from "../../api/guild-client"
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

export class GetGuildMembersCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("get-guild-members")
          .setDescription("Get a list of guild members")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Filter members by name (not case-sensitive)")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Select one of your registered accounts")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      { idHints: ["1374077113417732208", "1374084340669218846"] },
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
      await interaction.deferReply()

      // Get the name filter if provided
      const nameFilter = interaction.options.getString("name")?.toLowerCase()

      // Get ally code (from autocomplete selection or user's main account)
      const allyCodeResult = await this.resolveAllyCode(interaction)
      if (!allyCodeResult.success || !allyCodeResult.value) {
        return await interaction.editReply(allyCodeResult.response)
      }

      // Get guild membership from backend
      const membershipResult = await this.getGuildMembership(
        allyCodeResult.value,
      )
      if (!membershipResult.success || !membershipResult.value) {
        return await interaction.editReply(membershipResult.response)
      }

      // Get guild members from backend
      const members = await container.backendApi.guilds.getMembers(
        membershipResult.value.membership.guildId,
      )

      if (!members || members.length === 0) {
        return await interaction.editReply({
          content: "Could not retrieve guild members.",
        })
      }

      // Filter members by name if a filter was provided
      let filteredMembers = members
      if (nameFilter) {
        filteredMembers = members.filter((member) =>
          member.player.name?.toLowerCase().includes(nameFilter),
        )

        if (filteredMembers.length === 0) {
          return await interaction.editReply({
            content: `No members found with name containing "${nameFilter}".`,
          })
        }
      }

      // Format and send the member information
      await this.sendMemberList(
        interaction,
        filteredMembers,
        membershipResult.value.membership.guildName,
      )
    } catch (error) {
      container.logger.error("Error in get-guild-members command:", error)
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }
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

  private async sendMemberList(
    interaction: Command.ChatInputCommandInteraction,
    members: GuildMember[],
    guildName: string,
  ) {
    if (members.length === 0) {
      return interaction.editReply({
        content: "No members found to display.",
      })
    }

    const membersPerEmbed = 10
    const pageCount = Math.ceil(members.length / membersPerEmbed)

    // Create first embed
    const firstEmbed = this.createMemberEmbed(
      members.slice(0, membersPerEmbed),
      guildName,
      1,
      pageCount,
    )

    // Send first embed
    await interaction.editReply({ embeds: [firstEmbed] })

    // Send remaining embeds as follow-ups
    for (let page = 2; page <= pageCount; page++) {
      const startIdx = (page - 1) * membersPerEmbed
      const endIdx = Math.min(startIdx + membersPerEmbed, members.length)
      const pageMembers = members.slice(startIdx, endIdx)

      const embed = this.createMemberEmbed(
        pageMembers,
        guildName,
        page,
        pageCount,
      )

      await interaction.followUp({ embeds: [embed] })
    }
  }

  private createMemberEmbed(
    members: GuildMember[],
    guildName: string,
    page: number,
    totalPages: number,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`${guildName} Members`)
      .setDescription(`Page ${page} of ${totalPages}`)
      .setTimestamp()

    members.forEach((member, index) => {
      const position = (page - 1) * 10 + index + 1

      const formattedGP = member.player.galacticPower
        ? member.player.galacticPower.toLocaleString()
        : "N/A"

      // Format lastActivityTime as a time ago string
      let lastActivityAgo = "N/A"
      if (member.player.lastActivityTime) {
        const lastActivityDate = new Date(member.player.lastActivityTime)
        lastActivityAgo = this.formatTimeAgo(lastActivityDate.getTime(), true)
      }

      // Format join time
      let formattedJoinTime = "N/A"
      if (member.joinedAt) {
        const joinTime = new Date(member.joinedAt)
        formattedJoinTime =
          joinTime.toISOString().slice(0, 10) +
          " " +
          joinTime.toTimeString().slice(0, 5)
      }

      const playerName = member.player.name || member.player.allyCode
      const playerLevel = member.player.playerLevel || "?"

      embed.addFields({
        name: `${position}. ${playerName} (Lvl ${playerLevel})`,
        value:
          `**Ally Code:** ${member.player.allyCode}\n` +
          `**GP:** ${formattedGP}\n` +
          `**Last Active:** ${lastActivityAgo}\n` +
          `**Joined Guild:** ${formattedJoinTime}`,
      })
    })

    return embed
  }

  /**
   * Formats time as an "X years, Y days, Z hours, W minutes ago" string
   * @param timestamp Timestamp in seconds or milliseconds
   * @param isMilliseconds Whether the timestamp is in milliseconds
   * @returns Formatted time ago string
   */
  private formatTimeAgo(timestamp: number, isMilliseconds = false): string {
    // Convert milliseconds to seconds if needed
    const timeInSeconds = isMilliseconds
      ? Math.floor(timestamp / 1000)
      : timestamp

    const now = Math.floor(Date.now() / 1000)
    const diff = now - timeInSeconds

    if (diff < 0) {
      return "just now"
    }

    const minutes = Math.floor(diff / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const years = Math.floor(days / 365)

    const remainingDays = days % 365
    const remainingHours = hours % 24
    const remainingMinutes = minutes % 60

    const parts: string[] = []

    if (years > 0) {
      parts.push(`${years} ${years === 1 ? "year" : "years"}`)
    }

    if (remainingDays > 0) {
      parts.push(`${remainingDays} ${remainingDays === 1 ? "day" : "days"}`)
    }

    if (remainingHours > 0) {
      parts.push(`${remainingHours} ${remainingHours === 1 ? "hour" : "hours"}`)
    }

    if (remainingMinutes > 0) {
      parts.push(
        `${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`,
      )
    }

    if (parts.length === 0) {
      return "just now"
    }

    return `${parts.join(", ")} ago`
  }
}
