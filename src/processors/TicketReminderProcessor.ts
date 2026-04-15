import { container } from '@sapphire/pieces';
import { TextChannel, userMention } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { MemberTicketInfo } from '../api/guild-client';
import type { DiscordBotClient } from '../discord-bot-client';

const TICKET_THRESHOLD = 600;

export class TicketReminderProcessor implements NotificationProcessor {
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
			// Fetch live ticket data and active leaves in parallel
			const [ticketData, activeLeaves] = await Promise.all([
				container.backendApi.guilds.checkTickets(
					automation.guildId,
					automation.leaderAllyCode
				),
				container.backendApi.leaves.listByGuild(
					automation.guildId,
					{ active: true },
					{ callerAllyCode: automation.leaderAllyCode }
				),
			]);

			// Build set of ally codes on "away" leave (fully unavailable)
			const awayAllyCodes = new Set(
				activeLeaves
					.filter((leave) => leave.leaveType === 'away' && leave.playerAllyCode)
					.map((leave) => leave.playerAllyCode!)
			);

			// Filter players below threshold, excluding those on away leave
			const violators = ticketData.memberTickets.filter(
				(m) => m.ticketCount < TICKET_THRESHOLD && !awayAllyCodes.has(m.allyCode || '')
			);

			if (!violators.length) {
				console.log(`No ticket reminder needed for guild ${automation.guildId} - all players at 600 or on leave`);
				return { success: true, message: 'All players at threshold or on leave' };
			}

			const lines = this.buildReminderLines(violators);
			await this.sendReminderMessage(channelId, ticketData.guildName, lines);

			return { success: true };
		} catch (error) {
			console.error(`Error processing ticket reminder for guild ${automation.guildId}:`, error);
			return { success: false, message: (error as Error).message };
		}
	}

	private buildReminderLines(violators: MemberTicketInfo[]): string[] {
		return violators.map((violator, index) => {
			const label = this.resolveReminderLabel(violator);
			return `${index + 1}. ${label} (${violator.ticketCount}/600)`;
		});
	}

	private resolveReminderLabel(violator: MemberTicketInfo): string {
		if (violator.discordId) {
			return `${userMention(violator.discordId)} (${violator.playerName})`;
		}
		return violator.playerName;
	}

	private async sendReminderMessage(
		channelId: string,
		guildName: string,
		lines: string[]
	): Promise<void> {
		if (!lines.length) {
			return;
		}

		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

		if (!channel || !channel.isTextBased()) {
			throw new Error(`Reminder channel ${channelId} is invalid`);
		}

		const content = [
			`\u23F0 Ticket reminder for ${guildName} (1 hour before reset)`,
			'Players below 600 tickets:',
			...lines
		].join('\n');

		await channel.send({ content });
	}
}
