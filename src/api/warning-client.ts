import { BaseApiClient, RequestOptions } from './base-client';

export interface WarningSummaryPlayer {
	allyCode: string;
	name: string | null;
	values: number[];
}

export interface WarningSummary {
	periods: number[];
	basePeriod: number;
	players: WarningSummaryPlayer[];
}

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

export interface PlayerWarningSummary {
	player: {
		allyCode: string;
		playerName: string | null;
	};
	period: {
		days: number;
		startDate: string;
		endDate: string;
	};
	summary: {
		totalWarnings: number;
		totalPoints: number;
		rank: number;
		guildTotalPoints: number;
		guildAveragePoints: number;
		guildMemberCount: number;
	};
	warnings: Array<{
		id: number;
		createdAt: string;
		warningType: {
			name: string;
			severity: number;
			category: string | null;
		};
		note: string | null;
		issuedBy: string | null;
	}>;
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

	// GET /api/guilds/:guildId/warnings/summary (requireApiKey, requireOfficer)
	async getSummary(
		guildId: string,
		periods?: number[],
		limit?: number,
		options?: RequestOptions
	): Promise<WarningSummary> {
		const params = new URLSearchParams();
		if (periods && periods.length > 0) {
			params.set('periods', periods.join(','));
		}
		if (limit) {
			params.set('limit', String(limit));
		}
		const queryString = params.toString();
		const url = `/api/guilds/${guildId}/warnings/summary${queryString ? `?${queryString}` : ''}`;
		return this.request<WarningSummary>(url, options);
	}

	// GET /api/guilds/:guildId/warnings/player-summary (requireApiKey + auth check)
	async getPlayerSummary(
		guildId: string,
		allyCode: string,
		days?: number,
		callerAllyCode?: string
	): Promise<PlayerWarningSummary> {
		const params = new URLSearchParams();
		params.set('allyCode', allyCode);
		if (days) {
			params.set('days', String(days));
		}
		const url = `/api/guilds/${guildId}/warnings/player-summary?${params.toString()}`;
		return this.request<PlayerWarningSummary>(url, { callerAllyCode });
	}
}
