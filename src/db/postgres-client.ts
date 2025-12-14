import { container } from "@sapphire/pieces"
import { GuildConfigPGClient } from "./guild-config-client"
import { GuildPGClient } from "./guild-client"
import { PlayerPGClient } from "./player-client"
import { TicketViolationPGClient } from "./ticket-violation-client"

declare module "@sapphire/pieces" {
  interface Container {
    playerClient: PlayerPGClient
    guildClient: GuildPGClient
    guildConfigClient: GuildConfigPGClient
    ticketViolationClient: TicketViolationPGClient
  }
}

export const setupPostgresClients = (): void => {
  const playerClient = new PlayerPGClient()
  const guildClient = new GuildPGClient()
  const guildConfigClient = new GuildConfigPGClient()
  const ticketViolationClient = new TicketViolationPGClient()

  container.playerClient = playerClient
  container.guildClient = guildClient
  container.guildConfigClient = guildConfigClient
  container.ticketViolationClient = ticketViolationClient
}
