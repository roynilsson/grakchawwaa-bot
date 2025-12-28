import { MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import { container } from "@sapphire/pieces"
import {
  Guild,
  GuildRepository,
  GuildMember,
  GuildMemberRepository,
  Player,
  PlayerRepository,
  TicketViolation,
  TicketViolationRepository,
  PermissionService,
  getORM,
} from "@grakchawwaa/core"
import { PlayerService } from "../services/data/PlayerService"
import { GuildService } from "../services/data/GuildService"
import { GuildMemberService } from "../services/data/GuildMemberService"

declare module "@sapphire/pieces" {
  interface Container {
    orm: MikroORM<PostgreSqlDriver>
    playerRepository: PlayerRepository
    playerService: PlayerService
    guildRepository: GuildRepository
    guildService: GuildService
    guildMemberRepository: GuildMemberRepository
    guildMemberService: GuildMemberService
    ticketViolationRepository: TicketViolationRepository
    permissionService: PermissionService
  }
}

export const setupPostgresClients = (): void => {
  // Setup MikroORM repositories and services
  const orm = getORM()
  const em = orm.em.fork()
  container.playerRepository = em.getRepository(Player)
  container.playerService = new PlayerService(em)
  container.guildRepository = em.getRepository(Guild)
  container.guildService = new GuildService(em)
  container.guildMemberRepository = em.getRepository(GuildMember)
  container.guildMemberService = new GuildMemberService(em)
  container.ticketViolationRepository = em.getRepository(TicketViolation)
  container.permissionService = new PermissionService(em)
}
