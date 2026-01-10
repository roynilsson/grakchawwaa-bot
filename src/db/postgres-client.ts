import { container } from "@sapphire/pieces"
import { GuildMessageChannelsClient } from "./guild-message-channels-client"
import { PlayerPGClient } from "./player-client"

declare module "@sapphire/pieces" {
  interface Container {
    playerClient: PlayerPGClient
    ticketChannelClient: GuildMessageChannelsClient
  }
}

export const setupPostgresClients = (): void => {
  const playerClient = new PlayerPGClient()
  const ticketChannelClient = new GuildMessageChannelsClient()

  container.playerClient = playerClient
  container.ticketChannelClient = ticketChannelClient
}
