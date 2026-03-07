import { BaseApiClient } from './base-client';

export interface Player {
	allyCode: string;
	discordId?: string;
	discordUsername?: string;
	name?: string;
	playerId?: string;
	isMain?: boolean;
}

export interface PlayerGuildMembership {
	guildId: string;
	guildName: string;
	memberLevel: number;
	joinedAt: string;
}

export class PlayerApiClient extends BaseApiClient {
	// POST /api/players
	async create(data: { allyCode: string; discordId: string; discordUsername?: string; name?: string; playerId?: string; isMain?: boolean }): Promise<Player> {
		const response = await this.request<{ player: Player }>('/api/players', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		return response.player;
	}

	// GET /api/players?discordId=...&isMain=...
	async list(filters?: { discordId?: string; isMain?: boolean }): Promise<Player[]> {
		const params = new URLSearchParams();
		if (filters?.discordId) {
			params.append('discordId', filters.discordId);
		}
		if (filters?.isMain !== undefined) {
			params.append('isMain', filters.isMain.toString());
		}
		const url = params.toString() ? `/api/players?${params.toString()}` : '/api/players';
		const response = await this.request<{ players: Player[] }>(url);
		return response.players;
	}

	// GET /api/players/:allyCode
	async get(allyCode: string): Promise<Player> {
		const response = await this.request<{ player: Player }>(`/api/players/${allyCode}`);
		return response.player;
	}

	// PUT /api/players/:allyCode
	async update(
		allyCode: string,
		data: Partial<{
			name: string;
			playerId: string;
			discordId: string;
			discordUsername: string;
			isMain: boolean;
		}>
	): Promise<Player> {
		const response = await this.request<{ player: Player }>(`/api/players/${allyCode}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});
		return response.player;
	}

	// DELETE /api/players/:allyCode
	async delete(allyCode: string): Promise<void> {
		await this.request<void>(`/api/players/${allyCode}`, {
			method: 'DELETE'
		});
	}

	// GET /api/players/:allyCode/guild-membership
	async getGuildMembership(allyCode: string): Promise<PlayerGuildMembership | null> {
		const response = await this.request<{ membership: PlayerGuildMembership | null }>(
			`/api/players/${allyCode}/guild-membership`
		);
		return response.membership;
	}
}
