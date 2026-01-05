import { initializeMikroORM } from "@grakchawwaa/core"
import { MikroORM } from "@mikro-orm/postgresql"

let orm: MikroORM | null = null

export async function getORM(): Promise<MikroORM> {
  if (!orm) {
    orm = await initializeMikroORM()
  }
  return orm
}
