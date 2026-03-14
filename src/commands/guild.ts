import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import {
  ChannelType,
  EmbedBuilder,
  type AutocompleteInteraction,
} from "discord.js"
import type { GuildMember } from "../api/guild-client"
import type { PlayerGuildMembership } from "../api/player-client"
import { DiscordBotClient } from "../discord-bot-client"
import { ViolationSummaryService } from "../services/violation-summary"

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

export class GuildCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "guild",
      subcommands: [
        { name: "members", chatInputRun: "chatInputMembers" },
        { name: "tickets", chatInputRun: "chatInputTickets" },
      ],
    })
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("guild")
        .setDescription("Guild information commands")
        .addSubcommand((sub) =>
          sub
            .setName("members")
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
        )
        .addSubcommand((sub) =>
          sub
            .setName("tickets")
            .setDescription("Generate a custom period ticket summary")
            .addIntegerOption((option) =>
              option
                .setName("days")
                .setDescription("Number of days to include in the summary (1-90)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(90),
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
  }

  // ============================================
  // /guild members
  // ============================================
  public async chatInputMembers(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const nameFilter = interaction.options.getString("name")?.toLowerCase()

      const allyCodeResult = await this.resolveAllyCode(interaction)
      if (!allyCodeResult.success || !allyCodeResult.value) {
        return await interaction.editReply(allyCodeResult.response)
      }

      const membershipResult = await this.getGuildMembership(
        allyCodeResult.value,
      )
      if (!membershipResult.success || !membershipResult.value) {
        return await interaction.editReply(membershipResult.response)
      }

      const members = await container.backendApi.guilds.getMembers(
        membershipResult.value.membership.guildId,
      )

      if (!members || members.length === 0) {
        return await interaction.editReply({
          content: "Could not retrieve guild members.",
        })
      }

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

      await this.sendMemberList(
        interaction,
        filteredMembers,
        membershipResult.value.membership.guildName,
      )
    } catch (error) {
      container.logger.error("Error in guild members command:", error)
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

  // ============================================
  // /guild tickets
  // ============================================
  public async chatInputTickets(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const days = interaction.options.getInteger("days")
      if (!days || days < 1 || days > 90) {
        return await interaction.reply({
          content: "Please provide a valid number of days (1-90).",
          ephemeral: true,
        })
      }

      const channel = interaction.channel
      if (
        !channel ||
        !(
          channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.DM ||
          channel.type === ChannelType.GuildAnnouncement
        )
      ) {
        return await interaction.reply({
          content: "This command can only be used in a text channel or DM.",
          ephemeral: true,
        })
      }

      await interaction.deferReply()

      const guildRegistration = await this.getGuildRegistration(interaction)
      if (!guildRegistration.success) {
        return await interaction.editReply(guildRegistration.response)
      }

      const client = this.container.client as unknown as DiscordBotClient
      const summaryService = new ViolationSummaryService(client)

      await summaryService.generateCustomPeriodSummary(
        guildRegistration.guildId!,
        channel.id,
        guildRegistration.guildName!,
        days,
      )

      return await interaction.editReply({
        content: `Ticket summary for the last ${days} days has been posted.`,
      })
    } catch (error) {
      console.error("Error in guild tickets command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while generating the ticket summary. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while generating the ticket summary. Please try again later.",
      })
    }
  }

  // ============================================
  // Helper methods
  // ============================================
  private async resolveAllyCode(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<CommandResponse<string>> {
    const inputAllyCode = interaction.options.getString("ally-code")

    if (inputAllyCode) {
      return {
        success: true,
        response: { content: "" },
        value: inputAllyCode.replace(/-/g, ""),
      }
    }

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
            "You don't have a registered ally code. Please register with `/player register` first.",
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
          content: `Player ${allyCode} is not a member of any registered guild. Please ensure the guild is registered with \`/officer setup register-guild\` first.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: { allyCode, membership },
    }
  }

  private async getGuildRegistration(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<{
    success: boolean
    response: { content: string }
    guildId?: string
    guildName?: string
  }> {
    const players = await container.backendApi.players.list({
      discordId: interaction.user.id,
    })
    const player = players.find((p) => p.isMain) ?? players[0]
    if (!player?.allyCode) {
      return {
        success: false,
        response: {
          content:
            "You don't have a registered ally code. Please register with `/player register` first.",
        },
      }
    }

    const membership = await container.backendApi.players.getGuildMembership(
      player.allyCode,
    )
    if (!membership) {
      return {
        success: false,
        response: {
          content: "Could not find your Star Wars guild data.",
        },
      }
    }

    try {
      const automations = await container.backendApi.automations.listByGuild(
        membership.guildId,
      )
      const ticketCollectionNotification = automations.find(
        (a) => a.automationType === "ticket_collection_notification",
      )
      const config = ticketCollectionNotification?.config as
        | { channelId?: string }
        | undefined
      if (!config?.channelId) {
        return {
          success: false,
          response: {
            content:
              "Your Star Wars guild is not registered for ticket collection. Please configure ticket collection via the web dashboard.",
          },
        }
      }
    } catch {
      return {
        success: false,
        response: {
          content:
            "Your Star Wars guild is not registered for ticket collection. Please configure ticket collection via the web dashboard.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      guildId: membership.guildId,
      guildName: membership.guildName,
    }
  }

  private async sendMemberList(
    interaction: Subcommand.ChatInputCommandInteraction,
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

    const firstEmbed = this.createMemberEmbed(
      members.slice(0, membersPerEmbed),
      guildName,
      1,
      pageCount,
    )

    await interaction.editReply({ embeds: [firstEmbed] })

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

      let lastActivityAgo = "N/A"
      if (member.player.lastActivityTime) {
        const lastActivityDate = new Date(member.player.lastActivityTime)
        lastActivityAgo = this.formatTimeAgo(lastActivityDate.getTime(), true)
      }

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

  private formatTimeAgo(timestamp: number, isMilliseconds = false): string {
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
