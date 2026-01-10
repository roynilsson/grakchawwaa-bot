import { container } from '@sapphire/pieces';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { DiscordBotClient } from '../discord-bot-client';
import type { Violation } from '../api/violation-client';
import type { Guild } from '../api/guild-client';
import { ViolationSummaryService } from './violation-summary';

const TICKET_THRESHOLD = 600;
const CHECK_FREQUENCY_MS = 60 * 1000; // Check every minute
const NOTIFICATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window for notifications
const EMBED_FIELD_LIMIT = 25;
const EMBEDS_PER_MESSAGE = 10;

export class TicketNotificationService {
	private client: DiscordBotClient;
	private summaryService: ViolationSummaryService;
	private checkInterval: NodeJS.Timeout | null = null;
	private notifiedCollections: Set<string> = new Set();
	private isDevMode: boolean;

	constructor(client: DiscordBotClient, summaryService: ViolationSummaryService) {
		this.client = client;
		this.summaryService = summaryService;
		this.isDevMode = process.env.NODE_ENV === 'development';
	}

	public start(): void {
		console.log(
			`Starting ticket notification service in ${this.isDevMode ? 'development' : 'production'} mode`
		);

		if (this.isDevMode) {
			console.log('Development mode: Running notification check once');
			this.checkGuildsForNotifications();
		} else {
			this.checkInterval = setInterval(() => {
				this.checkGuildsForNotifications();
			}, CHECK_FREQUENCY_MS);
		}
	}

	public stop(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		this.notifiedCollections.clear();
	}

	private async checkGuildsForNotifications(): Promise<void> {
		try {
			const guilds = await container.backendApi.guilds.list();
			const now = Date.now();

			for (const guild of guilds) {
				if (!guild.ticketCollectionChannelId || !guild.lastTicketCollectionTime) {
					continue;
				}

				const collectionTime = new Date(guild.lastTicketCollectionTime).getTime();
				const collectionKey = `${guild.id}:${collectionTime}`;
				const timeSinceCollection = now - collectionTime;

				// Skip if already notified for this collection
				if (this.notifiedCollections.has(collectionKey)) {
					continue;
				}

				// In dev mode, always send notification for testing
				if (this.isDevMode) {
					console.log(`Development mode: Force sending notification for guild ${guild.id}`);
					await this.sendNotification(guild);
					this.notifiedCollections.add(collectionKey);
					await this.checkAndGenerateSummaries(guild);
					continue;
				}

				// In production, send notification if collection happened recently (within window)
				if (timeSinceCollection >= 0 && timeSinceCollection <= NOTIFICATION_WINDOW_MS) {
					await this.sendNotification(guild);
					this.notifiedCollections.add(collectionKey);
					await this.checkAndGenerateSummaries(guild);
				}

				// Clean up old notification tracking
				if (timeSinceCollection > NOTIFICATION_WINDOW_MS * 2) {
					this.notifiedCollections.delete(collectionKey);
				}
			}
		} catch (error) {
			console.error('Error checking guilds for notifications:', error);
		}
	}

	private async sendNotification(guild: Guild): Promise<void> {
		if (!guild.ticketCollectionChannelId) {
			return;
		}

		try {
			// Get today's violations from backend
			const today = new Date();
			const violations = await container.backendApi.violations.getDailyViolations(
				guild.id,
				today
			);

			if (violations.length > 0) {
				await this.sendViolationNotification(
					guild.ticketCollectionChannelId,
					guild.name || 'Unknown Guild',
					violations
				);
			} else {
				await this.sendSuccessNotification(
					guild.ticketCollectionChannelId,
					guild.name || 'Unknown Guild'
				);
			}
		} catch (error) {
			console.error(`Error sending notification for guild ${guild.id}:`, error);
		}
	}

	private async sendViolationNotification(
		channelId: string,
		guildName: string,
		violations: Violation[]
	): Promise<void> {
		try {
			const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
			if (!channel || !channel.isTextBased()) {
				console.error(`Channel ${channelId} not found or not a text channel`);
				return;
			}

			const embeds = this.buildViolationEmbeds(guildName, violations);
			if (!embeds.length) {
				return;
			}

			const batches = this.chunkEmbeds(embeds);
			for (const batch of batches) {
				await channel.send({ embeds: batch });
			}
		} catch (error) {
			console.error(`Error sending violation notification to channel ${channelId}:`, error);
		}
	}

	private buildViolationEmbeds(guildName: string, violations: Violation[]): EmbedBuilder[] {
		if (!violations.length) {
			return [];
		}

		const sortedViolations = [...violations].sort((a, b) => a.ticketCount - b.ticketCount);
		const totalMissingTickets = sortedViolations.reduce(
			(sum, v) => sum + (TICKET_THRESHOLD - v.ticketCount),
			0
		);

		const embedChunks: EmbedBuilder[] = [];

		for (let index = 0; index < sortedViolations.length; index += EMBED_FIELD_LIMIT) {
			const chunk = sortedViolations.slice(index, index + EMBED_FIELD_LIMIT);
			const embed = new EmbedBuilder()
				.setColor(0xed4245)
				.setTitle(
					index === 0
						? `Ticket Violation Report for ${guildName}`
						: `Ticket Violation Report (cont.) - ${guildName}`
				)
				.setTimestamp();

			if (index === 0) {
				embed
					.setDescription(
						`The following ${violations.length} players did not reach ${TICKET_THRESHOLD} daily raid tickets`
					)
					.setFooter({
						text: `Total missing tickets: ${totalMissingTickets}`
					});
			}

			chunk.forEach((violation, position) => {
				const rank = index + position + 1;
				const name = violation.playerName || violation.playerId;
				embed.addFields({
					name: `${rank}. ${name}`,
					value: `${violation.ticketCount}/${TICKET_THRESHOLD} tickets`,
					inline: true
				});
			});

			embedChunks.push(embed);
		}

		return embedChunks;
	}

	private chunkEmbeds(embeds: EmbedBuilder[]): EmbedBuilder[][] {
		const batches: EmbedBuilder[][] = [];

		for (let index = 0; index < embeds.length; index += EMBEDS_PER_MESSAGE) {
			batches.push(embeds.slice(index, index + EMBEDS_PER_MESSAGE));
		}

		return batches;
	}

	private async sendSuccessNotification(channelId: string, guildName: string): Promise<void> {
		try {
			const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
			if (!channel || !channel.isTextBased()) {
				console.error(`Channel ${channelId} not found or not a text channel`);
				return;
			}

			const embed = new EmbedBuilder()
				.setColor(0x57f287) // Green color for success
				.setTitle(`\uD83C\uDF89 Perfect Ticket Collection for ${guildName}!`)
				.setDescription(
					`Everyone in the guild collected ${TICKET_THRESHOLD} daily raid tickets! Great job, team! \uD83D\uDE80`
				)
				.setTimestamp();

			await channel.send({ embeds: [embed] });
		} catch (error) {
			console.error(`Error sending success notification to channel ${channelId}:`, error);
		}
	}

	private async checkAndGenerateSummaries(guild: Guild): Promise<void> {
		if (!guild.ticketCollectionChannelId) {
			return;
		}

		try {
			const now = new Date();
			const isWeeklySummaryTime = now.getDay() === 0; // Sunday
			const isLastDayOfMonth =
				now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

			// In dev mode, always generate summaries for testing
			const forceGenerate = this.isDevMode;

			if (isWeeklySummaryTime || forceGenerate) {
				console.log(
					`Generating weekly summary for guild ${guild.id}${forceGenerate ? ' (forced)' : ''}`
				);
				await this.summaryService.generateWeeklySummary(
					guild.id,
					guild.ticketCollectionChannelId,
					guild.name || 'Unknown Guild'
				);
			}

			if (isLastDayOfMonth || forceGenerate) {
				console.log(
					`Generating monthly summary for guild ${guild.id}${forceGenerate ? ' (forced)' : ''}`
				);
				await this.summaryService.generateMonthlySummary(
					guild.id,
					guild.ticketCollectionChannelId,
					guild.name || 'Unknown Guild'
				);
			}
		} catch (error) {
			console.error(`Error generating summaries for guild ${guild.id}:`, error);
		}
	}
}
