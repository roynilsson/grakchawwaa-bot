import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class ListWarningTypesCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "list-warning-types",
      description: "List all warning types configured for your guild",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
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
            "Only guild leaders and officers can view warning types.",
        })
      }

      // Fetch warning types for this guild
      const warningTypes = await container.warningTypeClient.listWarningTypes(
        comlinkPlayer.guildId,
      )

      if (!warningTypes.length) {
        return await interaction.editReply({
          content:
            "No warning types configured for this guild. Use `/create-warning-type` to create one.",
        })
      }

      // Format the list
      const lines = [
        `**Warning Types for ${comlinkGuild.guild.profile.name}**\n`,
        ...warningTypes.map((type) => {
          return `**${type.label}** (\`${type.name}\`)\n  Weight: ${type.weight} | ID: ${type.id}`
        }),
      ]

      return await interaction.editReply({
        content: lines.join("\n"),
      })
    } catch (error) {
      console.error("Error in list-warning-types command:", error)

      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while listing warning types. Please try again later.",
          ephemeral: true,
        })
      }

      return await interaction.editReply({
        content:
          "An error occurred while listing warning types. Please try again later.",
      })
    }
  }
}
