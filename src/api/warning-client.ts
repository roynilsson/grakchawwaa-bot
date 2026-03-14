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
	// GET /api/guilds/:guildId/warning-types?search=Y (requireOfficer)
	async getTypes(guildId: string, search?: string, callerAllyCode?: string): Promise<WarningType[]> {
		const params = new URLSearchParams();
		if (search) params.append('search', search);

		const queryString = params.toString();
		const url = `/api/guilds/${guildId}/warning-types${queryString ? `?${queryString}` : ''}`;
		const response = await this.request<{ warningTypes: WarningType[] }>(url, { callerAllyCode });
		return response.warningTypes;
	}

	// POST /api/guilds/:guildId/warnings (requireOfficer)
	async issue(params: {
		guildId: string;
		playerId: string;
		warningTypeId: number;
		note?: string;
		issuedBy: string;
		callerAllyCode: string;
	}): Promise<Warning> {
		const { guildId, callerAllyCode, ...body } = params;
		const response = await this.request<{ warning: Warning }>(
			`/api/guilds/${guildId}/warnings`,
			{
				method: 'POST',
				body: JSON.stringify(body),
				callerAllyCode
			}
		);
		return response.warning;
	}
}
