import { Command } from "@sapphire/framework"
import { EmbedBuilder } from "discord.js"
import { PlatoonComplianceChecker } from "../../services/platoon-compliance-checker"
import { MhanndalorianClient } from "../../services/mhanndalorian/mhanndalorian-client"

export class CheckPlatoonComplianceCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "check-platoon-compliance",
      aliases: ["platoon-check", "tb-compliance"],
      description: "Check which players have not completed their platoon assignments",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply()

    try {
      // Get user's ally code from Discord ID
      const userDiscordId = interaction.user.id
      const playerData = await this.container.playerClient.getPlayer(userDiscordId)

      if (!playerData) {
        await interaction.editReply({
          content: "You are not registered. Please register your ally code first using `/register`.",
        })
        return
      }

      const userAllyCode = playerData.allyCode

      // Get player's guild from Comlink
      const playerProfile = await this.container.comlinkClient.getPlayer(userAllyCode)
      const guildId = playerProfile?.guildId

      if (!guildId) {
        await interaction.editReply({
          content: "You are not in a guild.",
        })
        return
      }

      // Get Mhanndalorian API credentials from environment
      const apiKey = process.env.MHANNDALORIAN_API_KEY
      const discordId = process.env.MHANNDALORIAN_DISCORD_ID
      const allyCode = process.env.MHANNDALORIAN_ALLY_CODE

      if (!apiKey || !discordId || !allyCode) {
        await interaction.editReply({
          content: "Mhanndalorian API credentials not configured",
        })
        return
      }

      // Create Mhanndalorian client and compliance checker
      const mhannClient = new MhanndalorianClient({
        apiKey,
        discordId,
        allyCode,
      })

      const complianceChecker = new PlatoonComplianceChecker(mhannClient)

      // Check compliance
      const result = await complianceChecker.checkCompliance(guildId)

      if (!result) {
        await interaction.editReply({
          content:
            "Failed to check platoon compliance. Make sure there is an active TB and assignments in the database.",
        })
        return
      }

      // Resolve player names
      await complianceChecker.resolvePlayerNames(guildId, result.violations)

      // Format response
      const embed = new EmbedBuilder()
        .setTitle("🎯 Platoon Compliance Report")
        .setColor(result.violations.length === 0 ? 0x00ff00 : 0xff0000)
        .addFields([
          {
            name: "📊 Summary",
            value: [
              `Total Assignments: ${result.totalAssignments}`,
              `Completed: ${result.completedAssignments}`,
              `Missing: ${result.totalAssignments - result.completedAssignments}`,
              `Compliance Rate: ${result.complianceRate.toFixed(1)}%`,
            ].join("\n"),
            inline: false,
          },
        ])
        .setTimestamp()

      if (result.violations.length === 0) {
        embed.setDescription("✅ All platoon assignments completed!")
      } else {
        // Group violations by player
        const violationText = result.violations
          .map((violation) => {
            const assignments = violation.missingAssignments
              .map(
                (a) =>
                  `  • ${a.zoneId} - Platoon ${a.platoonNumber} - Squad ${a.squadNumber} - Slot ${a.slotNumber} (${a.unitName})`,
              )
              .join("\n")
            return `**${violation.playerName}** (${violation.missingAssignments.length} missing):\n${assignments}`
          })
          .join("\n\n")

        // Discord has a 1024 character limit per field
        // If too long, split into multiple fields or send as separate message
        if (violationText.length > 1024) {
          embed.setDescription(
            `⚠️ ${result.violations.length} players have incomplete assignments. See details below.`,
          )

          // Send violations as separate message
          await interaction.editReply({ embeds: [embed] })
          await interaction.followUp({
            content: `**Missing Assignments:**\n\n${violationText}`,
          })
          return
        } else {
          embed.addFields([
            {
              name: `⚠️ Players with Missing Assignments (${result.violations.length})`,
              value: violationText,
              inline: false,
            },
          ])
        }
      }

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      console.error("Error in check-platoon-compliance command:", error)
      await interaction.editReply({
        content: `An error occurred while checking platoon compliance: ${error}`,
      })
    }
  }
}
