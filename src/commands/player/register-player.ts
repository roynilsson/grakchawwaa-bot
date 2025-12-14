import { Command } from "@sapphire/framework"
import { User, userMention } from "discord.js"
import { normalizeAllyCode } from "../../utils/ally-code"
import { CachedComlinkClient } from "../../services/comlink/cached-comlink-client"

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

    console.log(
      "Received register player command",
      normalizedAllyCode,
      "isAlt:",
      isAlt,
    )

    const existingPlayers =
      await this.container.playerClient.getPlayersByDiscordId(targetUser.id)

    if (existingPlayers.length === 0) {
      return this.registerNewPlayer({
        interaction,
        allyCode: normalizedAllyCode,
        targetUser,
        targetTag,
        requestedBy,
      })
    }

    return this.updateExistingPlayer({
      interaction,
      allyCode: normalizedAllyCode,
      isAlt,
      targetTag,
      requestedBy,
      targetUser,
      existingPlayers,
    })
  }

  private async registerNewPlayer({
    interaction,
    allyCode,
    targetUser,
    targetTag,
    requestedBy,
  }: {
    interaction: Command.ChatInputCommandInteraction
    allyCode: string
    targetUser: User
    targetTag: string
    requestedBy: string | null
  }) {
    // Fetch player data from Comlink
    const comlinkClient = CachedComlinkClient.getInstance()
    let playerData: { playerId?: string; playerName?: string; guildId?: string } | undefined

    try {
      const comlinkPlayer = await comlinkClient.getPlayer(allyCode)
      if (comlinkPlayer) {
        // Check if player is in a guild
        if (!comlinkPlayer.guildId) {
          return interaction.reply({
            content: "This player is not in a guild. Only players in guilds can be registered.",
          })
        }

        // Ensure guild exists in guilds table
        await this.container.guildClient.ensureGuildExists(
          comlinkPlayer.guildId,
          comlinkPlayer.guildName,
        )

        playerData = {
          playerId: comlinkPlayer.playerId,
          playerName: comlinkPlayer.name,
          guildId: comlinkPlayer.guildId,
        }
      }
    } catch (error) {
      console.error("Error fetching player data from Comlink:", error)
      // Continue without player data - it's optional
    }

    const saveResult = await this.container.playerClient.registerAllyCode(
      targetUser.id,
      allyCode,
      true, // isPrimary
      playerData,
    )

    if (!saveResult) {
      return interaction.reply({
        content: "Failed to save player",
      })
    }

    const baseMessage =
      `Registered player with ally code: ${allyCode} ` + `for ${targetTag}`
    const replyMessage = `${baseMessage}${this.formatRequesterNote(
      requestedBy,
    )}.`

    return interaction.reply({
      content: replyMessage,
    })
  }

  private async updateExistingPlayer({
    interaction,
    allyCode,
    isAlt,
    targetTag,
    requestedBy,
    targetUser,
    existingPlayers,
  }: {
    interaction: Command.ChatInputCommandInteraction
    allyCode: string
    isAlt: boolean
    targetTag: string
    requestedBy: string | null
    targetUser: User
    existingPlayers: { allyCode: string; alt: number }[]
  }) {
    const requesterNote = this.formatRequesterNote(requestedBy)

    // Check if ally code is already registered
    const alreadyRegistered = existingPlayers.some(
      (p) => p.allyCode === allyCode,
    )

    if (alreadyRegistered) {
      const existingPlayer = existingPlayers.find((p) => p.allyCode === allyCode)
      if (existingPlayer?.alt === 1) {
        return interaction.reply({
          content: "This ally code is already registered as primary.",
        })
      } else {
        return interaction.reply({
          content: "This ally code is already registered as an alternate.",
        })
      }
    }

    // Fetch player data from Comlink
    const comlinkClient = CachedComlinkClient.getInstance()
    let playerData: { playerId?: string; playerName?: string; guildId?: string } | undefined

    try {
      const comlinkPlayer = await comlinkClient.getPlayer(allyCode)
      if (comlinkPlayer) {
        // Check if player is in a guild
        if (!comlinkPlayer.guildId) {
          return interaction.reply({
            content: "This player is not in a guild. Only players in guilds can be registered.",
          })
        }

        // Ensure guild exists in guilds table
        await this.container.guildClient.ensureGuildExists(
          comlinkPlayer.guildId,
          comlinkPlayer.guildName,
        )

        playerData = {
          playerId: comlinkPlayer.playerId,
          playerName: comlinkPlayer.name,
          guildId: comlinkPlayer.guildId,
        }
      }
    } catch (error) {
      console.error("Error fetching player data from Comlink:", error)
      // Continue without player data - it's optional
    }

    if (isAlt) {
      // Add as new alt
      const saveResult = await this.container.playerClient.registerAllyCode(
        targetUser.id,
        allyCode,
        false, // isPrimary = false
        playerData,
      )

      if (!saveResult) {
        return interaction.reply({
          content: "Failed to save player",
        })
      }

      return interaction.reply({
        content:
          `Added alternate ally code ${allyCode} for ${targetTag}` +
          `${requesterNote}.`,
      })
    }

    // Replace primary (isAlt = false)
    const saveResult = await this.container.playerClient.registerAllyCode(
      targetUser.id,
      allyCode,
      true, // isPrimary = true
      playerData,
    )

    if (!saveResult) {
      return interaction.reply({
        content: "Failed to save player",
      })
    }

    return interaction.reply({
      content:
        `Updated primary ally code to ${allyCode} for ${targetTag}` +
        `${requesterNote}.`,
    })
  }

  private formatRequesterNote(requestedBy: string | null): string {
    if (!requestedBy) {
      return ""
    }

    return ` (requested by ${requestedBy})`
  }
}
