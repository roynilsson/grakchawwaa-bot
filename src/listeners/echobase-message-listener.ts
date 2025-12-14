import { Listener } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import { Message } from "discord.js"
import { EchobaseParser } from "../services/echobase-parser"
import { PlayerResolver } from "../services/player-resolver"

export class EchobaseMessageListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: "messageCreate",
    })
  }

  public override async run(message: Message) {
    // Only process messages with embeds (Echobase posts embeds)
    if (!message.embeds || message.embeds.length === 0) return

    try {
      // Check if this message is from a registered Echobase channel
      const guildChannels = await container.ticketChannelClient.getAllGuilds()

      for (const guildChannel of guildChannels) {
        if (
          guildChannel.echobase_channel_id &&
          guildChannel.echobase_channel_id === message.channelId
        ) {
          await this.processEchobaseMessage(message, guildChannel.guild_id)
          break
        }
      }
    } catch (error) {
      console.error("Error in Echobase message listener:", error)
    }
  }

  private async processEchobaseMessage(
    message: Message,
    guildId: string,
  ): Promise<void> {
    console.log(
      `Processing Echobase message from guild ${guildId} in channel ${message.channelId}`,
    )

    // Parse the Echobase message
    const parsed = EchobaseParser.parseMessage(message)
    if (!parsed) {
      console.error("Failed to parse Echobase message")
      return
    }

    console.log(
      `Parsed ${parsed.assignments.length} assignments from zone: ${parsed.zoneId}`,
    )

    // Get unique player names
    const playerNames = [
      ...new Set(parsed.assignments.map((a) => a.playerName)),
    ]

    // Resolve player names to ally codes
    const playerMap = await PlayerResolver.resolvePlayerNames(
      guildId,
      playerNames,
    )

    console.log(`Resolved ${playerMap.size}/${playerNames.length} player names`)

    // Get or create TB instance
    let tbInstance = await container.platoonAssignmentsClient.getActiveTBInstance(
      guildId,
    )

    if (!tbInstance) {
      // Create new TB instance
      // Use message timestamp as start time
      const tbEventId = `TB_${Date.now()}`
      const tbInstanceId =
        await container.platoonAssignmentsClient.createTBInstance(
          guildId,
          tbEventId,
          message.createdAt,
        )

      if (!tbInstanceId) {
        console.error("Failed to create TB instance")
        return
      }

      tbInstance = await container.platoonAssignmentsClient.getActiveTBInstance(
        guildId,
      )

      if (!tbInstance) {
        console.error("Failed to retrieve created TB instance")
        return
      }
    }

    // Store assignments in database
    let successCount = 0
    let skippedCount = 0

    for (const assignment of parsed.assignments) {
      const allyCode = playerMap.get(assignment.playerName)

      if (!allyCode) {
        console.warn(
          `Skipping assignment for unresolved player: ${assignment.playerName}`,
        )
        skippedCount++
        continue
      }

      const result = await container.platoonAssignmentsClient.upsertPlatoonAssignment(
        tbInstance.id,
        parsed.zoneId,
        assignment.platoonNumber,
        assignment.squadNumber,
        assignment.slotNumber,
        allyCode,
        assignment.unitName,
      )

      if (result) {
        successCount++
      } else {
        skippedCount++
      }
    }

    console.log(
      `Stored ${successCount} assignments, skipped ${skippedCount} (TB instance: ${tbInstance.id})`,
    )
  }
}
