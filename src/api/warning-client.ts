import { BaseApiClient } from './base-client';

export interface WarningType {
	id: number;
	name: string;
	severity: number;
	category?: { id: number; name: string } | null;
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
	// GET /api/warnings/types?guildId=X&search=Y
	async getTypes(guildId: string, search?: string): Promise<WarningType[]> {
		const params = new URLSearchParams({ guildId });
		if (search) params.append('search', search);

		const response = await this.request<{ warningTypes: WarningType[] }>(
			`/api/warnings/types?${params}`
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
