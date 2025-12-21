import { Entity, Index, PrimaryKey, PrimaryKeyProp, Property } from "@mikro-orm/core"
import { PlayerRepository } from "../repositories/PlayerRepository"

@Entity({ tableName: "players", repository: () => PlayerRepository })
@Index({ name: "players_discord_id_main_unique", properties: ["discordId"], expression: 'CREATE UNIQUE INDEX "players_discord_id_main_unique" ON "players" ("discord_id") WHERE "discord_id" IS NOT NULL AND "is_main" = true' })
export class Player {
  @PrimaryKey({ fieldName: "ally_code", length: 9 })
  allyCode!: string

  [PrimaryKeyProp]?: "allyCode"

  @Property({ fieldName: "discord_id", nullable: true })
  discordId?: string

  @Property({ fieldName: "player_id", length: 50, nullable: true })
  playerId?: string

  @Property({ fieldName: "name", nullable: true })
  name?: string

  @Property({ fieldName: "is_main", default: false })
  isMain: boolean = false

  @Property({ fieldName: "registered_at" })
  registeredAt: Date = new Date()
}
