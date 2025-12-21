import { Command } from "@sapphire/framework"
import { userMention } from "discord.js"
import { formatAllyCode } from "@grakchawwaa/core"
import { PlayerOperationsCommand } from "./player-operations"

export class IdentifyCommand extends Command {
  private playerOps: PlayerOperationsCommand

  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
    this.playerOps = new PlayerOperationsCommand(context, options)
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

    const players = await this.playerOps.getAllPlayers(userId)
    if (players.length === 0) {
      return interaction.reply({
        content: "No registered players found. Please register with `/register-player` first.",
      })
    }

    const userCallerToMention = userMention(interaction.user.id)
    const mainPlayer = players.find(p => p.isMain)
    const altPlayers = players.filter(p => !p.isMain)

    const lines = [`Identified players for ${userCallerToMention}`]

    if (mainPlayer) {
      lines.push(`Main ally code: ${formatAllyCode(mainPlayer.allyCode)}`)
    }

    if (altPlayers.length > 0) {
      const altCodes = altPlayers.map(p => formatAllyCode(p.allyCode)).join(", ")
      lines.push(`Alt ally codes: ${altCodes}`)
    } else {
      lines.push(`Alt ally codes: None registered`)
    }

    return interaction.reply({
      content: lines.join("\n"),
    })
  }

}
