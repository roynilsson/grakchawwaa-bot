import { EntityRepository } from "@mikro-orm/postgresql"
import { GuildMember } from "../entities/GuildMember.entity"

/**
 * GuildMemberRepository - Minimal CRUD operations
 * Business logic lives in GuildMemberService
 */
export class GuildMemberRepository extends EntityRepository<GuildMember> {
  // Inherits standard methods from EntityRepository:
  // - findOne(where)
  // - find(where)
  // - findAll()
  // - create(data)
  // - persist(entity)
  // - flush()
  // - remove(entity)
}
