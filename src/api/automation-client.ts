import { BaseApiClient } from './base-client';

export interface ResolvedChannel {
	id: number;
	discordChannelId: string;
	name: string;
}

export interface ResolvedRole {
	id: number;
	discordRoleId: string;
	name: string;
}

export interface Automation {
	id: number;
	guildId: string;
	automationType: string;
	scope: 'system' | 'guild';
	processedBy: 'backend' | 'bot';
	interval?: string;
	nextRunAt?: string;
	lastRunAt?: string;
	config: Record<string, unknown>;
	resolvedChannel?: ResolvedChannel;
	resolvedRole?: ResolvedRole;
	leaderAllyCode?: string; // Guild leader's ally code for bot auth
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export class AutomationApiClient extends BaseApiClient {
	// GET /api/guilds/:guildId/automations (requireApiKey, requireOfficer)
	// callerAllyCode is optional - if not provided, API key auth is used
	async listByGuild(guildId: string, callerAllyCode?: string): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>(
			`/api/guilds/${guildId}/automations`,
			callerAllyCode ? { callerAllyCode } : undefined
		);
		return response.automations;
	}

	// GET /api/guilds/:guildId/automations/:id (requireOfficer)
	async get(guildId: string, id: number, callerAllyCode: string): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations/${id}`,
			{ callerAllyCode }
		);
		return response.automation;
	}

	// POST /api/guilds/:guildId/automations (requireOfficer)
	async create(data: {
		guildId: string;
		automationType: string;
		config?: Record<string, unknown>;
		enabled?: boolean;
		interval?: string;
		callerAllyCode: string;
	}): Promise<Automation> {
		const { guildId, callerAllyCode, ...body } = data;
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations`,
			{
				method: 'POST',
				body: JSON.stringify(body),
				callerAllyCode
			}
		);
		return response.automation;
	}

	// PUT /api/guilds/:guildId/automations/:id (requireOfficer)
	async update(
		guildId: string,
		id: number,
		data: { config?: Record<string, unknown>; enabled?: boolean; interval?: string },
		callerAllyCode: string
	): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations/${id}`,
			{
				method: 'PUT',
				body: JSON.stringify(data),
				callerAllyCode
			}
		);
		return response.automation;
	}

	// POST /api/automations/:id/mark-run (requireApiKey only - no caller needed)
	async markRun(id: number): Promise<{ success: boolean; lastRunAt: string }> {
		return this.request(`/api/automations/${id}/mark-run`, {
			method: 'POST',
		});
	}

	// GET /api/automations/due?processedBy=bot (requireApiKey only - no caller needed)
	async listDueForBot(): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>(
			'/api/automations/due?processedBy=bot'
		);
		return response.automations;
	}
}
