import { EntityRepository } from "@mikro-orm/postgresql"
import { Player } from "../entities/Player.entity"

/**
 * PlayerRepository - Minimal CRUD operations
 * Business logic lives in PlayerService
 */
export class PlayerRepository extends EntityRepository<Player> {
  // Inherits standard methods from EntityRepository:
  // - findOne(where)
  // - find(where)
  // - create(data)
  // - persist(entity)
  // - flush()
  // - remove(entity)
}
