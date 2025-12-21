import { Command } from "@sapphire/framework"
import { userMention } from "discord.js"
import { PlayerOperationsCommand } from "./player-operations"

export class UnregisterPlayerCommand extends Command {
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
        builder
          .setName("unregister-player")
          .setDescription("Unregister a player or an ally code")
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Ally code to unregister")
              .setRequired(false),
          ),
      { idHints: ["1328102308889755781"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const allyCode = interaction.options.getString("ally-code")
    const userCallerToMention = userMention(interaction.user.id)

    if (allyCode) {
      const saveResult = await this.playerOps.removeAllyCode(allyCode)

      if (!saveResult) {
        return interaction.reply({
          content: "Failed to unregister ally code. Make sure it's registered first.",
        })
      }

      return interaction.reply({
        content: `Unregistered ally code: ${allyCode} for ${userCallerToMention}`,
      })
    }

    const count = await this.playerOps.removeAllPlayers(interaction.user.id)

    if (count === 0) {
      return interaction.reply({
        content: "Failed to unregister players. No players found.",
      })
    }

    return interaction.reply({
      content: `Unregistered ${count} ally code${count > 1 ? "s" : ""} for ${userCallerToMention}`,
    })
  }
}
