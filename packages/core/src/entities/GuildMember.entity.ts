import { Entity, Index, ManyToOne, PrimaryKeyProp, Property, Ref } from "@mikro-orm/core"
import { GuildMemberRepository } from "../repositories/GuildMemberRepository"
import { Guild } from "./Guild.entity"
import { Player } from "./Player.entity"

@Entity({
  tableName: "guild_members",
  repository: () => GuildMemberRepository,
})
@Index({ properties: ["isActive"] })
export class GuildMember {
  @ManyToOne(() => Guild, { fieldName: "guild_id", primary: true, ref: true })
  guild!: Ref<Guild>

  @ManyToOne(() => Player, { fieldName: "ally_code", primary: true, ref: true })
  player!: Ref<Player>

  [PrimaryKeyProp]?: ["guild", "player"]

  @Property({ fieldName: "joined_at" })
  joinedAt: Date = new Date()

  @Property({ fieldName: "left_at", nullable: true })
  leftAt?: Date

  @Property({ fieldName: "is_active", default: true })
  isActive: boolean = true
}
