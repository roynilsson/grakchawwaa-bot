import { initializeMikroORM, CachedComlinkClient } from "@grakchawwaa/core"
import ComlinkStub from "@swgoh-utils/comlink"
import { GuildSyncWorker } from "./workers/guild-sync-worker"
import { TicketCollectionWorker } from "./workers/ticket-collection-worker"

async function main() {
  console.log("Starting grakchawwaa worker...")

  // Initialize MikroORM
  const orm = await initializeMikroORM()
  console.log("MikroORM initialized")

  // Setup Comlink client
  const comlinkUrl = process.env.COMLINK_URL || "http://localhost:3000"
  const accessKey = process.env.COMLINK_ACCESS_KEY || ""
  const secretKey = process.env.COMLINK_SECRET_KEY || ""

  const comlinkClient = new ComlinkStub({
    url: comlinkUrl,
    accessKey,
    secretKey,
  })
  console.log("Comlink client initialized")

  // Setup cached Comlink client
  const cachedComlinkClient = CachedComlinkClient.getInstance(comlinkClient)
  console.log("Cached Comlink client initialized")

  // Get repositories from ORM
  const guildRepository = orm.em.fork().getRepository("Guild")
  const playerRepository = orm.em.fork().getRepository("Player")
  const guildMemberRepository = orm.em.fork().getRepository("GuildMember")
  const ticketViolationRepository = orm.em.fork().getRepository("TicketViolation")

  // Start background workers
  const guildSyncWorker = new GuildSyncWorker(
    orm,
    comlinkClient,
    cachedComlinkClient,
  )
  guildSyncWorker.start()
  console.log("Guild sync worker started")

  const ticketCollectionWorker = new TicketCollectionWorker(
    orm,
    cachedComlinkClient,
  )
  ticketCollectionWorker.start()
  console.log("Ticket collection worker started")

  console.log("All workers started successfully")

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down workers...")
    guildSyncWorker.stop()
    ticketCollectionWorker.stop()
    await orm.close()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    console.log("Shutting down workers...")
    guildSyncWorker.stop()
    ticketCollectionWorker.stop()
    await orm.close()
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("Failed to start worker:", error)
  process.exit(1)
})
