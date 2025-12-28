import { MikroORM } from "@mikro-orm/core"
import { CachedComlinkClient, Guild, TicketViolation } from "@grakchawwaa/core"
import { ComlinkGuildData, ComlinkGuildMember } from "@swgoh-utils/comlink"

interface TicketViolator {
  id: string
  name: string
  tickets: number
}

export class TicketCollectionWorker {
  private checkInterval: NodeJS.Timeout | null = null
  private processedRefreshTimes: Set<string> = new Set()
  private static TICKET_THRESHOLD = 600
  private static CHECK_FREQUENCY = 60 * 1000 // Check every minute
  private static CHECK_BEFORE_RESET = 2 * 60 * 1000 // 2 minutes before reset
  private static REFRESH_UPDATE_DELAY = 5 * 60 * 1000 // 5 minutes wait for refresh update
  private isDevMode: boolean

  constructor(
    private orm: MikroORM,
    private cachedComlinkClient: CachedComlinkClient,
  ) {
    this.isDevMode = process.env.NODE_ENV === "development"
  }

  public start(): void {
    console.log(
      `Starting ticket collection worker in ${this.isDevMode ? "development" : "production"} mode`,
    )

    if (this.isDevMode) {
      // In dev mode, run check once directly
      console.log("Development mode: Running ticket check once")
      this.checkGuildResetTimes()
    } else {
      // In production mode, use interval checks
      this.checkInterval = setInterval(() => {
        this.checkGuildResetTimes()
      }, TicketCollectionWorker.CHECK_FREQUENCY)
    }
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.processedRefreshTimes.clear()
  }

  private async checkGuildResetTimes(): Promise<void> {
    try {
      const em = this.orm.em.fork()
      const guildRepository = em.getRepository(Guild)

      // Get all registered guilds
      const guilds = await guildRepository.findAll()
      const now = Date.now()

      for (const guild of guilds) {
        // Skip guilds without required fields
        if (
          !guild.ticketCollectionChannelId ||
          !guild.nextTicketCollectionRefreshTime
        ) {
          continue
        }

        // Get the next refresh time
        const refreshTime = guild.nextTicketCollectionRefreshTime.getTime()
        const refreshTimeKey = `${guild.id}:${refreshTime}`

        // In dev mode, process regardless of timing
        if (this.isDevMode) {
          console.log(
            `Development mode: Force checking tickets for guild ${guild.id}`,
          )

          // Process ticket data collection
          await this.collectTicketData(em, guild.id)

          // Also force run post-refresh operations
          await this.handlePostRefreshOperations(em, guild.id)

          continue
        }

        // Regular production logic below
        // Check if we're within 2 minutes of the reset for ticket collection
        const timeUntilReset = refreshTime - now

        if (
          timeUntilReset > 0 &&
          timeUntilReset <= TicketCollectionWorker.CHECK_BEFORE_RESET &&
          !this.processedRefreshTimes.has(refreshTimeKey)
        ) {
          // Mark this refresh time as processed
          this.processedRefreshTimes.add(refreshTimeKey)
          console.log(`Processing tickets for refresh time: ${refreshTimeKey}`)

          // It's time to check ticket counts
          await this.collectTicketData(em, guild.id)
        }

        // Check if we're 5 minutes past the reset to update next refresh time
        const timeSinceReset = now - refreshTime
        if (timeSinceReset >= TicketCollectionWorker.REFRESH_UPDATE_DELAY) {
          await this.handlePostRefreshOperations(em, guild.id)
          this.processedRefreshTimes.delete(refreshTimeKey)
        }
      }
    } catch (error) {
      console.error("Error checking guild reset times:", error)
    }
  }

  private async collectTicketData(em: any, guildId: string): Promise<void> {
    if (this.isDevMode) {
      console.log("Skipping live ticket collection (in dev mode)")
      return
    }

    try {
      console.log(`Collecting ticket data for guild ${guildId}`)

      const guildData = await this.fetchGuildData(guildId)
      if (!guildData) return

      const violators = this.findTicketViolators(guildData.guild.member)
      await this.storeViolations(em, guildId, violators)
    } catch (error) {
      console.error(`Error collecting ticket data for guild ${guildId}:`, error)
    }
  }

  private async fetchGuildData(
    guildId: string,
  ): Promise<ComlinkGuildData | null> {
    try {
      const guildData = await this.cachedComlinkClient.getGuild(guildId, true)
      if (!guildData?.guild?.member) {
        console.error(`No member data found for guild ${guildId}`)
        return null
      }
      return guildData
    } catch (error) {
      console.error(`Error fetching guild data for ${guildId}:`, error)
      return null
    }
  }

  private findTicketViolators(members: ComlinkGuildMember[]): TicketViolator[] {
    const violators: TicketViolator[] = []

    for (const member of members) {
      const ticketContribution = member.memberContribution?.find(
        (c) => c.type === 2,
      )
      const ticketCount = ticketContribution?.currentValue || 0

      if (ticketCount < TicketCollectionWorker.TICKET_THRESHOLD) {
        violators.push({
          id: member.playerId,
          name: member.playerName,
          tickets: ticketCount,
        })
      }
    }

    return violators
  }

  private async storeViolations(
    em: any,
    guildId: string,
    violators: TicketViolator[],
  ): Promise<void> {
    if (violators.length === 0) {
      console.log(`No violations for guild ${guildId} - perfect collection!`)
      return
    }

    try {
      const ticketViolationRepository = em.getRepository(TicketViolation)

      // Create mapping of player ID to ticket count
      const ticketCounts: Record<string, number> = {}
      violators.forEach((v) => {
        ticketCounts[v.id] = v.tickets
      })

      // Store violation data
      const violation = ticketViolationRepository.create({
        guildId,
        violationDate: new Date(),
        ticketCounts,
      })

      await em.persistAndFlush(violation)

      console.log(
        `Stored ${violators.length} ticket violations for guild ${guildId}`,
      )
    } catch (error) {
      console.error(`Error storing violations for guild ${guildId}:`, error)
    }
  }

  private async handlePostRefreshOperations(
    em: any,
    guildId: string,
  ): Promise<void> {
    try {
      const guildData = await this.fetchGuildData(guildId)
      if (!guildData?.guild?.nextChallengesRefresh) {
        console.error(`Failed to get refresh time for guild ${guildId}`)
        return
      }

      // Update the refresh time
      await this.updateNextRefreshTime(
        em,
        guildId,
        guildData.guild.nextChallengesRefresh,
      )
    } catch (error) {
      console.error(
        `Error handling post-refresh operations for guild ${guildId}:`,
        error,
      )
    }
  }

  private async updateNextRefreshTime(
    em: any,
    guildId: string,
    newRefreshTime: string,
  ): Promise<void> {
    try {
      const guildRepository = em.getRepository(Guild)
      const guild = await guildRepository.findOne({ id: guildId })

      if (!guild) {
        console.error(`Guild ${guildId} not found`)
        return
      }

      // Convert Unix timestamp to Date
      const refreshDate = new Date(parseInt(newRefreshTime) * 1000)
      guild.nextTicketCollectionRefreshTime = refreshDate

      await em.persistAndFlush(guild)

      console.log(
        `Updated next refresh time for guild ${guildId} to ${refreshDate.toLocaleString()}`,
      )
    } catch (error) {
      console.error(
        `Error updating next refresh time for guild ${guildId}:`,
        error,
      )
    }
  }
}
