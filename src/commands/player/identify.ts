import { Command } from "@sapphire/framework"
import { userMention } from "discord.js"
import { formatAllyCode } from "../../utils/ally-code"

export class IdentifyCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName("identify")
          .setDescription("Show your registered ally codes"),
      { idHints: ["1328102307581394945"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    // Defer reply immediately to avoid Discord timeout
    await interaction.deferReply()

    try {
      const players = await this.container.backendApi.players.list({
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
}
