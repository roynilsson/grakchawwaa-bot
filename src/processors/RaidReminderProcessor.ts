import { TextChannel, userMention, EmbedBuilder } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { DiscordBotClient } from '../discord-bot-client';
import { getActiveRaid, type RaidData } from '../api/raid-client';

export class RaidReminderProcessor implements NotificationProcessor {
	private client: DiscordBotClient;

	constructor(client: DiscordBotClient) {
		this.client = client;
	}

	async process(automation: Automation): Promise<NotificationResult> {
		const channelId = automation.resolvedChannel?.discordChannelId;

		if (!channelId) {
			return { success: true, message: 'No channel configured, skipping' };
		}

		try {
			// Fetch raid data from backend
			const raidData = await getActiveRaid(automation.guildId);

			if (!raidData || !raidData.raid) {
				console.log(`No active raid for guild ${automation.guildId}`);
				return { success: true, message: 'No active raid' };
			}

			// Filter players below thresholds
			const underperformers = this.identifyUnderperformers(raidData);

			if (!underperformers.length) {
				console.log(`No raid reminder needed for guild ${automation.guildId} - all players meeting targets`);
				return { success: true, message: 'All players meeting targets' };
			}

			// Send reminder message
			await this.sendReminderMessage(channelId, raidData, underperformers);

			return { success: true };
		} catch (error) {
			console.error(`Error processing raid reminder for guild ${automation.guildId}:`, error);
			return { success: false, message: (error as Error).message };
		}
	}

	private identifyUnderperformers(raidData: RaidData): Array<{
		playerId: string;
		playerName?: string;
		discordId?: string;
		score: number;
		target: number;
		targetType: string;
	}> {
		const underperformers: Array<{
			playerId: string;
			playerName?: string;
			discordId?: string;
			score: number;
			target: number;
			targetType: string;
		}> = [];
		const guildMinScore = raidData.guildConfig?.guildMinScore || 0;

		for (const result of raidData.results) {
			const playerConfig = raidData.playerConfigs.find(
				(pc) => pc.playerId === result.playerId
			);

			let isBelowThreshold = false;
			let target = 0;
			let targetType = '';

			// Check guild minimum
			if (guildMinScore > 0 && result.score < guildMinScore) {
				isBelowThreshold = true;
				target = guildMinScore;
				targetType = 'Guild Minimum';
			}

			// Check player minimum (overrides guild minimum display)
			if (playerConfig?.playerMinScore && result.score < playerConfig.playerMinScore) {
				isBelowThreshold = true;
				target = playerConfig.playerMinScore;
				targetType = 'Personal Target';
			}

			// Check zero score (not participated)
			if (result.score === 0) {
				isBelowThreshold = true;
				target = guildMinScore || playerConfig?.playerMinScore || 0;
				targetType = 'Not Participated';
			}

			if (isBelowThreshold) {
				underperformers.push({
					playerId: result.playerId,
					playerName: result.playerName,
					discordId: result.discordId,
					score: result.score,
					target,
					targetType,
				});
			}
		}

		return underperformers;
	}

	private async sendReminderMessage(
		channelId: string,
		raidData: RaidData,
		underperformers: Array<{
			playerId: string;
			playerName?: string;
			discordId?: string;
			score: number;
			target: number;
			targetType: string;
		}>
	): Promise<void> {
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

		if (!channel || !channel.isTextBased()) {
			throw new Error(`Reminder channel ${channelId} is invalid`);
		}

		const raid = raidData.raid;
		if (!raid) {
			throw new Error('Raid data is missing');
		}
		const expireTime = new Date(raid.expireTime);
		const timeRemaining = this.formatTimeRemaining(expireTime);

		const lines = underperformers.map((player, index) => {
			const label = player.discordId
				? userMention(player.discordId)
				: player.playerName || player.playerId;

			const scoreDisplay = player.score > 0
				? `${this.formatScore(player.score)} / ${this.formatScore(player.target)}`
				: 'Not participated';

			return `${index + 1}. ${label} - ${scoreDisplay} (${player.targetType})`;
		});

		const embed = new EmbedBuilder()
			.setTitle(`\u23F0 ${raid.raidType.toUpperCase()} Raid Reminder`)
			.setDescription(`Time remaining: **${timeRemaining}**`)
			.addFields({
				name: `Players Below Target (${underperformers.length})`,
				value: lines.join('\n'),
			})
			.setColor(0xFFA500)
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	}

	private formatTimeRemaining(expireTime: Date): string {
		const now = Date.now();
		const remaining = expireTime.getTime() - now;

		if (remaining <= 0) {
			return 'Expired';
		}

		const hours = Math.floor(remaining / (1000 * 60 * 60));
		const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 24) {
			const days = Math.floor(hours / 24);
			return `${days}d ${hours % 24}h`;
		}

		return `${hours}h ${minutes}m`;
	}

	private formatScore(score: number): string {
		if (score >= 1000000) {
			return `${(score / 1000000).toFixed(2)}M`;
		}
		if (score >= 1000) {
			return `${(score / 1000).toFixed(1)}K`;
		}
		return score.toString();
	}
}
