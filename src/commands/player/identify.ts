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
          .setDescription("Identify the player and it's ally code"),
      { idHints: ["1328102307581394945"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const userId = interaction.user.id

    const players = await this.container.playerClient.getPlayersByDiscordId(userId)

    if (players.length === 0) {
      return interaction.reply({
        content: "Failed to identify player",
      })
    }

    const userCallerToMention = userMention(interaction.user.id)

    // First player (alt=1) is primary
    const primaryPlayer = players.find((p) => p.alt === 1) ?? players[0]
    const primaryAllyCode = formatAllyCode(primaryPlayer!.allyCode)

    // Rest are alts (alt > 1)
    const altPlayers = players.filter((p) => p.alt > 1)
    const altAllyCodes = altPlayers.map((p) => formatAllyCode(p.allyCode))

    const altSummary =
      altAllyCodes.length > 0 ? altAllyCodes.join(", ") : "None registered"

    return interaction.reply({
      content: [
        `Identified player for ${userCallerToMention}`,
        `Primary ally code: ${primaryAllyCode}`,
        `Alt ally codes: ${altSummary}`,
      ].join("\n"),
    })
  }

}
