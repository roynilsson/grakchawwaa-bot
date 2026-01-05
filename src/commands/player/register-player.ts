import { Command } from "@sapphire/framework"
import { userMention } from "discord.js"
import { normalizeAllyCode } from "../../utils/ally-code"

export class RegisterPlayerCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder //
          .setName("register-player")
          .setDescription("Register a player with an ally code")
          .addStringOption((option) =>
            option
              .setName("ally-code")
              .setDescription("Ally code to register")
              .setRequired(true),
          )
          .addBooleanOption((option) =>
            option
              .setName("is-alt")
              .setDescription("Mark the ally code as an alternate")
              .setRequired(false),
          )
          .addUserOption((option) =>
            option
              .setName("discord-user")
              .setDescription("Discord user to register")
              .setRequired(false),
          ),
      { idHints: ["1328102310261297253"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)
    const isAlt = interaction.options.getBoolean("is-alt") ?? false
    const targetUser =
      interaction.options.getUser("discord-user") ?? interaction.user
    const targetTag = userMention(targetUser.id)
    const requestedBy =
      targetUser.id === interaction.user.id
        ? null
        : userMention(interaction.user.id)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    // Defer reply immediately to avoid Discord timeout
    await interaction.deferReply()

    console.log(
      "Received register player command",
      normalizedAllyCode,
      "isAlt:",
      isAlt,
    )

    try {
      // Check if this ally code already exists
      let player
      try {
        player = await this.container.backendApi.players.get(normalizedAllyCode)
      } catch (error) {
        // Player doesn't exist, will create new
        player = null
      }

      const accountType = isAlt ? "alternate" : "main"
      const requesterNote = targetUser.id === interaction.user.id
        ? ""
        : ` (requested by ${userMention(interaction.user.id)})`

      if (player) {
        // Update existing player
        await this.container.backendApi.players.update(normalizedAllyCode, {
          discordId: targetUser.id,
          isMain: !isAlt,
        })

        return interaction.editReply({
          content: `Updated ${accountType} account with ally code ${normalizedAllyCode} for ${targetTag}${requesterNote}.`,
        })
      } else {
        // Create new player
        await this.container.backendApi.players.create({
          allyCode: normalizedAllyCode,
          discordId: targetUser.id,
          isMain: !isAlt,
        })

        return interaction.editReply({
          content: `Registered ${accountType} account with ally code ${normalizedAllyCode} for ${targetTag}${requesterNote}.`,
        })
      }
    } catch (error) {
      console.error("Error registering player:", error)
      return interaction.editReply({
        content: `Failed to register ally code. ${(error as Error).message}`,
      })
    }
  }
}
