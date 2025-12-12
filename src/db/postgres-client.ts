import { container } from "@sapphire/pieces"
import { GuildMessageChannelsClient } from "./guild-message-channels-client"
import { PlayerPGClient } from "./player-client"
import { TicketViolationPGClient } from "./ticket-violation-client"
import { WarningPGClient } from "./warning-client"
import { WarningTypePGClient } from "./warning-type-client"

declare module "@sapphire/pieces" {
  interface Container {
    playerClient: PlayerPGClient
    ticketChannelClient: GuildMessageChannelsClient
    ticketViolationClient: TicketViolationPGClient
    warningClient: WarningPGClient
    warningTypeClient: WarningTypePGClient
  }
}

export const setupPostgresClients = (): void => {
  const playerClient = new PlayerPGClient()
  const ticketChannelClient = new GuildMessageChannelsClient()
  const ticketViolationClient = new TicketViolationPGClient()
  const warningClient = new WarningPGClient()
  const warningTypeClient = new WarningTypePGClient()

  container.playerClient = playerClient
  container.ticketChannelClient = ticketChannelClient
  container.ticketViolationClient = ticketViolationClient
  container.warningClient = warningClient
  container.warningTypeClient = warningTypeClient
}
