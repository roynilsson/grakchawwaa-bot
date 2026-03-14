import { BaseApiClient } from './base-client';

export interface WarningType {
	id: number;
	name: string;
	severity: number;
}

export interface Warning {
	id: number;
	createdAt: string;
	note?: string;
	player: {
		allyCode: string;
		name?: string;
	};
	warningType: {
		id: number;
		name: string;
		severity: number;
	};
	issuedByPlayer?: {
		allyCode: string;
		name?: string;
	};
}

export class WarningApiClient extends BaseApiClient {
	// GET /api/warnings/types?guildId=X
	async getTypes(guildId: string): Promise<WarningType[]> {
		const response = await this.request<{ warningTypes: WarningType[] }>(
			`/api/warnings/types?guildId=${guildId}`
		);
		return response.warningTypes;
	}

	// POST /api/warnings
	async issue(params: {
		guildId: string;
		playerId: string;
		warningTypeId: number;
		note?: string;
		issuedBy: string;
	}): Promise<Warning> {
		const response = await this.request<{ warning: Warning }>('/api/warnings', {
			method: 'POST',
			body: JSON.stringify(params),
		});
		return response.warning;
	}
}
