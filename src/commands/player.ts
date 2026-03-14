import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import { userMention } from "discord.js"
import { normalizeAllyCode, formatAllyCode } from "../utils/ally-code"

export class PlayerCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "player",
      subcommands: [
        { name: "register", chatInputRun: "chatInputRegister" },
        { name: "unregister", chatInputRun: "chatInputUnregister" },
        { name: "identify", chatInputRun: "chatInputIdentify" },
      ],
    })
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("player")
        .setDescription("Player account management")
        .addSubcommand((sub) =>
          sub
            .setName("register")
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
        )
        .addSubcommand((sub) =>
          sub
            .setName("unregister")
            .setDescription("Unregister a player by ally code")
            .addStringOption((option) =>
              option
                .setName("ally-code")
                .setDescription("Ally code to unregister")
                .setRequired(true),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("identify")
            .setDescription("Show your registered ally codes"),
        ),
    )
  }

  public async chatInputRegister(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)
    const isAlt = interaction.options.getBoolean("is-alt") ?? false
    const targetUser =
      interaction.options.getUser("discord-user") ?? interaction.user
    const targetTag = userMention(targetUser.id)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    await interaction.deferReply()

    console.log(
      "Received register player command",
      normalizedAllyCode,
      "isAlt:",
      isAlt,
    )

    try {
      let player
      try {
        player = await container.backendApi.players.get(normalizedAllyCode)
      } catch {
        player = null
      }

      const accountType = isAlt ? "alternate" : "main"
      const requesterNote =
        targetUser.id === interaction.user.id
          ? ""
          : ` (requested by ${userMention(interaction.user.id)})`

      if (player) {
        await container.backendApi.players.update(normalizedAllyCode, {
          discordId: targetUser.id,
          discordUsername: targetUser.username,
          isMain: !isAlt,
        })

        return interaction.editReply({
          content: `Updated ${accountType} account with ally code ${normalizedAllyCode} for ${targetTag}${requesterNote}.`,
        })
      } else {
        await container.backendApi.players.create({
          allyCode: normalizedAllyCode,
          discordId: targetUser.id,
          discordUsername: targetUser.username,
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

  public async chatInputUnregister(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const allyCodeInput = interaction.options.getString("ally-code")
    const normalizedAllyCode = normalizeAllyCode(allyCodeInput)

    if (!normalizedAllyCode) {
      return interaction.reply({
        content: "Please provide a valid ally code (123-456-789).",
      })
    }

    await interaction.deferReply()

    try {
      await container.backendApi.players.delete(normalizedAllyCode)

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

  public async chatInputIdentify(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply()

    try {
      const players = await container.backendApi.players.list({
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
