import { PlayerApiClient } from './player-client';

export class BackendApiClient {
	public players: PlayerApiClient;

	constructor(baseUrl: string) {
		this.players = new PlayerApiClient(baseUrl);
	}
}

// Export types
export * from './player-client';

// Declare in container
declare module '@sapphire/pieces' {
	interface Container {
		backendApi: BackendApiClient;
	}
}
