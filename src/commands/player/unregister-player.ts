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
    const allyCodeInput = interaction.options.getString("ally-code")
    const userCallerToMention = userMention(interaction.user.id)

    if (allyCodeInput) {
      // Unregister specific ally code
      const normalizedAllyCode = normalizeAllyCode(allyCodeInput)

      if (!normalizedAllyCode) {
        return interaction.reply({
          content: "Please provide a valid ally code (123-456-789).",
        })
      }

      const saveResult =
        await this.container.playerClient.removeAllyCode(normalizedAllyCode)

      if (!saveResult) {
        return interaction.reply({
          content: "Failed to unregister ally code",
        })
      }

      return interaction.reply({
        content: `Unregistered ally code: ${normalizedAllyCode} for ${userCallerToMention}`,
      })
    }

    // Unregister all ally codes for this user
    const saveResult = await this.container.playerClient.removeAllForDiscordId(
      interaction.user.id,
    )

    if (!saveResult) {
      return interaction.reply({
        content: "Failed to unregister player",
      })
    }

    return interaction.reply({
      content: `Unregistered player ${userCallerToMention} and all associated ally codes`,
    })
  }
}
