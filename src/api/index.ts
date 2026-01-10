import { PlayerApiClient } from './player-client';
import { GuildApiClient } from './guild-client';

export class BackendApiClient {
	public players: PlayerApiClient;
	public guilds: GuildApiClient;

	constructor(baseUrl: string) {
		this.players = new PlayerApiClient(baseUrl);
		this.guilds = new GuildApiClient(baseUrl);
	}
}

// Export types
export * from './player-client';
export * from './guild-client';

// Declare in container
declare module '@sapphire/pieces' {
	interface Container {
		backendApi: BackendApiClient;
	}
}
