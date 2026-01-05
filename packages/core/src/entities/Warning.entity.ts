import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core"
import { WarningRepository } from "../repositories/WarningRepository"
import { Guild } from "./Guild.entity"
import { Player } from "./Player.entity"
import { WarningType } from "./WarningType.entity"

@Entity({
  tableName: "warnings",
  repository: () => WarningRepository,
})
@Index({ properties: ["guild", "player"] })
@Index({ properties: ["guild", "createdAt"] })
export class Warning {
  @PrimaryKey({ autoincrement: true })
  id!: number

  @ManyToOne(() => Guild, { fieldName: "guild_id", ref: true })
  guild!: Ref<Guild>

  @ManyToOne(() => Player, { fieldName: "player_id", ref: true })
  player!: Ref<Player>

  @ManyToOne(() => WarningType, { fieldName: "warning_type_id", ref: true })
  warningType!: Ref<WarningType>

  @ManyToOne(() => Player, { fieldName: "issued_by", ref: true, nullable: true })
  issuedBy?: Ref<Player>

  @Property({ fieldName: "created_at", onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ type: "text", nullable: true })
  note?: string
}
