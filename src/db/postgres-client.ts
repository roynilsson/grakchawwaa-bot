import { container } from "@sapphire/pieces"
import { GuildMessageChannelsClient } from "./guild-message-channels-client"
import { GuildPGClient } from "./guild-client"
import { PlayerPGClient } from "./player-client"
import { TicketViolationPGClient } from "./ticket-violation-client"

declare module "@sapphire/pieces" {
  interface Container {
    playerClient: PlayerPGClient
    guildClient: GuildPGClient
    ticketChannelClient: GuildMessageChannelsClient
    ticketViolationClient: TicketViolationPGClient
  }
}

export const setupPostgresClients = (): void => {
  const playerClient = new PlayerPGClient()
  const guildClient = new GuildPGClient()
  const ticketChannelClient = new GuildMessageChannelsClient()
  const ticketViolationClient = new TicketViolationPGClient()

  container.playerClient = playerClient
  container.guildClient = guildClient
  container.ticketChannelClient = ticketChannelClient
  container.ticketViolationClient = ticketViolationClient
}
