import { container } from '@sapphire/pieces';
import { EmbedBuilder, TextChannel } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { Violation } from '../api/violation-client';
import type { DiscordBotClient } from '../discord-bot-client';
import { ViolationSummaryService } from '../services/violation-summary';

const TICKET_THRESHOLD = 600;
const EMBED_FIELD_LIMIT = 25;
const EMBEDS_PER_MESSAGE = 10;

interface TicketCollectionConfig {
	channelId?: string;
}

export class TicketCollectionNotificationProcessor implements NotificationProcessor {
	private client: DiscordBotClient;
	private summaryService: ViolationSummaryService;

	constructor(client: DiscordBotClient, summaryService: ViolationSummaryService) {
		this.client = client;
		this.summaryService = summaryService;
	}

	async process(automation: Automation): Promise<NotificationResult> {
		const config = automation.config as TicketCollectionConfig;

		if (!config.channelId) {
			return { success: true, message: 'No channel configured, skipping' };
		}

		try {
			// Get today's violations from backend
			const today = new Date();
			const violations = await container.backendApi.violations.getDailyViolations(
				automation.guildId,
				today
			);

			// Get guild name
			const guild = await container.backendApi.guilds.get(automation.guildId);
			const guildName = guild?.name || 'Unknown Guild';

			if (violations.length > 0) {
				await this.sendViolationNotification(config.channelId, guildName, violations);
			} else {
				await this.sendSuccessNotification(config.channelId, guildName);
			}

			// Check and generate summaries
			await this.checkAndGenerateSummaries(automation.guildId, config.channelId, guildName);

			return { success: true };
		} catch (error) {
			console.error(
				`Error processing ticket collection notification for guild ${automation.guildId}:`,
				error
			);
			return { success: false, message: (error as Error).message };
		}
	}

	private async sendViolationNotification(
		channelId: string,
		guildName: string,
		violations: Violation[]
	): Promise<void> {
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
		if (!channel || !channel.isTextBased()) {
			throw new Error(`Channel ${channelId} not found or not a text channel`);
		}

		const embeds = this.buildViolationEmbeds(guildName, violations);
		if (!embeds.length) {
			return;
		}

		const batches = this.chunkEmbeds(embeds);
		for (const batch of batches) {
			await channel.send({ embeds: batch });
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
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
		if (!channel || !channel.isTextBased()) {
			throw new Error(`Channel ${channelId} not found or not a text channel`);
		}

		const embed = new EmbedBuilder()
			.setColor(0x57f287)
			.setTitle(`\uD83C\uDF89 Perfect Ticket Collection for ${guildName}!`)
			.setDescription(
				`Everyone in the guild collected ${TICKET_THRESHOLD} daily raid tickets! Great job, team! \uD83D\uDE80`
			)
			.setTimestamp();

		await channel.send({ embeds: [embed] });
	}

	private async checkAndGenerateSummaries(
		guildId: string,
		channelId: string,
		guildName: string
	): Promise<void> {
		const now = new Date();
		const isWeeklySummaryTime = now.getDay() === 0; // Sunday
		const isLastDayOfMonth =
			now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

		if (isWeeklySummaryTime) {
			console.log(`Generating weekly summary for guild ${guildId}`);
			await this.summaryService.generateWeeklySummary(guildId, channelId, guildName);
		}

		if (isLastDayOfMonth) {
			console.log(`Generating monthly summary for guild ${guildId}`);
			await this.summaryService.generateMonthlySummary(guildId, channelId, guildName);
		}
	}
}
