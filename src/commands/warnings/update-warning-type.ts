import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class UpdateWarningTypeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "update-warning-type",
      description: "Update an existing warning type",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option
            .setName("id")
            .setDescription("ID of the warning type to update")
            .setRequired(true)
            .setMinValue(1),
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("New display name for the warning type")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("weight")
            .setDescription("New severity weight (1-10)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      const id = interaction.options.getInteger("id", true)
      const label = interaction.options.getString("label")
      const weight = interaction.options.getInteger("weight")

      // Must provide at least one field to update
      if (!label && weight === null) {
        return await interaction.reply({
          content: "You must provide at least one field to update (label or weight).",
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
            "Only guild leaders and officers can update warning types.",
        })
      }

      // Verify the warning type exists and belongs to this guild
      const existingType = await container.warningTypeClient.getWarningTypeById(id)
      if (!existingType) {
        return await interaction.editReply({
          content: `Warning type with ID ${id} not found.`,
        })
      }

      if (existingType.guild_id !== comlinkPlayer.guildId) {
        return await interaction.editReply({
          content: "You can only update warning types for your own guild.",
        })
      }

      // Update the warning type
      const updatedType = await container.warningTypeClient.updateWarningType({
        id,
        label: label ?? undefined,
        weight: weight ?? undefined,
      })

      if (!updatedType) {
        return await interaction.editReply({
          content: "Failed to update warning type. Please try again later.",
        })
      }

      const changes = []
      if (label) changes.push(`Label: ${label}`)
      if (weight !== null) changes.push(`Weight: ${weight}`)

      return await interaction.editReply({
        content: `✅ Updated warning type **${updatedType.label}** (\`${updatedType.name}\`)\nChanges: ${changes.join(", ")}`,
      })
    } catch (error) {
      console.error("Error in update-warning-type command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while updating the warning type. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while updating the warning type. Please try again later.",
      })
    }
  }
}
