import { Entity, PrimaryKey, Property } from "@mikro-orm/core"
import { GuildRepository } from "../repositories/GuildRepository"

@Entity({
  tableName: "guilds",
  repository: () => GuildRepository,
})
export class Guild {
  @PrimaryKey({ fieldName: "id", length: 24 })
  id!: string

  @Property({ fieldName: "name", nullable: true })
  name?: string

  @Property({
    fieldName: "ticket_collection_channel_id",
    length: 20,
    nullable: true,
  })
  ticketCollectionChannelId?: string

  @Property({
    fieldName: "next_ticket_collection_refresh_time",
    type: "timestamptz",
    nullable: true,
  })
  nextTicketCollectionRefreshTime?: Date

  @Property({ fieldName: "ticket_reminder_channel_id", length: 20, nullable: true })
  ticketReminderChannelId?: string

  @Property({ fieldName: "anniversary_channel_id", length: 20, nullable: true })
  anniversaryChannelId?: string
}
