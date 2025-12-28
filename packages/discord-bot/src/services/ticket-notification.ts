import { container } from "@sapphire/pieces"
import { EmbedBuilder, TextChannel, userMention } from "discord.js"
import { DiscordBotClient } from "../discord-bot-client"
import { ViolationSummaryService } from "./violation-summary"

interface TicketViolator {
  playerId: string
  playerName: string
  tickets: number
}

export class TicketNotificationService {
  private client: DiscordBotClient
  private summaryService: ViolationSummaryService
  private checkInterval: NodeJS.Timeout | null = null
  private notifiedViolationDates: Set<string> = new Set()
  private sentReminderDates: Set<string> = new Set()
  private static TICKET_THRESHOLD = 600
  private static CHECK_FREQUENCY = 60 * 1000 // Check every minute
  private static REMINDER_BEFORE_RESET = 60 * 60 * 1000 // 1 hour before reset
  private isDevMode: boolean
  private static EMBED_FIELD_LIMIT = 25
  private static EMBEDS_PER_MESSAGE = 10

  constructor(
    client: DiscordBotClient,
    summaryService?: ViolationSummaryService,
  ) {
    this.client = client
    this.summaryService = summaryService ?? new ViolationSummaryService(client)
    this.isDevMode = process.env.NODE_ENV === "development"
  }

  public start(): void {
    console.log(
      `Starting ticket notification service in ${this.isDevMode ? "development" : "production"} mode`,
    )

    if (this.isDevMode) {
      // In dev mode, run check once directly
      console.log("Development mode: Running notification check once")
      this.checkForNotifications()
    } else {
      // In production mode, use interval checks
      this.checkInterval = setInterval(() => {
        this.checkForNotifications()
      }, TicketNotificationService.CHECK_FREQUENCY)
    }
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.notifiedViolationDates.clear()
    this.sentReminderDates.clear()
  }

  private async checkForNotifications(): Promise<void> {
    try {
      // Get all registered guilds
      const guilds = await container.guildService.getAllGuilds()
      const now = Date.now()

      for (const guild of guilds) {
        if (!guild.nextTicketCollectionRefreshTime) {
          continue
        }

        const refreshTime = guild.nextTicketCollectionRefreshTime.getTime()
        const timeUntilReset = refreshTime - now
        const violationDateKey = `${guild.id}:${new Date(refreshTime).toDateString()}`

        // In dev mode, send all notifications immediately
        if (this.isDevMode) {
          console.log(
            `Development mode: Sending notifications for guild ${guild.id}`,
          )

          if (guild.ticketReminderChannelId) {
            await this.sendTicketReminder(
              guild.id,
              guild.name || "Unknown Guild",
              guild.ticketReminderChannelId,
            )
          }

          if (guild.ticketCollectionChannelId) {
            await this.sendViolationNotifications(
              guild.id,
              guild.name || "Unknown Guild",
              guild.ticketCollectionChannelId,
            )
          }

          continue
        }

        // Send reminder 1 hour before reset
        if (
          guild.ticketReminderChannelId &&
          timeUntilReset > 0 &&
          timeUntilReset <= TicketNotificationService.REMINDER_BEFORE_RESET &&
          !this.sentReminderDates.has(violationDateKey)
        ) {
          const sent = await this.sendTicketReminder(
            guild.id,
            guild.name || "Unknown Guild",
            guild.ticketReminderChannelId,
          )

          if (sent) {
            this.sentReminderDates.add(violationDateKey)
          }
        }

        // Send violation notifications shortly after reset
        // Check if reset has passed and we haven't notified yet for this date
        if (
          guild.ticketCollectionChannelId &&
          timeUntilReset < 0 &&
          !this.notifiedViolationDates.has(violationDateKey)
        ) {
          await this.sendViolationNotifications(
            guild.id,
            guild.name || "Unknown Guild",
            guild.ticketCollectionChannelId,
          )

          this.notifiedViolationDates.add(violationDateKey)

          // Generate summaries if needed
          await this.checkAndGenerateSummaries(
            guild.id,
            guild.ticketCollectionChannelId,
            guild.name || "Unknown Guild",
          )
        }
      }
    } catch (error) {
      console.error("Error checking for notifications:", error)
    }
  }

  private async sendTicketReminder(
    guildId: string,
    guildName: string,
    channelId: string,
  ): Promise<boolean> {
    try {
      // Get latest violations from database (violations from current period)
      const violations =
        await container.ticketViolationRepository.getCustomPeriodViolations(
          guildId,
          1, // Last 24 hours
        )

      if (!violations.length) {
        console.log(`No recent violations for reminder in guild ${guildId}`)
        return true
      }

      // Build list of violators from individual violation records
      const violators: TicketViolator[] = []
      for (const violation of violations) {
        const player = await container.playerService.findPlayerByPlayerId(
          violation.playerId,
        )
        violators.push({
          playerId: violation.playerId,
          playerName: player?.name || "Unknown Player",
          tickets: violation.ticketCount,
        })
      }

      if (!violators.length) {
        return true
      }

      const lines = await this.buildReminderLines(violators)
      if (!lines.length) {
        return true
      }

      await this.sendReminderMessage(channelId, guildName, lines)
      return true
    } catch (error) {
      console.error(`Error sending ticket reminder for guild ${guildId}:`, error)
      return false
    }
  }

  private async buildReminderLines(
    violators: TicketViolator[],
  ): Promise<string[]> {
    const lines: string[] = []

    for (const [index, violator] of violators.entries()) {
      const label = await this.resolveReminderLabel(violator)
      lines.push(`${index + 1}. ${label} (${violator.tickets}/600)`)
    }

    return lines
  }

  private async resolveReminderLabel(
    violator: TicketViolator,
  ): Promise<string> {
    const allyCode = await container.playerService.findAllyCodeByPlayerId(
      violator.playerId,
    )
    if (!allyCode) {
      return violator.playerName
    }

    const discordId =
      await container.playerService.findDiscordIdByAllyCode(allyCode)
    if (!discordId) {
      return violator.playerName
    }

    return userMention(discordId)
  }

  private async sendReminderMessage(
    channelId: string,
    guildName: string,
    lines: string[],
  ): Promise<void> {
    if (!lines.length) {
      return
    }

    try {
      const channel = (await this.client.channels.fetch(
        channelId,
      )) as TextChannel

      if (!channel || !channel.isTextBased()) {
        console.error(`Reminder channel ${channelId} is invalid`)
        return
      }

      const content = [
        `⏰ Ticket reminder for ${guildName} (1 hour before reset)`,
        "Players below 600 tickets:",
        ...lines,
      ].join("\n")

      await channel.send({ content })
    } catch (error) {
      console.error(
        `Error sending reminder message to channel ${channelId}:`,
        error,
      )
    }
  }

  private async sendViolationNotifications(
    guildId: string,
    guildName: string,
    channelId: string,
  ): Promise<void> {
    try {
      // Get today's violations from database
      const violations =
        await container.ticketViolationRepository.getCustomPeriodViolations(
          guildId,
          1, // Last 24 hours
        )

      if (!violations.length) {
        // No violations found - everyone collected 600 tickets!
        await this.sendSuccessNotification(channelId, guildName)
        return
      }

      // Build list of violators from individual violation records
      const violators: TicketViolator[] = []
      for (const violation of violations) {
        const player = await container.playerService.findPlayerByPlayerId(
          violation.playerId,
        )
        violators.push({
          playerId: violation.playerId,
          playerName: player?.name || "Unknown Player",
          tickets: violation.ticketCount,
        })
      }

      if (!violators.length) {
        await this.sendSuccessNotification(channelId, guildName)
        return
      }

      await this.sendViolationMessage(channelId, guildName, violators)
    } catch (error) {
      console.error(
        `Error sending violation notifications for guild ${guildId}:`,
        error,
      )
    }
  }

  private async sendSuccessNotification(
    channelId: string,
    guildName: string,
  ): Promise<void> {
    try {
      const channel = (await this.client.channels.fetch(
        channelId,
      )) as TextChannel
      if (!channel || !channel.isTextBased()) {
        console.error(`Channel ${channelId} not found or not a text channel`)
        return
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287) // Green color for success
        .setTitle(`🎉 Perfect Ticket Collection for ${guildName}!`)
        .setDescription(
          `Everyone in the guild collected ${TicketNotificationService.TICKET_THRESHOLD} daily raid tickets! Great job, team! 🚀`,
        )
        .setTimestamp()

      await channel.send({ embeds: [embed] })
    } catch (error) {
      console.error(
        `Error sending success notification to channel ${channelId}:`,
        error,
      )
    }
  }

  private async sendViolationMessage(
    channelId: string,
    guildName: string,
    violators: TicketViolator[],
  ): Promise<void> {
    try {
      const channel = (await this.client.channels.fetch(
        channelId,
      )) as TextChannel
      if (!channel || !channel.isTextBased()) {
        console.error(`Channel ${channelId} not found or not a text channel`)
        return
      }

      const embeds = this.buildViolationEmbeds(guildName, violators)
      if (!embeds.length) {
        return
      }

      const batches = this.chunkEmbeds(embeds)
      for (const batch of batches) {
        await channel.send({ embeds: batch })
      }
    } catch (error) {
      console.error(
        `Error sending violation message to channel ${channelId}:`,
        error,
      )
    }
  }

  private buildViolationEmbeds(
    guildName: string,
    violators: TicketViolator[],
  ): EmbedBuilder[] {
    if (!violators.length) {
      return []
    }

    const sortedViolators = [...violators].sort(
      (a, b) => a.tickets - b.tickets,
    )
    const totalMissingTickets = sortedViolators.reduce(
      (sum, violator) => sum + (600 - violator.tickets),
      0,
    )

    const chunkSize = TicketNotificationService.EMBED_FIELD_LIMIT
    const embedChunks: EmbedBuilder[] = []

    for (let index = 0; index < sortedViolators.length; index += chunkSize) {
      const chunk = sortedViolators.slice(index, index + chunkSize)
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(
          index === 0
            ? `Ticket Violation Report for ${guildName}`
            : `Ticket Violation Report (cont.) - ${guildName}`,
        )
        .setTimestamp()

      if (index === 0) {
        embed
          .setDescription(
            `The following ${violators.length} players did not reach 600 daily raid tickets`,
          )
          .setFooter({
            text: `Total missing tickets: ${totalMissingTickets}`,
          })
      }

      chunk.forEach((violator, position) => {
        const rank = index + position + 1
        embed.addFields({
          name: `${rank}. ${violator.playerName}`,
          value: `${violator.tickets}/600 tickets`,
          inline: true,
        })
      })

      embedChunks.push(embed)
    }

    return embedChunks
  }

  private chunkEmbeds(embeds: EmbedBuilder[]): EmbedBuilder[][] {
    const batches: EmbedBuilder[][] = []
    const batchSize = TicketNotificationService.EMBEDS_PER_MESSAGE

    for (let index = 0; index < embeds.length; index += batchSize) {
      batches.push(embeds.slice(index, index + batchSize))
    }

    return batches
  }

  private async checkAndGenerateSummaries(
    guildId: string,
    channelId: string,
    guildName: string,
  ): Promise<void> {
    try {
      const now = new Date()
      const isWeeklySummaryTime = now.getDay() === 0 // Sunday
      const isLastDayOfMonth =
        now.getDate() ===
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

      // Generate weekly summary if it's Sunday or forceGenerate is true
      if (isWeeklySummaryTime || this.isDevMode) {
        console.log(
          `Generating weekly summary for guild ${guildId}${this.isDevMode ? " (dev mode)" : ""}`,
        )
        await this.summaryService.generateWeeklySummary(
          guildId,
          channelId,
          guildName,
        )
      }

      // Generate monthly summary if it's the last day of the month or forceGenerate is true
      if (isLastDayOfMonth || this.isDevMode) {
        console.log(
          `Generating monthly summary for guild ${guildId}${this.isDevMode ? " (dev mode)" : ""}`,
        )
        await this.summaryService.generateMonthlySummary(
          guildId,
          channelId,
          guildName,
        )
      }
    } catch (error) {
      console.error(`Error generating summaries for guild ${guildId}:`, error)
    }
  }
}
