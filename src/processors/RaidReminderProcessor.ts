import { container } from '@sapphire/pieces';
import { TextChannel, userMention, EmbedBuilder } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { DiscordBotClient } from '../discord-bot-client';
import type { RaidData } from '../api/raid-client';

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
			// Fetch raid data from backend using guild leader as caller
			const raidData = await container.backendApi.raids.getActiveRaid(automation.guildId, automation.leaderAllyCode);

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
		allyCode: string;
		playerName?: string;
		discordId?: string;
		score: number;
		target: number;
		targetType: string;
	}> {
		const underperformers: Array<{
			allyCode: string;
			playerName?: string;
			discordId?: string;
			score: number;
			target: number;
			targetType: string;
		}> = [];
		const guildMinScore = raidData.guildConfig?.guildMinScore || 0;

		for (const result of raidData.results) {
			const playerConfig = raidData.playerConfigs.find(
				(pc) => pc.player.allyCode === result.player.allyCode
			);

			// Effective target: personal target if set, otherwise guild minimum
			const effectiveTarget = playerConfig?.playerMinScore ?? guildMinScore;

			let isBelowThreshold = false;
			let target = 0;
			let targetType = '';

			// Check zero score (not participated)
			if (result.score === 0) {
				isBelowThreshold = true;
				target = effectiveTarget;
				targetType = 'Not Participated';
			} else if (playerConfig?.playerMinScore && result.score < playerConfig.playerMinScore) {
				// Check personal target first
				isBelowThreshold = true;
				target = playerConfig.playerMinScore;
				targetType = 'Personal Target';
			} else if (guildMinScore > 0 && result.score < guildMinScore) {
				// Check guild minimum (used as default target)
				isBelowThreshold = true;
				target = guildMinScore;
				targetType = 'Target';
			} else if (playerConfig?.allTimeHigh && result.score < playerConfig.allTimeHigh * 0.9) {
				// Below 90% of all-time high
				isBelowThreshold = true;
				target = Math.round(playerConfig.allTimeHigh * 0.9);
				targetType = '90% ATH';
			}

			if (isBelowThreshold) {
				underperformers.push({
					allyCode: result.player.allyCode,
					playerName: result.player.name,
					discordId: result.player.discordId,
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
			allyCode: string;
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
				: player.playerName || player.allyCode;

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
