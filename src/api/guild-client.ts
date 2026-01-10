import { BaseApiClient } from './base-client';

export interface Guild {
	guildId: string;
	name: string;
	ticketCollectionChannelId?: string;
	nextTicketRefreshTime?: Date;
	ticketReminderChannelId?: string;
	anniversaryChannelId?: string;
	ticketResetHour?: number;
}

export interface GuildMember {
	guildId: string;
	allyCode: string;
	memberLevel: number;
	joinedAt: Date;
	leftAt?: Date;
	isActive: boolean;
}

export class GuildApiClient extends BaseApiClient {
	// GET /api/guilds
	async list(): Promise<Guild[]> {
		const response = await this.request<{ guilds: Guild[] }>('/api/guilds');
		return response.guilds;
	}

	// GET /api/guilds/:id
	async get(guildId: string): Promise<Guild> {
		const response = await this.request<{ guild: Guild }>(`/api/guilds/${guildId}`);
		return response.guild;
	}

	// POST /api/guilds
	async create(data: { guildId: string; name: string }): Promise<Guild> {
		const response = await this.request<{ guild: Guild }>('/api/guilds', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		return response.guild;
	}

	// PUT /api/guilds/:id
	async update(
		guildId: string,
		data: {
			name?: string;
			ticketCollectionChannelId?: string | null;
			ticketReminderChannelId?: string | null;
			anniversaryChannelId?: string | null;
			ticketResetHour?: number;
		}
	): Promise<Guild> {
		const response = await this.request<{ guild: Guild }>(`/api/guilds/${guildId}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		return response.guild;
	}

	// DELETE /api/guilds/:id
	async delete(guildId: string): Promise<void> {
		await this.request<void>(`/api/guilds/${guildId}`, {
			method: 'DELETE'
		});
	}

	// GET /api/guilds/:id/members?includeInactive=true
	async getMembers(guildId: string, includeInactive = false): Promise<GuildMember[]> {
		const url = `/api/guilds/${guildId}/members${includeInactive ? '?includeInactive=true' : ''}`;
		const response = await this.request<{ members: GuildMember[] }>(url);
		return response.members;
	}

	// GET /api/guilds/:guildId/members/:allyCode
	async getMember(guildId: string, allyCode: string): Promise<GuildMember> {
		const response = await this.request<{ member: GuildMember }>(
			`/api/guilds/${guildId}/members/${allyCode}`
		);
		return response.member;
	}

	// POST /api/guilds/:guildId/members
	async addMember(
		guildId: string,
		data: { allyCode: string; memberLevel?: number }
	): Promise<GuildMember> {
		const response = await this.request<{ member: GuildMember }>(
			`/api/guilds/${guildId}/members`,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
		return response.member;
	}

	// PUT /api/guilds/:guildId/members/:allyCode
	async updateMember(
		guildId: string,
		allyCode: string,
		data: { memberLevel?: number }
	): Promise<GuildMember> {
		const response = await this.request<{ member: GuildMember }>(
			`/api/guilds/${guildId}/members/${allyCode}`,
			{
				method: 'PUT',
				body: JSON.stringify(data)
			}
		);
		return response.member;
	}

	// DELETE /api/guilds/:guildId/members/:allyCode
	async removeMember(guildId: string, allyCode: string): Promise<void> {
		await this.request<void>(`/api/guilds/${guildId}/members/${allyCode}`, {
			method: 'DELETE'
		});
	}
}
