import { Entity, PrimaryKey, Property } from "@mikro-orm/core"
import { TicketViolationRepository } from "../repositories/TicketViolationRepository"

@Entity({
  tableName: "ticket_violations",
  repository: () => TicketViolationRepository,
})
export class TicketViolation {
  @PrimaryKey({ fieldName: "guild_id", length: 24 })
  guildId!: string

  @PrimaryKey({ fieldName: "player_id", length: 50 })
  playerId!: string

  @PrimaryKey()
  date!: Date

  @Property({ fieldName: "ticket_count" })
  ticketCount!: number
}
