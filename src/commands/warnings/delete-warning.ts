import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class DeleteWarningCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "delete-warning",
      description: "Delete a specific warning by ID",
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
            .setDescription("Warning ID to delete")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      const warningId = interaction.options.getInteger("id", true)

      await interaction.deferReply()

      // Get user's ally code and guild
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
          content: "Only guild leaders and officers can delete warnings.",
        })
      }

      // Get the warning to verify it exists and belongs to this guild
      const warning = await container.warningClient.getWarningById(warningId)
      if (!warning) {
        return await interaction.editReply({
          content: `Warning with ID ${warningId} not found.`,
        })
      }

      if (warning.guild_id !== comlinkPlayer.guildId) {
        return await interaction.editReply({
          content: "You can only delete warnings from your own guild.",
        })
      }

      // Delete the warning
      const success = await container.warningClient.deleteWarning(warningId)
      if (!success) {
        return await interaction.editReply({
          content: "Failed to delete warning. Please try again later.",
        })
      }

      return await interaction.editReply({
        content: `✅ Deleted warning ID ${warningId}\n**Type:** ${warning.type_label}\n**Player:** ${warning.ally_code}\n**Date:** ${new Date(warning.created_at).toLocaleString()}`,
      })
    } catch (error) {
      console.error("Error in delete-warning command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while deleting the warning. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while deleting the warning. Please try again later.",
      })
    }
  }
}
