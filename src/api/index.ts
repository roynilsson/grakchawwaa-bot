import { PlayerApiClient } from './player-client';
import { GuildApiClient } from './guild-client';
import { ViolationApiClient } from './violation-client';

export class BackendApiClient {
	public players: PlayerApiClient;
	public guilds: GuildApiClient;
	public violations: ViolationApiClient;

	constructor(baseUrl: string) {
		this.players = new PlayerApiClient(baseUrl);
		this.guilds = new GuildApiClient(baseUrl);
		this.violations = new ViolationApiClient(baseUrl);
	}
}

// Export types
export * from './player-client';
export * from './guild-client';
export * from './violation-client';

// Declare in container
declare module '@sapphire/pieces' {
	interface Container {
		backendApi: BackendApiClient;
	}
}
