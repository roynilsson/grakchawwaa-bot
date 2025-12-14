import { EmbedBuilder, Message } from "discord.js"

export interface PlatoonAssignment {
  playerName: string
  unitName: string
  platoonNumber: number
  squadNumber: number
  slotNumber: number
}

export interface ParsedEchobaseMessage {
  zoneId: string
  assignments: PlatoonAssignment[]
}

export class EchobaseParser {
  /**
   * Parses an Echobase platoon assignment message
   * Expected format:
   * - Message content: Zone name (e.g., "Rear Flank Mission (bottom):")
   * - Embeds: One per platoon (6 total)
   * - Embed description: Platoon number (e.g., "**PLATOON 1** - bottom")
   * - Embed fields: Player name → Units (italicized, newline-separated)
   */
  public static parseMessage(message: Message): ParsedEchobaseMessage | null {
    try {
      const assignments: PlatoonAssignment[] = []
      let zoneId: string | null = null

      // Process each embed (one per platoon)
      for (const embed of message.embeds) {
        const platoonInfo = this.extractPlatoonInfo(embed.description)
        if (!platoonInfo) {
          console.warn("Could not extract platoon info from embed description")
          continue
        }

        // Use zone from first embed
        if (!zoneId) {
          zoneId = platoonInfo.zone
        }

        // Process each field (player assignments)
        let slotNumber = 1
        for (const field of embed.fields) {
          const playerName = field.name
          const units = this.extractUnits(field.value)

          // Each unit gets a slot
          for (const unitName of units) {
            const squadNumber = Math.ceil(slotNumber / 5)
            const slotInSquad = ((slotNumber - 1) % 5) + 1

            assignments.push({
              playerName,
              unitName,
              platoonNumber: platoonInfo.number,
              squadNumber,
              slotNumber: slotInSquad,
            })

            slotNumber++
          }
        }
      }

      if (!zoneId) {
        console.error("No zone ID found in any embeds")
        return null
      }

      return {
        zoneId,
        assignments,
      }
    } catch (error) {
      console.error("Error parsing Echobase message:", error)
      return null
    }
  }

  /**
   * Extracts platoon/squadron/operation info from embed description
   * Example: "**PLATOON 1** - bottom" → { number: 1, zone: "bottom" }
   * Example: "**SQUADRON 3** - middle" → { number: 3, zone: "middle" }
   * Example: "**OPERATION 2** - top" → { number: 2, zone: "top" }
   */
  private static extractPlatoonInfo(description: string | null): { number: number; zone: string } | null {
    if (!description) return null

    // Flexible regex: match PLATOON/SQUADRON/OPERATION followed by number, closing markdown **, dash, and zone
    // Example: ":white_check_mark: **PLATOON 1** - bottom"
    const match = description.match(/(PLATOON|SQUADRON|OPERATION)\s+(\d+)\*\*\s*[\-–—]\s*(\w+)/i)

    if (!match || !match[2] || !match[3]) {
      return null
    }

    return {
      number: parseInt(match[2], 10),
      zone: match[3].toLowerCase()
    }
  }

  /**
   * Extracts unit names from field value
   * Units are italicized and separated by newlines
   * Example: "*Wampa*\n*Grand Admiral Thrawn*" → ["Wampa", "Grand Admiral Thrawn"]
   */
  private static extractUnits(fieldValue: string): string[] {
    if (!fieldValue) return []

    // Split by newlines and extract text between asterisks
    return fieldValue
      .split("\n")
      .map((line) => {
        const match = line.match(/\*([^*]+)\*/)
        if (!match || !match[1]) return null
        return match[1].trim()
      })
      .filter((unit): unit is string => unit !== null)
  }
}
