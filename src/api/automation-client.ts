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
	async listByGuild(guildId: string): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>(
			`/api/automations?guildId=${guildId}`
		);
		return response.automations;
	}

	async get(id: number): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(`/api/automations/${id}`);
		return response.automation;
	}

	async update(
		id: number,
		data: { config?: Record<string, unknown>; enabled?: boolean; interval?: string }
	): Promise<Automation> {
		const response = await this.request<{ automation: Automation }>(`/api/automations/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		return response.automation;
	}

	async markRun(id: number): Promise<{ success: boolean; lastRunAt: string }> {
		return this.request(`/api/automations/${id}/mark-run`, {
			method: 'POST'
		});
	}

	async listDueForBot(): Promise<Automation[]> {
		const response = await this.request<{ automations: Automation[] }>('/api/automations/due?processedBy=bot');
		return response.automations;
	}
}
