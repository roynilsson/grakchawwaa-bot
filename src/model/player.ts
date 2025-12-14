import { User } from "discord.js"

export interface Player {
  allyCode: string
  alt: number // 1 = primary, 2+ = alt accounts
  playerId?: string // From Comlink API
  playerName?: string // From Comlink API
  guildId?: string // SWGOH guild ID
  registeredAt?: Date
}

export interface DiscordPlayer extends Player {
  discordUser: User
}
