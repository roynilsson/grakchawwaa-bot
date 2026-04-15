import { container } from '@sapphire/pieces';
import { TextChannel, EmbedBuilder, roleMention } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { DiscordBotClient } from '../discord-bot-client';

/**
 * Processor for raid_start_notification automation type.
 * Sends a notification when a new raid is detected, optionally mentioning a role.
 */
export class RaidStartNotificationProcessor implements NotificationProcessor {
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
			// Fetch raid data from backend (API key auth - no caller ally code needed)
			const raidData = await container.backendApi.raids.getActiveRaid(automation.guildId, automation.leaderAllyCode);

			if (!raidData || !raidData.raid) {
				console.log(`No active raid for guild ${automation.guildId}`);
				return { success: true, message: 'No active raid' };
			}

			// Send start notification message
			await this.sendStartNotification(channelId, raidData.raid, automation);

			return { success: true };
		} catch (error) {
			console.error(`Error processing raid start notification for guild ${automation.guildId}:`, error);
			return { success: false, message: (error as Error).message };
		}
	}

	private async sendStartNotification(
		channelId: string,
		raid: { id: number; raidType: string; expireTime: string; startTime: string; guildRewardScore: number },
		automation: Automation
	): Promise<void> {
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

		if (!channel || !channel.isTextBased()) {
			throw new Error(`Notification channel ${channelId} is invalid`);
		}

		const expireTime = new Date(raid.expireTime);
		const duration = this.formatDuration(expireTime);
		const raidName = this.formatRaidName(raid.raidType);

		const embed = new EmbedBuilder()
			.setTitle(`\u{1F680} ${raidName} Has Started!`)
			.setDescription(`A new raid has begun! Get your attacks in before it expires.`)
			.addFields(
				{ name: 'Raid Type', value: raidName, inline: true },
				{ name: 'Expires In', value: duration, inline: true },
				{ name: 'Expires At', value: `<t:${Math.floor(expireTime.getTime() / 1000)}:F>`, inline: false }
			)
			.setColor(0x00FF00)
			.setTimestamp();

		// Build message content with optional role mention
		let content = '';
		if (automation.resolvedRole?.discordRoleId) {
			content = roleMention(automation.resolvedRole.discordRoleId);
		}

		await channel.send({
			content: content || undefined,
			embeds: [embed],
		});
	}

	private formatRaidName(raidType: string): string {
		const names: Record<string, string> = {
			kraytdragon: 'Krayt Dragon Raid',
			naboo: 'Naboo Raid',
			order66: 'Order 66 Raid',
		};
		return names[raidType.toLowerCase()] || raidType;
	}

	private formatDuration(expireTime: Date): string {
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
}
