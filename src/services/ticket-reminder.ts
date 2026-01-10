import { container } from '@sapphire/pieces';
import { TextChannel, userMention } from 'discord.js';
import { DiscordBotClient } from '../discord-bot-client';
import type { MemberTicketInfo } from '../api/guild-client';

const TICKET_THRESHOLD = 600;
const CHECK_FREQUENCY_MS = 60 * 1000; // Check every minute
const REMINDER_BEFORE_RESET_MS = 60 * 60 * 1000; // 1 hour before reset

export class TicketReminderService {
	private client: DiscordBotClient;
	private checkInterval: NodeJS.Timeout | null = null;
	private reminderSentTimes: Set<string> = new Set();
	private isDevMode: boolean;

	constructor(client: DiscordBotClient) {
		this.client = client;
		this.isDevMode = process.env.NODE_ENV === 'development';
	}

	public start(): void {
		console.log(
			`Starting ticket reminder service in ${this.isDevMode ? 'development' : 'production'} mode`
		);

		if (this.isDevMode) {
			console.log('Development mode: Running reminder check once');
			this.checkGuildsForReminders();
		} else {
			this.checkInterval = setInterval(() => {
				this.checkGuildsForReminders();
			}, CHECK_FREQUENCY_MS);
		}
	}

	public stop(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		this.reminderSentTimes.clear();
	}

	private async checkGuildsForReminders(): Promise<void> {
		try {
			const guilds = await container.backendApi.guilds.list();
			const now = Date.now();

			for (const guild of guilds) {
				if (!guild.ticketReminderChannelId || !guild.nextTicketCollectionRefreshTime) {
					continue;
				}

				const refreshTime = new Date(guild.nextTicketCollectionRefreshTime).getTime();
				const refreshTimeKey = `${guild.id}:${refreshTime}`;
				const timeUntilReset = refreshTime - now;

				// Skip if reminder already sent for this refresh cycle
				if (this.reminderSentTimes.has(refreshTimeKey)) {
					continue;
				}

				// In dev mode, always send reminder for testing
				if (this.isDevMode) {
					console.log(`Development mode: Force sending reminder for guild ${guild.id}`);
					const sent = await this.sendReminder(guild.id, guild.ticketReminderChannelId);
					if (sent) {
						this.reminderSentTimes.add(refreshTimeKey);
					}
					continue;
				}

				// In production, send reminder 1 hour before reset
				if (timeUntilReset > 0 && timeUntilReset <= REMINDER_BEFORE_RESET_MS) {
					const sent = await this.sendReminder(guild.id, guild.ticketReminderChannelId);
					if (sent) {
						this.reminderSentTimes.add(refreshTimeKey);
					}
				}

				// Clean up old reminder tracking when reset has passed
				if (timeUntilReset < -CHECK_FREQUENCY_MS * 2) {
					this.reminderSentTimes.delete(refreshTimeKey);
				}
			}
		} catch (error) {
			console.error('Error checking guilds for reminders:', error);
		}
	}

	private async sendReminder(guildId: string, channelId: string): Promise<boolean> {
		try {
			// Fetch live ticket data from backend
			const ticketData = await container.backendApi.guilds.checkTickets(guildId);

			// Filter players below threshold
			const violators = ticketData.memberTickets.filter(
				(m) => m.ticketCount < TICKET_THRESHOLD
			);

			if (!violators.length) {
				console.log(`No ticket reminder needed for guild ${guildId} - all players at 600`);
				return true;
			}

			const lines = this.buildReminderLines(violators);
			await this.sendReminderMessage(channelId, ticketData.guildName, lines);
			return true;
		} catch (error) {
			console.error(`Error sending ticket reminder for guild ${guildId}:`, error);
			return false;
		}
	}

	private buildReminderLines(violators: MemberTicketInfo[]): string[] {
		return violators.map((violator, index) => {
			const label = this.resolveReminderLabel(violator);
			return `${index + 1}. ${label} (${violator.ticketCount}/600)`;
		});
	}

	private resolveReminderLabel(violator: MemberTicketInfo): string {
		// If we have a Discord ID, mention the user
		if (violator.discordId) {
			return userMention(violator.discordId);
		}
		// Fall back to player name
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

		try {
			const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

			if (!channel || !channel.isTextBased()) {
				console.error(`Reminder channel ${channelId} is invalid`);
				return;
			}

			const content = [
				`\u23F0 Ticket reminder for ${guildName} (1 hour before reset)`,
				'Players below 600 tickets:',
				...lines
			].join('\n');

			await channel.send({ content });
		} catch (error) {
			console.error(`Error sending reminder message to channel ${channelId}:`, error);
		}
	}
}
