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
	// GET /api/guilds/:guildId/violations
	async getViolations(
		guildId: string,
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
		const response = await this.request<{ violations: Violation[]; count: number }>(url);
		return response.violations;
	}

	// GET /api/guilds/:guildId/violations/daily/:date
	async getDailyViolations(guildId: string, date: Date): Promise<Violation[]> {
		const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
		const response = await this.request<{ violations: Violation[]; count: number }>(
			`/api/guilds/${guildId}/violations/daily/${dateStr}`
		);
		return response.violations;
	}

	// GET /api/guilds/:guildId/violations/summary
	async getViolationSummary(guildId: string, daysAgo: number = 30): Promise<ViolationSummary[]> {
		const response = await this.request<{ summary: ViolationSummary[]; period: string }>(
			`/api/guilds/${guildId}/violations/summary?daysAgo=${daysAgo}`
		);
		return response.summary;
	}
}
