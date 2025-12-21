import { Entity, Index, PrimaryKey, Property } from "@mikro-orm/core"
import { GuildMemberRepository } from "../repositories/GuildMemberRepository"

@Entity({
  tableName: "guild_members",
  repository: () => GuildMemberRepository,
})
@Index({ properties: ["isActive"] })
export class GuildMember {
  @PrimaryKey({ fieldName: "guild_id" })
  guildId!: string

  @PrimaryKey({ fieldName: "ally_code" })
  allyCode!: string

  @Property({ fieldName: "joined_at" })
  joinedAt: Date = new Date()

  @Property({ fieldName: "left_at", nullable: true })
  leftAt?: Date

  @Property({ fieldName: "is_active", default: true })
  isActive: boolean = true
}
