import "@sapphire/plugin-subcommands/register"
import { container } from "@sapphire/pieces"
import { BackendApiClient } from "./api"
import { DiscordBotClient } from "./discord-bot-client"
import { ViolationSummaryService } from "./services/violation-summary"
import { NotificationWorker } from "./workers/notificationWorker"

// Initialize backend API client
const backendApiUrl = process.env.BACKEND_API_URL || "http://localhost:3000"
const internalApiKey = process.env.INTERNAL_API_KEY
container.backendApi = new BackendApiClient(backendApiUrl, internalApiKey)
console.log(`Backend API URL: ${backendApiUrl}`)

const client = new DiscordBotClient()
const summaryService = new ViolationSummaryService(client)
client.on("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  // Start the notification worker (handles all bot-processed automations)
  const notificationWorker = new NotificationWorker(client)
  notificationWorker.start()
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) {
    return
  }

  await summaryService.handleFullListButton(interaction)
})

client
  .login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log("Bot started successfully.")
  })
  .catch((error) => {
    console.error("Error logging in:", error)
  })

console.log("Bot initialization complete, ", process.env.DISCORD_APPLICATION_ID)
