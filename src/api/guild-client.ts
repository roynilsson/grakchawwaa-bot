import { BaseApiClient } from './base-client';

export interface Guild {
	id: string;
	name: string;
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

export interface GuildChannel {
	id: number;
	discordChannelId: string;
	name: string;
}

export interface GuildRole {
	id: number;
	discordRoleId: string;
	name: string;
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

	// POST /api/guilds (requireOfficer - caller must be officer of the guild being registered)
	async create(data: { guildId: string; name: string }, callerAllyCode: string): Promise<Guild> {
		const response = await this.request<{ guild: Guild }>('/api/guilds', {
			method: 'POST',
			body: JSON.stringify(data),
			callerAllyCode
		});
		return response.guild;
	}

	// PUT /api/guilds/:id (requireOfficer)
	async update(
		guildId: string,
		data: {
			name?: string;
		},
		callerAllyCode: string
	): Promise<Guild> {
		const response = await this.request<{ guild: Guild }>(`/api/guilds/${guildId}`, {
			method: 'PUT',
			body: JSON.stringify(data),
			callerAllyCode
		});
		return response.guild;
	}

	// DELETE /api/guilds/:id (requireOfficer)
	async delete(guildId: string, callerAllyCode: string): Promise<void> {
		await this.request<void>(`/api/guilds/${guildId}`, {
			method: 'DELETE',
			callerAllyCode
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

	// POST /api/guilds/:id/ticket-check - Fetch live ticket data from Comlink (requireApiKey, requireOfficer)
	// callerAllyCode is optional - if not provided, API key auth is used
	async checkTickets(guildId: string, callerAllyCode?: string): Promise<TicketCheckResult> {
		return this.request<TicketCheckResult>(`/api/guilds/${guildId}/ticket-check`, {
			method: 'POST',
			...(callerAllyCode && { callerAllyCode })
		});
	}

	// POST /api/utils/verify-guild-registration - Verify user can register guild
	async verifyRegistration(allyCode: string): Promise<{
		canRegister: boolean;
		guildId?: string;
		guildName?: string;
		playerName?: string;
		message?: string;
	}> {
		return this.request(`/api/utils/verify-guild-registration`, {
			method: 'POST',
			body: JSON.stringify({ allyCode })
		});
	}

	// GET /api/guilds/:guildId/channels - List approved channels (requireOfficer)
	async listChannels(guildId: string, callerAllyCode: string): Promise<GuildChannel[]> {
		const response = await this.request<{ channels: GuildChannel[] }>(
			`/api/guilds/${guildId}/channels`,
			{ callerAllyCode }
		);
		return response.channels;
	}

	// POST /api/guilds/:guildId/channels - Add approved channel (requireOfficer)
	async addChannel(
		guildId: string,
		data: { discordChannelId: string; name: string },
		callerAllyCode: string
	): Promise<GuildChannel> {
		const response = await this.request<{ channel: GuildChannel }>(
			`/api/guilds/${guildId}/channels`,
			{
				method: 'POST',
				body: JSON.stringify(data),
				callerAllyCode
			}
		);
		return response.channel;
	}

	// DELETE /api/guilds/:guildId/channels/:id - Remove approved channel (requireOfficer)
	async removeChannel(guildId: string, channelId: number, callerAllyCode: string): Promise<void> {
		await this.request<void>(`/api/guilds/${guildId}/channels/${channelId}`, {
			method: 'DELETE',
			callerAllyCode
		});
	}

	// GET channel by Discord ID (convenience method) (requireOfficer)
	async findChannelByDiscordId(
		guildId: string,
		discordChannelId: string,
		callerAllyCode: string
	): Promise<GuildChannel | null> {
		const channels = await this.listChannels(guildId, callerAllyCode);
		return channels.find((c) => c.discordChannelId === discordChannelId) ?? null;
	}

	// GET /api/guilds/:guildId/roles - List approved roles (requireOfficer)
	async listRoles(guildId: string, callerAllyCode: string): Promise<GuildRole[]> {
		const response = await this.request<{ roles: GuildRole[] }>(
			`/api/guilds/${guildId}/roles`,
			{ callerAllyCode }
		);
		return response.roles;
	}

	// POST /api/guilds/:guildId/roles - Add approved role (requireOfficer)
	async addRole(
		guildId: string,
		data: { discordRoleId: string; name: string },
		callerAllyCode: string
	): Promise<GuildRole> {
		const response = await this.request<{ role: GuildRole }>(
			`/api/guilds/${guildId}/roles`,
			{
				method: 'POST',
				body: JSON.stringify(data),
				callerAllyCode
			}
		);
		return response.role;
	}

	// DELETE /api/guilds/:guildId/roles/:id - Remove approved role (requireOfficer)
	async removeRole(guildId: string, roleId: number, callerAllyCode: string): Promise<void> {
		await this.request<void>(`/api/guilds/${guildId}/roles/${roleId}`, {
			method: 'DELETE',
			callerAllyCode
		});
	}

	// GET role by Discord ID (convenience method) (requireOfficer)
	async findRoleByDiscordId(
		guildId: string,
		discordRoleId: string,
		callerAllyCode: string
	): Promise<GuildRole | null> {
		const roles = await this.listRoles(guildId, callerAllyCode);
		return roles.find((r) => r.discordRoleId === discordRoleId) ?? null;
	}
}
