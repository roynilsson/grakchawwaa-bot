import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class DeleteWarningTypeCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "delete-warning-type",
      description: "Delete a warning type (WARNING: also deletes all warnings of this type)",
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
            .setDescription("ID of the warning type to delete")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      const id = interaction.options.getInteger("id", true)

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
            "Only guild leaders and officers can delete warning types.",
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
          content: "You can only delete warning types for your own guild.",
        })
      }

      // Delete the warning type (will cascade delete all warnings of this type)
      const success = await container.warningTypeClient.deleteWarningType(id)

      if (!success) {
        return await interaction.editReply({
          content: "Failed to delete warning type. Please try again later.",
        })
      }

      return await interaction.editReply({
        content: `✅ Deleted warning type **${existingType.label}** (\`${existingType.name}\`)\n⚠️ All warnings of this type have also been removed.`,
      })
    } catch (error) {
      console.error("Error in delete-warning-type command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while deleting the warning type. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while deleting the warning type. Please try again later.",
      })
    }
  }
}
