import { BaseApiClient } from './base-client';

export interface Violation {
	guildId: string;
	playerId: string;
	playerName?: string;
	allyCode?: string;
	discordId?: string;
	date: string; // ISO date string
	ticketCount: number;
}

export interface ViolationSummary {
	playerId: string;
	playerName?: string;
	allyCode?: string;
	discordId?: string;
	violationCount: number;
	averageTickets: number;
	totalMissingTickets: number;
}

export class ViolationApiClient extends BaseApiClient {
	// GET /api/guilds/:guildId/violations (requireOfficer)
	async getViolations(
		guildId: string,
		callerAllyCode: string,
		playerId?: string,
		daysAgo?: number,
		limit?: number
	): Promise<Violation[]> {
		const params = new URLSearchParams();
		if (playerId) params.append('playerId', playerId);
		if (daysAgo) params.append('daysAgo', daysAgo.toString());
		if (limit) params.append('limit', limit.toString());

		const queryString = params.toString();
		const url = `/api/guilds/${guildId}/violations${queryString ? `?${queryString}` : ''}`;
		const response = await this.request<{ violations: Violation[]; count: number }>(url, { callerAllyCode });
		return response.violations;
	}

	// GET /api/guilds/:guildId/violations/daily/:date (requireApiKey, requireOfficer)
	// callerAllyCode is optional - if not provided, API key auth is used
	async getDailyViolations(guildId: string, date: Date, callerAllyCode?: string): Promise<Violation[]> {
		const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
		const response = await this.request<{ violations: Violation[]; count: number }>(
			`/api/guilds/${guildId}/violations/daily/${dateStr}`,
			callerAllyCode ? { callerAllyCode } : undefined
		);
		return response.violations;
	}

	// GET /api/guilds/:guildId/violations/summary (requireApiKey, requireOfficer)
	// callerAllyCode is optional - if not provided, API key auth is used
	async getViolationSummary(guildId: string, daysAgo: number = 30, callerAllyCode?: string): Promise<ViolationSummary[]> {
		const response = await this.request<{ summary: ViolationSummary[]; period: string }>(
			`/api/guilds/${guildId}/violations/summary?daysAgo=${daysAgo}`,
			callerAllyCode ? { callerAllyCode } : undefined
		);
		return response.summary;
	}
}
