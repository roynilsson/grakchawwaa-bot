import { container } from "@sapphire/pieces"
import { CachedComlinkClient } from "@grakchawwaa/core"

declare module "@sapphire/pieces" {
  interface Container {
    cachedComlinkClient: CachedComlinkClient
  }
}

export const setupServices = (): void => {
  const cachedComlinkClient = CachedComlinkClient.getInstance(container.comlinkClient)
  container.cachedComlinkClient = cachedComlinkClient
}
