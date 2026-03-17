import { BaseApiClient } from './base-client';

export interface RaidData {
  raid: {
    id: number;
    raidType: string;
    expireTime: string;
    startTime: string;
    guildRewardScore: number;
    isFinalized: boolean;
  } | null;
  results: Array<{
    playerId: string;
    playerName?: string;
    discordId?: string;
    score: number;
    rank: number;
  }>;
  guildConfig?: {
    guildMinScore: number;
  };
  playerConfigs: Array<{
    playerId: string;
    playerMinScore?: number;
    allTimeHigh: number;
  }>;
}

export class RaidApiClient extends BaseApiClient {
  // GET /api/guilds/:guildId/raids/active (requireApiKey, requireGuildMember)
  // callerAllyCode is optional - if not provided, API key auth is used
  async getActiveRaid(guildId: string, callerAllyCode?: string): Promise<RaidData | null> {
    try {
      return await this.request<RaidData>(
        `/api/guilds/${guildId}/raids/active`,
        callerAllyCode ? { callerAllyCode } : undefined
      );
    } catch (error) {
      // Return null for 404 (no active raid)
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // GET /api/guilds/:guildId/raids/history (requireGuildMember)
  async getRaidHistory(guildId: string, callerAllyCode: string): Promise<RaidData[]> {
    const response = await this.request<{ raids: RaidData[] }>(
      `/api/guilds/${guildId}/raids/history`,
      { callerAllyCode }
    );
    return response.raids;
  }
}
