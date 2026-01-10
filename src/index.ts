import { container } from "@sapphire/pieces"
import { BackendApiClient } from "./api"
import { DiscordBotClient } from "./discord-bot-client"
import { AnniversaryMonitorService } from "./services/anniversary-monitor"
import { TicketReminderService } from "./services/ticket-reminder"
import { TicketNotificationService } from "./services/ticket-notification"
import { ViolationSummaryService } from "./services/violation-summary"

// Initialize backend API client
const backendApiUrl = process.env.BACKEND_API_URL || "http://localhost:3000"
container.backendApi = new BackendApiClient(backendApiUrl)
console.log(`Backend API URL: ${backendApiUrl}`)

const client = new DiscordBotClient()
const summaryService = new ViolationSummaryService(client)
client.on("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  // Start the ticket reminder service (sends reminders 1 hour before reset)
  const ticketReminderService = new TicketReminderService(client)
  ticketReminderService.start()

  // Start the ticket notification service (sends violation/success notifications after collection)
  const ticketNotificationService = new TicketNotificationService(client, summaryService)
  ticketNotificationService.start()

  // Start the anniversary monitoring service
  const anniversaryMonitor = new AnniversaryMonitorService(client)
  anniversaryMonitor.start()
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
