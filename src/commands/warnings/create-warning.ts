import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import { ApplicationCommandOptionChoiceData } from "discord.js"

export class CreateWarningCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "create-warning",
      description: "Issue a warning to a guild member",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("ally-code")
            .setDescription("Player's ally code (e.g., 123-456-789 or 123456789)")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("warning-type")
            .setDescription("Type of warning")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName("notes")
            .setDescription("Additional notes about the warning")
            .setRequired(false),
        ),
    )
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    try {
      const focusedOption = interaction.options.getFocused(true)

      if (focusedOption.name === "warning-type") {
        // Get player's guild
        const player = await container.playerClient.getPlayer(interaction.user.id)
        if (!player?.allyCode) {
          return await interaction.respond([])
        }

        const comlinkPlayer = await container.cachedComlinkClient.getPlayer(
          player.allyCode,
        )
        if (!comlinkPlayer?.guildId) {
          return await interaction.respond([])
        }

        // Get warning types for this guild
        const warningTypes = await container.warningTypeClient.listWarningTypes(
          comlinkPlayer.guildId,
        )

        const choices: ApplicationCommandOptionChoiceData[] = warningTypes.map(
          (type) => ({
            name: `${type.label} (weight: ${type.weight})`,
            value: type.id.toString(),
          }),
        )

        return await interaction.respond(choices.slice(0, 25)) // Discord limit
      }

      return await interaction.respond([])
    } catch (error) {
      console.error("Error in create-warning autocomplete:", error)
      return await interaction.respond([])
    }
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      const allyCodeInput = interaction.options.getString("ally-code", true)
      const warningTypeId = parseInt(
        interaction.options.getString("warning-type", true),
        10,
      )
      const notes = interaction.options.getString("notes")

      // Normalize ally code
      const allyCode = allyCodeInput.replace(/-/g, "")
      if (!/^\d{9}$/.test(allyCode)) {
        return await interaction.reply({
          content: "Invalid ally code format. Must be 9 digits.",
          ephemeral: true,
        })
      }

      await interaction.deferReply()

      // Get issuer's ally code and guild
      const player = await container.playerClient.getPlayer(interaction.user.id)
      if (!player?.allyCode) {
        return await interaction.editReply({
          content:
            "You need to register your ally code first using `/register-player`.",
        })
      }

      const comlinkPlayer = await container.cachedComlinkClient.getPlayer(
        player.allyCode,
      )
      if (!comlinkPlayer?.guildId) {
        return await interaction.editReply({
          content: "You must be in a guild to use this command.",
        })
      }

      // Get guild info and verify permissions
      const comlinkGuild = await container.cachedComlinkClient.getGuild(
        comlinkPlayer.guildId,
        true,
      )
      if (!comlinkGuild?.guild?.member) {
        return await interaction.editReply({
          content:
            "Could not verify your guild information. Please try again later.",
        })
      }

      // Check if user is officer or leader
      const guildMember = comlinkGuild.guild.member.find(
        (m) => m.playerId === comlinkPlayer.playerId,
      )
      if (!guildMember || guildMember.memberLevel < 3) {
        return await interaction.editReply({
          content: "Only guild leaders and officers can issue warnings.",
        })
      }

      // Verify warning type exists and belongs to this guild
      const warningType = await container.warningTypeClient.getWarningTypeById(
        warningTypeId,
      )
      if (!warningType) {
        return await interaction.editReply({
          content: `Warning type not found. Use \`/list-warning-types\` to see available types.`,
        })
      }

      if (warningType.guild_id !== comlinkPlayer.guildId) {
        return await interaction.editReply({
          content: "This warning type does not belong to your guild.",
        })
      }

      // Verify the target player exists and is in the guild
      const targetPlayer = await container.comlinkClient.getPlayer(allyCode)
      if (!targetPlayer) {
        return await interaction.editReply({
          content: `Could not find player with ally code ${allyCodeInput}.`,
        })
      }

      const targetInGuild = comlinkGuild.guild.member.find(
        (m) => m.playerId === targetPlayer.playerId,
      )
      if (!targetInGuild) {
        return await interaction.editReply({
          content: `Player ${targetPlayer.name} is not in your guild.`,
        })
      }

      // Create the warning
      const warning = await container.warningClient.createWarning({
        guildId: comlinkPlayer.guildId,
        allyCode,
        warningTypeId,
        notes: notes ?? undefined,
        createdBy: interaction.user.id,
      })

      if (!warning) {
        return await interaction.editReply({
          content: "Failed to create warning. Please try again later.",
        })
      }

      const notesText = notes ? `\n**Notes:** ${notes}` : ""
      return await interaction.editReply({
        content: `✅ Warning issued to **${targetPlayer.name}** (${allyCodeInput})\n**Type:** ${warningType.label} (Weight: ${warningType.weight})${notesText}`,
      })
    } catch (error) {
      console.error("Error in create-warning command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while creating the warning. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while creating the warning. Please try again later.",
      })
    }
  }
}
