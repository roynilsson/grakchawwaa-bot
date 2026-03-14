import { Subcommand } from "@sapphire/plugin-subcommands"
import { container } from "@sapphire/pieces"
import {
  channelMention,
  TextChannel,
  type AutocompleteInteraction,
} from "discord.js"
import type { PlayerGuildMembership } from "../api/player-client"

interface CommandResponse<T = undefined> {
  success: boolean
  response: {
    content: string
    ephemeral?: boolean
  }
  value?: T
}

interface GuildMembershipData {
  allyCode: string
  membership: PlayerGuildMembership
}

export class OfficerCommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, {
      ...options,
      name: "officer",
      subcommands: [
        {
          name: "setup",
          type: "group",
          entries: [
            { name: "register-guild", chatInputRun: "chatInputRegisterGuild" },
            { name: "channel-add", chatInputRun: "chatInputChannelAdd" },
            { name: "channel-remove", chatInputRun: "chatInputChannelRemove" },
          ],
        },
      ],
    })
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("officer")
        .setDescription("Officer-only guild management commands")
        .addSubcommandGroup((group) =>
          group
            .setName("setup")
            .setDescription("Guild setup and channel management")
            .addSubcommand((sub) =>
              sub
                .setName("register-guild")
                .setDescription(
                  "Register your guild with the bot (Officers/Leaders only)",
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName("channel-add")
                .setDescription("Pre-approve a Discord channel for bot use")
                .addChannelOption((option) =>
                  option
                    .setName("channel")
                    .setDescription("Discord channel to register")
                    .setRequired(true),
                )
                .addStringOption((option) =>
                  option
                    .setName("ally-code")
                    .setDescription("Select one of your registered accounts")
                    .setRequired(false)
                    .setAutocomplete(true),
                ),
            )
            .addSubcommand((sub) =>
              sub
                .setName("channel-remove")
                .setDescription(
                  "Remove a pre-approved Discord channel from bot use",
                )
                .addChannelOption((option) =>
                  option
                    .setName("channel")
                    .setDescription("Discord channel to unregister")
                    .setRequired(true),
                )
                .addStringOption((option) =>
                  option
                    .setName("ally-code")
                    .setDescription("Select one of your registered accounts")
                    .setRequired(false)
                    .setAutocomplete(true),
                ),
            ),
        ),
    )
  }

  public override async autocompleteRun(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "ally-code") {
      try {
        const players = await container.backendApi.players.list({
          discordId: interaction.user.id,
        })

        const choices = players.map(
          (player: { name?: string; allyCode: string; isMain?: boolean }) => ({
            name: player.name
              ? `${player.name} (${player.allyCode})${player.isMain ? " - Main" : ""}`
              : `${player.allyCode}${player.isMain ? " - Main" : ""}`,
            value: player.allyCode,
          }),
        )

        return interaction.respond(choices.slice(0, 25))
      } catch {
        return interaction.respond([])
      }
    }
  }

  // ============================================
  // /officer setup register-guild
  // ============================================
  public async chatInputRegisterGuild(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      await interaction.deferReply()

      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
        isMain: true,
      })

      const mainPlayer = players?.[0]
      if (!mainPlayer) {
        return await interaction.editReply({
          content:
            "You don't have a registered main account. Please use `/player register <ally-code>` first.",
        })
      }

      const allyCode = mainPlayer.allyCode

      const verification =
        await container.backendApi.guilds.verifyRegistration(allyCode)

      if (!verification.canRegister) {
        return await interaction.editReply({
          content:
            verification.message || "Failed to verify guild registration.",
        })
      }

      try {
        await container.backendApi.guilds.create({
          guildId: verification.guildId!,
          name: verification.guildName!,
        })

        return await interaction.editReply({
          content: `Successfully registered guild **${verification.guildName}** with the bot!\n\nYou can now configure automations and channels via the web dashboard.`,
        })
      } catch (error) {
        const errorMessage = (error as Error).message

        if (errorMessage.includes("already registered")) {
          return await interaction.editReply({
            content: `Guild **${verification.guildName}** is already registered with the bot.\n\nYou can configure automations and channels via the web dashboard.`,
          })
        }

        console.error("Failed to register guild:", error)
        return await interaction.editReply({
          content: "Failed to register guild. Please try again later.",
        })
      }
    } catch (error) {
      console.error("Error in register-guild command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while registering your guild. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer setup channel-add
  // ============================================
  public async chatInputChannelAdd(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      await interaction.deferReply()

      const allyCodeResult = await this.resolveAllyCode(interaction)
      if (!allyCodeResult.success || !allyCodeResult.value) {
        return await interaction.editReply(allyCodeResult.response)
      }

      const validationResult = await this.validateAllyCodeOwnership(
        interaction.user.id,
        allyCodeResult.value,
      )
      if (!validationResult.success) {
        return await interaction.editReply(validationResult.response)
      }

      const membershipResult = await this.getGuildMembership(
        allyCodeResult.value,
      )
      if (!membershipResult.success || !membershipResult.value) {
        return await interaction.editReply(membershipResult.response)
      }

      if (membershipResult.value.membership.memberLevel < 3) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can register channels for the guild.",
        })
      }

      const registrationResult = await this.registerChannel(
        membershipResult.value.membership.guildId,
        channel.value.id,
        channel.value.name,
      )
      if (!registrationResult.success) {
        return await interaction.editReply(registrationResult.response)
      }

      return await interaction.editReply({
        content: `Channel ${channelMention(channel.value.id)} has been registered for guild **${membershipResult.value.membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in channel-add command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // /officer setup channel-remove
  // ============================================
  public async chatInputChannelRemove(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    try {
      const channel = this.validateChannel(interaction)
      if (!channel.success || !channel.value) {
        return await interaction.reply(channel.response)
      }

      await interaction.deferReply()

      const allyCodeResult = await this.resolveAllyCode(interaction)
      if (!allyCodeResult.success || !allyCodeResult.value) {
        return await interaction.editReply(allyCodeResult.response)
      }

      const validationResult = await this.validateAllyCodeOwnership(
        interaction.user.id,
        allyCodeResult.value,
      )
      if (!validationResult.success) {
        return await interaction.editReply(validationResult.response)
      }

      const membershipResult = await this.getGuildMembership(
        allyCodeResult.value,
      )
      if (!membershipResult.success || !membershipResult.value) {
        return await interaction.editReply(membershipResult.response)
      }

      if (membershipResult.value.membership.memberLevel < 3) {
        return await interaction.editReply({
          content:
            "Only guild leaders and officers can unregister channels from the guild.",
        })
      }

      const unregistrationResult = await this.unregisterChannel(
        membershipResult.value.membership.guildId,
        channel.value.id,
      )
      if (!unregistrationResult.success) {
        return await interaction.editReply(unregistrationResult.response)
      }

      return await interaction.editReply({
        content: `Channel ${channelMention(channel.value.id)} has been unregistered from guild **${membershipResult.value.membership.guildName}**.`,
      })
    } catch (error) {
      if (!interaction.deferred) {
        return await interaction.reply({
          content:
            "An error occurred while processing your request. Please try again later.",
          ephemeral: true,
        })
      }

      container.logger.error("Error in channel-remove command:", error)
      return await interaction.editReply({
        content:
          "An error occurred while processing your request. Please try again later.",
      })
    }
  }

  // ============================================
  // Helper methods
  // ============================================
  private validateChannel(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): CommandResponse<TextChannel> {
    const channel = interaction.options.getChannel("channel")
    if (!channel || !(channel instanceof TextChannel)) {
      return {
        success: false,
        response: {
          content: "Please provide a valid text channel.",
          ephemeral: true,
        },
      }
    }
    return {
      success: true,
      response: { content: "" },
      value: channel,
    }
  }

  private async resolveAllyCode(
    interaction: Subcommand.ChatInputCommandInteraction,
  ): Promise<CommandResponse<string>> {
    const inputAllyCode = interaction.options.getString("ally-code")

    if (inputAllyCode) {
      return {
        success: true,
        response: { content: "" },
        value: inputAllyCode.replace(/-/g, ""),
      }
    }

    const players = await container.backendApi.players.list({
      discordId: interaction.user.id,
      isMain: true,
    })

    const mainPlayer = players[0]
    if (!mainPlayer) {
      return {
        success: false,
        response: {
          content:
            "You don't have a registered ally code. Please register with `/player register` first.",
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: mainPlayer.allyCode,
    }
  }

  private async validateAllyCodeOwnership(
    discordId: string,
    allyCode: string,
  ): Promise<CommandResponse> {
    const players = await container.backendApi.players.list({ discordId })
    const ownsAllyCode = players.some(
      (p: { allyCode: string }) => p.allyCode === allyCode,
    )

    if (!ownsAllyCode) {
      return {
        success: false,
        response: {
          content:
            "You can only manage channels for guilds using your own registered ally codes.",
        },
      }
    }

    return { success: true, response: { content: "" } }
  }

  private async getGuildMembership(
    allyCode: string,
  ): Promise<CommandResponse<GuildMembershipData>> {
    const membership =
      await container.backendApi.players.getGuildMembership(allyCode)

    if (!membership) {
      return {
        success: false,
        response: {
          content: `Player ${allyCode} is not a member of any registered guild. Please ensure the guild is registered with \`/officer setup register-guild\` first.`,
        },
      }
    }

    return {
      success: true,
      response: { content: "" },
      value: { allyCode, membership },
    }
  }

  private async registerChannel(
    guildId: string,
    discordChannelId: string,
    channelName: string,
  ): Promise<CommandResponse> {
    try {
      const existingChannel =
        await container.backendApi.guilds.findChannelByDiscordId(
          guildId,
          discordChannelId,
        )

      if (existingChannel) {
        return {
          success: false,
          response: {
            content: "This channel is already registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.addChannel(guildId, {
        discordChannelId,
        name: channelName,
      })

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to register channel:", error)
      return {
        success: false,
        response: {
          content: "Failed to register channel. Please try again later.",
        },
      }
    }
  }

  private async unregisterChannel(
    guildId: string,
    discordChannelId: string,
  ): Promise<CommandResponse> {
    try {
      const registeredChannel =
        await container.backendApi.guilds.findChannelByDiscordId(
          guildId,
          discordChannelId,
        )

      if (!registeredChannel) {
        return {
          success: false,
          response: {
            content: "This channel is not registered for this guild.",
          },
        }
      }

      await container.backendApi.guilds.removeChannel(
        guildId,
        registeredChannel.id,
      )

      return { success: true, response: { content: "" } }
    } catch (error) {
      container.logger.error("Failed to unregister channel:", error)
      return {
        success: false,
        response: {
          content: "Failed to unregister channel. Please try again later.",
        },
      }
    }
  }
}
