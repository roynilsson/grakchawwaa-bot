import { BaseApiClient } from './base-client';

export interface ResolvedChannel {
	id: number;
	discordChannelId: string;
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
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export class AutomationApiClient extends BaseApiClient {
	// GET /api/guilds/:guildId/automations
	async listByGuild(guildId: string): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>(
			`/api/guilds/${guildId}/automations`
		);
		return response.automations;
	}

	// GET /api/guilds/:guildId/automations/:id
	async get(guildId: string, id: number): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations/${id}`
		);
		return response.automation;
	}

	// POST /api/guilds/:guildId/automations
	async create(data: {
		guildId: string;
		automationType: string;
		config?: Record<string, unknown>;
		enabled?: boolean;
		interval?: string;
	}): Promise<Automation> {
		const { guildId, ...body } = data;
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations`,
			{
				method: 'POST',
				body: JSON.stringify(body),
			}
		);
		return response.automation;
	}

	// PUT /api/guilds/:guildId/automations/:id
	async update(
		guildId: string,
		id: number,
		data: { config?: Record<string, unknown>; enabled?: boolean; interval?: string }
	): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(
			`/api/guilds/${guildId}/automations/${id}`,
			{
				method: 'PUT',
				body: JSON.stringify(data),
			}
		);
		return response.automation;
	}

	// POST /api/automations/:id/mark-run
	async markRun(id: number): Promise<{ success: boolean; lastRunAt: string }> {
		return this.request(`/api/automations/${id}/mark-run`, {
			method: 'POST',
		});
	}

	// GET /api/automations/due?processedBy=bot (API key auth)
	async listDueForBot(): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>(
			'/api/automations/due?processedBy=bot'
		);
		return response.automations;
	}
}
