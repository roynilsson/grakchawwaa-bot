import { container } from '@sapphire/pieces';

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

export async function getActiveRaid(guildId: string): Promise<RaidData | null> {
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${backendUrl}/api/guilds/${guildId}/raids/active`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch raid data: ${response.statusText}`);
    }

    return (await response.json()) as RaidData;
  } catch (error) {
    container.logger.error('Error fetching active raid:', error);
    throw error;
  }
}
