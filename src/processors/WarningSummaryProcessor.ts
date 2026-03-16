import { container } from '@sapphire/pieces';
import { TextChannel } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { DiscordBotClient } from '../discord-bot-client';

interface WarningSummaryConfig {
	periods?: number[];
	limit?: number;
}

export class WarningSummaryProcessor implements NotificationProcessor {
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
			const config = (automation.config || {}) as WarningSummaryConfig;
			const periods = config.periods || [30, 90, 180];
			const limit = config.limit || 10;

			// Get summary from backend
			const summary = await container.backendApi.warnings.getSummary(automation.guildId, periods, limit);

			// Get guild name
			const guild = await container.backendApi.guilds.get(automation.guildId);
			const guildName = guild?.name || 'Unknown Guild';

			// Format and send message
			const message = this.formatSummary(guildName, summary, limit);
			await this.sendMessage(channelId, message);

			return { success: true, message: `Sent summary with ${summary.players.length} players` };
		} catch (error) {
			console.error(`Error processing warning summary for guild ${automation.guildId}:`, error);
			return { success: false, message: (error as Error).message };
		}
	}

	private formatSummary(
		guildName: string,
		summary: {
			periods: number[];
			basePeriod: number;
			players: Array<{ allyCode: string; name: string | null; values: number[] }>;
		},
		limit: number
	): string {
		const lines: string[] = [];

		lines.push(`**Warning Summary for ${guildName}** (Top ${limit})`);
		lines.push('');
		lines.push('```');

		// Build header
		const headers = ['Player'];
		for (let i = 0; i < summary.periods.length; i++) {
			const period = summary.periods[i];
			if (i === 0) {
				headers.push(`${period}d`);
			} else {
				headers.push(`${period}d avg`);
			}
		}

		// Calculate column widths
		const colWidths = headers.map((h, i) => {
			if (i === 0) return 16; // Player name column
			return Math.max(h.length, 5);
		});

		// Format header row
		const headerRow = headers.map((h, i) => h.padEnd(colWidths[i] ?? 5)).join(' | ');
		lines.push(headerRow);
		lines.push(colWidths.map((w) => '-'.repeat(w)).join('-+-'));

		// Format player rows
		if (summary.players.length === 0) {
			lines.push('No warnings in the selected period');
		} else {
			for (const player of summary.players) {
				const name = (player.name || player.allyCode).substring(0, 16).padEnd(16);
				const values = player.values.map((v, i) => String(v).padStart(colWidths[i + 1] ?? 5));
				lines.push(`${name} | ${values.join(' | ')}`);
			}
		}

		lines.push('```');
		lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);

		return lines.join('\n');
	}

	private async sendMessage(channelId: string, message: string): Promise<void> {
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
		if (!channel || !channel.isTextBased()) {
			throw new Error(`Channel ${channelId} not found or not a text channel`);
		}
		await channel.send(message);
	}
}
