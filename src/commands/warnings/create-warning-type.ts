import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class CreateWarningTypeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "create-warning-type",
      description: "Create a new warning type for your guild",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Unique identifier for the warning type (e.g., ticket_violation)")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("Display name for the warning type (e.g., Ticket Violation)")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("weight")
            .setDescription("Severity weight (1-10, higher = more severe)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Get input values
      const name = interaction.options.getString("name", true)
      const label = interaction.options.getString("label", true)
      const weight = interaction.options.getInteger("weight", true)

      // Validate name format (alphanumeric and underscores only)
      if (!/^[a-z0-9_]+$/.test(name)) {
        return await interaction.reply({
          content:
            "Warning type name must be lowercase alphanumeric with underscores only (e.g., ticket_violation)",
          ephemeral: true,
        })
      }

      await interaction.deferReply()

      // Get player's ally code
      const player = await container.playerClient.getPlayer(interaction.user.id)
      if (!player?.allyCode) {
        return await interaction.editReply({
          content:
            "You need to register your ally code first using `/register-player`.",
        })
      }

      // Get player info from comlink
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
        false,
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
          content:
            "Only guild leaders and officers can create warning types.",
        })
      }

      // Check if warning type with this name already exists
      const existingType = await container.warningTypeClient.getWarningTypeByName(
        comlinkPlayer.guildId,
        name,
      )
      if (existingType) {
        return await interaction.editReply({
          content: `Warning type \`${name}\` already exists. Use \`/update-warning-type\` to modify it.`,
        })
      }

      // Create the warning type
      const warningType = await container.warningTypeClient.createWarningType({
        guildId: comlinkPlayer.guildId,
        name,
        label,
        weight,
      })

      if (!warningType) {
        return await interaction.editReply({
          content: "Failed to create warning type. Please try again later.",
        })
      }

      return await interaction.editReply({
        content: `✅ Created warning type:\n**${label}** (\`${name}\`) - Weight: ${weight}`,
      })
    } catch (error) {
      console.error("Error in create-warning-type command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while creating the warning type. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while creating the warning type. Please try again later.",
      })
    }
  }
}
