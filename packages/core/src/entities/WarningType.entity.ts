import { Entity, ManyToOne, PrimaryKey, Property, Ref } from "@mikro-orm/core"
import { WarningTypeRepository } from "../repositories/WarningTypeRepository"
import { Guild } from "./Guild.entity"

@Entity({
  tableName: "warning_types",
  repository: () => WarningTypeRepository,
})
export class WarningType {
  @PrimaryKey({ autoincrement: true })
  id!: number

  @ManyToOne(() => Guild, { fieldName: "guild_id", ref: true })
  guild!: Ref<Guild>

  @Property({ length: 100 })
  name!: string

  @Property({ type: "smallint" })
  severity!: number

  @Property({ fieldName: "created_at", onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ fieldName: "updated_at", onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
