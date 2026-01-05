import { Command } from "@sapphire/framework"
import { userMention } from "discord.js"
import { normalizeAllyCode } from "../../utils/ally-code"

export class UnregisterPlayerCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("unregister-player")
          .setDescription("Unregister a player by ally code")
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Ally code to unregister")
              .setRequired(true),
          ),
      { idHints: ["1328102308889755781"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    // Defer reply immediately to avoid Discord timeout
    await interaction.deferReply()

    try {
      await this.container.backendApi.players.delete(normalizedAllyCode)

      const userCallerToMention = userMention(interaction.user.id)
      return interaction.editReply({
        content: `Unregistered player with ally code ${normalizedAllyCode} for ${userCallerToMention}`,
      })
    } catch (error) {
      console.error("Error unregistering player:", error)
      return interaction.editReply({
        content: `Failed to unregister ally code. ${(error as Error).message}`,
      })
    }
  }
}
