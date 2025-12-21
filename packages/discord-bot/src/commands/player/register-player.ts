import { Command } from "@sapphire/framework"
import { User, userMention } from "discord.js"
import { normalizeAllyCode } from "@grakchawwaa/core"
import { PlayerOperationsCommand } from "./player-operations"

export class RegisterPlayerCommand extends Command {
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
              .setDescription("Mark this as an alt account (default: false, registers as main)")
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
    const isMain = !isAlt
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

    console.log(
      "Received register player command",
      normalizedAllyCode,
      "isAlt:",
      isAlt,
    )

    // Check if this user already has players registered
    const existingPlayers = await this.playerOps.getAllPlayers(targetUser.id)

    // Check if this ally code is already registered
    const allyCodeExists = existingPlayers.some(
      p => p.allyCode === normalizedAllyCode
    )

    if (allyCodeExists) {
      return interaction.reply({
        content: "This ally code is already registered.",
      })
    }

    const saveResult = await this.playerOps.addUser(
      targetUser.id,
      normalizedAllyCode,
      isMain,
    )

    if (!saveResult.success) {
      return interaction.reply({
        content: saveResult.error || "Failed to save player",
      })
    }

    const accountType = isMain ? "main" : "alt"
    const baseMessage =
      `Registered ${accountType} ally code: ${normalizedAllyCode} ` +
      `for ${targetTag}`
    const replyMessage = `${baseMessage}${this.formatRequesterNote(
      requestedBy,
    )}.`

    return interaction.reply({
      content: replyMessage,
    })
  }

  private formatRequesterNote(requestedBy: string | null): string {
    if (!requestedBy) {
      return ""
    }

    return ` (requested by ${requestedBy})`
  }
}
