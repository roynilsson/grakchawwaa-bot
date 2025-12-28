import { EntityRepository } from "@mikro-orm/postgresql"
import { Guild } from "../entities/Guild.entity"

/**
 * GuildRepository - Minimal CRUD operations
 * Business logic lives in GuildService
 */
export class GuildRepository extends EntityRepository<Guild> {
  // Inherits standard methods from EntityRepository:
  // - findOne(where)
  // - find(where)
  // - findAll()
  // - create(data)
  // - persist(entity)
  // - flush()
  // - remove(entity)
  // - removeAndFlush(entity)
}
