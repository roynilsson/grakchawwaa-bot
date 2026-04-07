import { BaseApiClient, RequestOptions } from './base-client';

export type LeaveType = 'away' | 'busy';

export interface Leave {
	id: number;
	guildId: string;
	guildName?: string;
	playerId: string;
	playerName?: string;
	playerAllyCode?: string;
	startDate: string;
	endDate: string;
	leaveType: LeaveType;
	note?: string;
	createdByPlayerId: string;
	createdByPlayerName?: string;
}

export interface CreateLeaveInput {
	playerAllyCode: string;
	startDate: string;
	endDate: string;
	leaveType?: LeaveType;
	note?: string;
}

export interface UpdateLeaveInput {
	startDate?: string;
	endDate?: string;
	leaveType?: LeaveType;
	note?: string;
}

export interface LeaveSummary {
	playerId: string;
	playerName?: string;
	allyCode?: string;
	totalDays: number;
	leaveCount: number;
}

export class LeaveApiClient extends BaseApiClient {
	/**
	 * Create a leave for a player in a guild
	 */
	async create(
		guildId: string,
		input: CreateLeaveInput,
		callerAllyCode: string
	): Promise<Leave> {
		return this.request<Leave>(`/api/guilds/${guildId}/leaves`, {
			method: 'POST',
			body: JSON.stringify(input),
			callerAllyCode,
		});
	}

	/**
	 * Get a leave by ID
	 */
	async get(leaveId: number, options?: RequestOptions): Promise<Leave> {
		return this.request<Leave>(`/api/leaves/${leaveId}`, options);
	}

	/**
	 * List leaves for a player
	 */
	async listByPlayer(
		allyCode: string,
		params?: { active?: boolean },
		options?: RequestOptions
	): Promise<Leave[]> {
		const queryParams = new URLSearchParams();
		if (params?.active !== undefined) {
			queryParams.set('active', String(params.active));
		}
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		return this.request<Leave[]>(`/api/players/${allyCode}/leaves${query}`, options);
	}

	/**
	 * List leaves for a guild
	 */
	async listByGuild(
		guildId: string,
		params?: { active?: boolean; playerId?: string },
		options?: RequestOptions
	): Promise<Leave[]> {
		const queryParams = new URLSearchParams();
		if (params?.active !== undefined) {
			queryParams.set('activeOnly', String(params.active));
		}
		if (params?.playerId) {
			queryParams.set('playerId', params.playerId);
		}
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		const response = await this.request<{ leaves: Leave[]; count: number; total: number; page: number }>(
			`/api/guilds/${guildId}/leaves${query}`,
			options
		);
		return response.leaves;
	}

	/**
	 * Update a leave
	 */
	async update(
		leaveId: number,
		input: UpdateLeaveInput,
		callerAllyCode: string
	): Promise<Leave> {
		return this.request<Leave>(`/api/leaves/${leaveId}`, {
			method: 'PUT',
			body: JSON.stringify(input),
			callerAllyCode,
		});
	}

	/**
	 * Delete a leave
	 */
	async delete(leaveId: number, callerAllyCode: string): Promise<void> {
		await this.request<void>(`/api/leaves/${leaveId}`, {
			method: 'DELETE',
			callerAllyCode,
		});
	}

	/**
	 * Get leave summary for a guild
	 */
	async getSummary(
		guildId: string,
		params?: { startDate?: string; endDate?: string },
		options?: RequestOptions
	): Promise<LeaveSummary[]> {
		const queryParams = new URLSearchParams();
		if (params?.startDate) {
			queryParams.set('startDate', params.startDate);
		}
		if (params?.endDate) {
			queryParams.set('endDate', params.endDate);
		}
		const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
		return this.request<LeaveSummary[]>(`/api/guilds/${guildId}/leaves/summary${query}`, options);
	}
}
