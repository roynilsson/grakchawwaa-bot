import { MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import { container } from "@sapphire/pieces"
import {
  Guild,
  GuildRepository,
  Player,
  PlayerRepository,
  TicketViolation,
  TicketViolationRepository,
  getORM,
} from "@grakchawwaa/core"

declare module "@sapphire/pieces" {
  interface Container {
    orm: MikroORM<PostgreSqlDriver>
    playerRepository: PlayerRepository
    guildRepository: GuildRepository
    ticketViolationRepository: TicketViolationRepository
  }
}

export const setupPostgresClients = (): void => {
  // Setup MikroORM repositories
  const orm = getORM()
  const em = orm.em.fork()
  container.playerRepository = em.getRepository(Player)
  container.guildRepository = em.getRepository(Guild)
  container.ticketViolationRepository = em.getRepository(TicketViolation)
}
