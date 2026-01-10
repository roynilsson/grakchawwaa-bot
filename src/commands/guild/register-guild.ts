import { Command } from "@sapphire/framework"
import { container } from "@sapphire/pieces"

export class RegisterGuildCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
    })
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("register-guild")
        .setDescription("Register your guild with the bot (Officers/Leaders only)")
    )
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    try {
      // Defer reply immediately
      await interaction.deferReply()

      // 1. Get user's main ally code from backend API
      const players = await container.backendApi.players.list({
        discordId: interaction.user.id,
        isMain: true,
      })

      const mainPlayer = players?.[0]
      if (!mainPlayer) {
        return await interaction.editReply({
          content:
            "You don't have a registered main account. Please use `/register-player <ally-code>` first.",
        })
      }

      const allyCode = mainPlayer.allyCode

      // 2. Verify registration via backend (checks Comlink for officer/leader status)
      const verification = await container.backendApi.guilds.verifyRegistration(allyCode)

      if (!verification.canRegister) {
        return await interaction.editReply({
          content: verification.message || "Failed to verify guild registration.",
        })
      }

      // 3. Register guild in backend
      try {
        await container.backendApi.guilds.create({
          guildId: verification.guildId!,
          name: verification.guildName!,
        })

        return await interaction.editReply({
          content: `Successfully registered guild **${verification.guildName}** with the bot!\n\nYou can now configure channels using:\n- \`/register-ticket-collection\`\n- \`/register-anniversary-channel\``,
        })
      } catch (error) {
        const errorMessage = (error as Error).message

        if (errorMessage.includes("already registered")) {
          return await interaction.editReply({
            content: `Guild **${verification.guildName}** is already registered with the bot.\n\nYou can configure channels using:\n- \`/register-ticket-collection\`\n- \`/register-anniversary-channel\``,
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
}
