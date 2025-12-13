import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"
import { PermissionFlagsBits } from "discord.js"

export class UnregisterEchobaseChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "unregister-echobase-channel",
      description: "Unregisters the guild's Echobase channel",
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
      { idHints: ["1449422821905399999"] },
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    // First defer the reply to ensure we don't timeout
    await interaction.deferReply()

    try {
      // Get player's ally code
      const playerData = await container.playerClient.getPlayer(
        interaction.user.id,
      )
      if (!playerData) {
        return interaction.editReply({
          content:
            "You need to register your ally code first using the /register-player command.",
        })
      }

      // Get player info from comlink
      const comlinkPlayer = await container.cachedComlinkClient.getPlayer(
        playerData.allyCode,
      )
      if (!comlinkPlayer) {
        return interaction.editReply({
          content:
            "Could not verify your player information. Please try again later.",
        })
      }

      // Get guild info from comlink
      if (!comlinkPlayer.guildId) {
        return interaction.editReply({
          content: "You must be in a guild to use this command.",
        })
      }

      const comlinkGuild = await container.cachedComlinkClient.getGuild(
        comlinkPlayer.guildId,
        false,
      )
      if (!comlinkGuild?.guild?.member) {
        return interaction.editReply({
          content:
            "Could not verify your guild information. Please try again later.",
        })
      }

      // Find the player in the guild and check their role
      const guildMember = comlinkGuild.guild.member.find(
        (m) => m.playerId === comlinkPlayer.playerId,
      )
      if (!guildMember || guildMember.memberLevel < 2) {
        return interaction.editReply({
          content:
            "Only guild leaders and officers can unregister the Echobase channel.",
        })
      }

      // Check if the guild is registered for Echobase
      const guildChannels =
        await container.ticketChannelClient.getGuildMessageChannels(
          comlinkGuild.guild.profile.id,
        )
      if (!guildChannels || !guildChannels.echobase_channel_id) {
        return interaction.editReply({
          content: "This guild does not have a registered Echobase channel.",
        })
      }

      // Unregister the guild
      const success =
        await container.ticketChannelClient.unregisterEchobaseChannel(
          comlinkPlayer.guildId,
        )
      if (!success) {
        return interaction.editReply({
          content: "Failed to unregister Echobase channel. Please try again later.",
        })
      }

      return interaction.editReply({
        content:
          "Successfully unregistered the Echobase channel. The bot will no longer monitor Echobase assignments.",
      })
    } catch (error) {
      console.error("Error in unregister-echobase-channel command:", error)

      // Make sure we're still responding even if there's an error
      return interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }
}
