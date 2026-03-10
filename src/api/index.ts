import { PlayerApiClient } from './player-client';
import { GuildApiClient } from './guild-client';
import { ViolationApiClient } from './violation-client';
import { AutomationApiClient } from './automation-client';

export class BackendApiClient {
	public players: PlayerApiClient;
	public guilds: GuildApiClient;
	public violations: ViolationApiClient;
	public automations: AutomationApiClient;

	constructor(baseUrl: string, apiKey?: string) {
		this.players = new PlayerApiClient(baseUrl, apiKey);
		this.guilds = new GuildApiClient(baseUrl, apiKey);
		this.violations = new ViolationApiClient(baseUrl, apiKey);
		this.automations = new AutomationApiClient(baseUrl, apiKey);
	}
}

// Export types
export * from './player-client';
export * from './guild-client';
export * from './violation-client';
export * from './automation-client';
export * from './raid-client';

// Declare in container
declare module '@sapphire/pieces' {
	interface Container {
		backendApi: BackendApiClient;
	}
}
