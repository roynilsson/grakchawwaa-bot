import { BaseApiClient } from './base-client';

export interface Guild {
	id: string;
	name: string;
	ticketCollectionChannelId?: string;
	nextTicketCollectionRefreshTime?: Date;
	ticketReminderChannelId?: string;
	anniversaryChannelId?: string;
	lastTicketCollectionTime?: Date;
}

export interface GuildMemberPlayer {
	allyCode: string;
	playerId?: string;
	name?: string;
	playerLevel?: number;
	galacticPower?: number;
	lastActivityTime?: string; // ISO date string
}

export interface GuildMember {
	player: GuildMemberPlayer;
	memberLevel: number;
	joinedAt: string; // ISO date string
	leftAt?: string;
	isActive: boolean;
}

export interface MemberTicketInfo {
	playerId: string;
	playerName: string;
	allyCode?: string;
	discordId?: string;
	ticketCount: number;
}

export interface TicketCheckResult {
	guildId: string;
	guildName: string;
	nextChallengesRefresh?: string;
	memberTickets: MemberTicketInfo[];
	violatorCount: number;
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
			nextTicketCollectionRefreshTime?: string | null;
			ticketReminderChannelId?: string | null;
			anniversaryChannelId?: string | null;
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

	// POST /api/guilds/:id/ticket-check - Fetch live ticket data from Comlink
	async checkTickets(guildId: string): Promise<TicketCheckResult> {
		return this.request<TicketCheckResult>(`/api/guilds/${guildId}/ticket-check`, {
			method: 'POST'
		});
	}

	// POST /api/guilds/verify-registration - Verify user can register guild
	async verifyRegistration(allyCode: string): Promise<{
		canRegister: boolean;
		guildId?: string;
		guildName?: string;
		playerName?: string;
		message?: string;
	}> {
		return this.request(`/api/guilds/verify-registration`, {
			method: 'POST',
			body: JSON.stringify({ allyCode })
		});
	}

	// GET /api/guilds/:id/roster - Get guild roster for anniversaries
	async getRoster(guildId: string): Promise<{
		guildId: string;
		guildName: string;
		members: Array<{
			playerId: string;
			playerName: string;
			allyCode?: number;
			memberLevel: number;
			guildJoinTime: number;
			playerLevel: number;
			galacticPower: string;
		}>;
	}> {
		return this.request(`/api/guilds/${guildId}/roster`);
	}
}
