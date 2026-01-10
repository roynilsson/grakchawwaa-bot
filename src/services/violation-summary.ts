import { container } from '@sapphire/pieces';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	MessageFlags,
	TextChannel
} from 'discord.js';
import { DiscordBotClient } from '../discord-bot-client';
import type { ViolationSummary as ApiViolationSummary } from '../api/violation-client';

interface ViolationSummary {
	playerName: string;
	violationCount: number;
	averageTickets: number;
	totalMissingTickets: number;
}

interface SummaryContext {
	guildId: string;
	channelId: string;
	guildName: string;
	reportLabel: string;
	daysInPeriod: number;
}

interface SummaryMessageData {
	guildName: string;
	reportLabel: string;
	daysInPeriod: number;
	totalViolations: number;
	totalMissingTickets: number;
	playerStats: ViolationSummary[];
}

interface FullSummaryRequest {
	guildId: string;
	days: number;
	reportLabel: string;
	guildName: string;
}

export class ViolationSummaryService {
	private client: DiscordBotClient;
	private static MAX_TOP_OFFENDERS = 12; // Rows shown in compact summary
	private static FULL_LIST_BUTTON_PREFIX = 'ticket-summary-full';
	private static FULL_LIST_FIRST_CHUNK_PLAYERS = 10;
	private static FULL_LIST_FOLLOWUP_PLAYERS = 20;

	constructor(client: DiscordBotClient) {
		this.client = client;
	}

	public async generateWeeklySummary(
		guildId: string,
		channelId: string,
		guildName: string
	): Promise<void> {
		try {
			await this.sendSummaryReport({
				guildId,
				channelId,
				guildName,
				reportLabel: 'Weekly',
				daysInPeriod: 7
			});
		} catch (error) {
			console.error(`Error generating weekly summary for guild ${guildId}:`, error);
		}
	}

	public async generateMonthlySummary(
		guildId: string,
		channelId: string,
		guildName: string
	): Promise<void> {
		try {
			await this.sendSummaryReport({
				guildId,
				channelId,
				guildName,
				reportLabel: 'Monthly',
				daysInPeriod: 30
			});
		} catch (error) {
			console.error(`Error generating monthly summary for guild ${guildId}:`, error);
		}
	}

	public async generateCustomPeriodSummary(
		guildId: string,
		channelId: string,
		guildName: string,
		days: number
	): Promise<void> {
		try {
			if (days < 1 || days > 90) {
				console.error(`Invalid days value: ${days}. Must be between 1 and 90.`);
				return;
			}

			const reportType = `${days}-Day`;
			await this.sendSummaryReport({
				guildId,
				channelId,
				guildName,
				reportLabel: reportType,
				daysInPeriod: days
			});
		} catch (error) {
			console.error(`Error generating ${days}-day summary for guild ${guildId}:`, error);
		}
	}

	private async sendSummaryReport(context: SummaryContext): Promise<void> {
		try {
			const channel = await this.fetchTextChannel(context.channelId);
			if (!channel) {
				return;
			}

			// Get summary data from backend API (includes player names)
			const apiSummary = await container.backendApi.violations.getViolationSummary(
				context.guildId,
				context.daysInPeriod
			);

			if (!apiSummary.length) {
				console.log(
					`No violations found for ${context.reportLabel.toLowerCase()} summary for guild ${context.guildId}`
				);
				await channel.send({
					content: `**${context.reportLabel} Ticket Summary - ${context.guildName}**\n\nPeriod: Last ${context.daysInPeriod} days\n\n:white_check_mark: No ticket violations recorded during this period. Great job!`
				});
				return;
			}

			const playerStats = this.transformApiSummary(apiSummary);
			const totalMissingTickets = playerStats.reduce(
				(sum, stats) => sum + stats.totalMissingTickets,
				0
			);
			const totalViolations = playerStats.reduce(
				(sum, stats) => sum + stats.violationCount,
				0
			);

			const summaryMessage = this.composeSummaryMessage({
				guildName: context.guildName,
				reportLabel: context.reportLabel,
				daysInPeriod: context.daysInPeriod,
				totalViolations,
				totalMissingTickets,
				playerStats
			});

			const buttonRow = this.createFullListButton(context);

			await channel.send({
				content: summaryMessage,
				components: [buttonRow]
			});
		} catch (error) {
			console.error(
				`Error sending ${context.reportLabel.toLowerCase()} summary to channel ${context.channelId}:`,
				error
			);
		}
	}

	public async handleFullListButton(interaction: ButtonInteraction): Promise<boolean> {
		const request = this.parseFullListCustomId(interaction.customId);
		if (!request) {
			return false;
		}

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const apiSummary = await container.backendApi.violations.getViolationSummary(
				request.guildId,
				request.days
			);

			if (!apiSummary.length) {
				await interaction.editReply('No ticket violations found for this period.');
				return true;
			}

			const playerStats = this.transformApiSummary(apiSummary);
			const totalMissingTickets = playerStats.reduce(
				(sum, stats) => sum + stats.totalMissingTickets,
				0
			);
			const totalViolations = playerStats.reduce(
				(sum, stats) => sum + stats.violationCount,
				0
			);

			const responseChunks = this.createFullListChunks({
				guildName: request.guildName,
				reportLabel: `${request.reportLabel} (full list)`,
				daysInPeriod: request.days,
				totalViolations,
				totalMissingTickets,
				playerStats
			});

			if (!responseChunks.length) {
				await interaction.editReply({
					content: 'No ticket data available to display.'
				});
				return true;
			}

			await interaction.editReply({ content: responseChunks[0] });

			const remainingChunks = responseChunks.slice(1);
			for (const chunk of remainingChunks) {
				await interaction.followUp({
					content: chunk,
					flags: MessageFlags.Ephemeral
				});
			}
			return true;
		} catch (error) {
			console.error('Error responding to full summary request:', error);
			const message = 'Unable to show the full ticket list right now.';
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content: message });
			} else {
				await interaction.reply({ content: message, ephemeral: true });
			}
			return true;
		}
	}

	private transformApiSummary(apiSummary: ApiViolationSummary[]): ViolationSummary[] {
		return apiSummary
			.map((s) => ({
				playerName: s.playerName || s.playerId,
				violationCount: s.violationCount,
				averageTickets: s.averageTickets,
				totalMissingTickets: s.totalMissingTickets
			}))
			.sort((a, b) => a.averageTickets - b.averageTickets);
	}

	private async fetchTextChannel(channelId: string): Promise<TextChannel | null> {
		try {
			const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
			if (!channel || !channel.isTextBased()) {
				console.error(`Channel ${channelId} not found or not a text channel`);
				return null;
			}

			return channel;
		} catch (error) {
			console.error(`Failed to fetch channel ${channelId}`, error);
			return null;
		}
	}

	private composeSummaryMessage(
		data: SummaryMessageData,
		maxPlayers = ViolationSummaryService.MAX_TOP_OFFENDERS
	): string {
		const displayLimit = Math.max(1, maxPlayers);
		const topPlayers = data.playerStats.slice(0, displayLimit);
		const sections = [this.composeSummaryIntro(data)];

		if (topPlayers.length) {
			sections.push(
				`Top offenders (${topPlayers.length} of ${data.playerStats.length}):`,
				this.formatTopPlayersTable(topPlayers)
			);
		} else {
			sections.push('No offenders recorded in this period.');
		}

		const remaining = data.playerStats.length - topPlayers.length;
		if (remaining > 0) {
			const suffix = remaining === 1 ? 'player' : 'players';
			sections.push(`+ ${remaining} additional ${suffix} omitted`);
		}

		return sections.join('\n\n');
	}

	private composeSummaryIntro(data: SummaryMessageData): string {
		const header = `**${data.reportLabel} Ticket Summary - ${data.guildName}**`;
		const periodLine = `Period: Last ${data.daysInPeriod} days`;
		const totals =
			`Violations logged: ${data.totalViolations}\n` +
			`Players flagged: ${data.playerStats.length}\n` +
			`Total missing tickets: ${data.totalMissingTickets}`;

		return [header, periodLine, totals].join('\n\n');
	}

	private createFullListChunks(data: SummaryMessageData): string[] {
		const intro = this.composeSummaryIntro(data);
		const totalPlayers = data.playerStats.length;
		if (!totalPlayers) {
			return [intro];
		}

		const firstChunkPlayers = data.playerStats.slice(
			0,
			ViolationSummaryService.FULL_LIST_FIRST_CHUNK_PLAYERS
		);
		const remainingPlayers = data.playerStats.slice(
			ViolationSummaryService.FULL_LIST_FIRST_CHUNK_PLAYERS
		);

		const chunks: string[] = [];
		const firstChunkHeader = `${intro}\n\nTop offenders (${totalPlayers} of ${totalPlayers}):`;
		const firstTable = this.formatTopPlayersTable(firstChunkPlayers, 0);
		chunks.push(`${firstChunkHeader}\n\n${firstTable}`);

		if (remainingPlayers.length) {
			const followUpChunks = this.buildTableChunks(
				remainingPlayers,
				ViolationSummaryService.FULL_LIST_FOLLOWUP_PLAYERS,
				firstChunkPlayers.length
			);
			chunks.push(...followUpChunks);
		}

		return chunks;
	}

	private buildTableChunks(
		players: ViolationSummary[],
		chunkSize: number,
		startIndex = 0
	): string[] {
		if (!players.length) {
			return [];
		}

		const chunks: string[] = [];

		for (let index = 0; index < players.length; index += chunkSize) {
			const slice = players.slice(index, index + chunkSize);
			chunks.push(this.formatTopPlayersTable(slice, startIndex + index));
		}

		return chunks;
	}

	private createFullListButton(context: SummaryContext): ActionRowBuilder<ButtonBuilder> {
		const button = new ButtonBuilder()
			.setCustomId(
				this.buildFullListCustomId(
					context.guildId,
					context.daysInPeriod,
					context.reportLabel,
					context.guildName
				)
			)
			.setLabel('Show full list')
			.setStyle(ButtonStyle.Secondary);

		return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
	}

	private buildFullListCustomId(
		guildId: string,
		daysInPeriod: number,
		reportLabel: string,
		guildName: string
	): string {
		const safeLabel = encodeURIComponent(reportLabel);
		const safeGuildName = encodeURIComponent(this.truncateForCustomId(guildName));

		return [
			ViolationSummaryService.FULL_LIST_BUTTON_PREFIX,
			guildId,
			daysInPeriod.toString(),
			safeLabel,
			safeGuildName
		].join('|');
	}

	private parseFullListCustomId(customId: string): FullSummaryRequest | null {
		const parts = customId.split('|');
		if (parts.length !== 5) {
			return null;
		}

		const prefix = parts[0]!;
		const guildId = parts[1]!;
		const daysText = parts[2]!;
		const encodedLabel = parts[3]!;
		const encodedGuildName = parts[4]!;

		if (prefix !== ViolationSummaryService.FULL_LIST_BUTTON_PREFIX) {
			return null;
		}

		const days = Number(daysText);
		if (!guildId || Number.isNaN(days) || days <= 0) {
			return null;
		}

		try {
			return {
				guildId,
				days,
				reportLabel: decodeURIComponent(encodedLabel),
				guildName: decodeURIComponent(encodedGuildName)
			};
		} catch {
			return null;
		}
	}

	private truncateForCustomId(value: string, limit = 32): string {
		if (value.length <= limit) {
			return value;
		}

		return value.slice(0, limit);
	}

	private formatTopPlayersTable(players: ViolationSummary[], startIndex = 0): string {
		const header = 'Rank Player              Avg   Missing Viol';

		const lines = players.map((stats, index) => {
			const rank = (startIndex + index + 1).toString().padStart(2, ' ');
			const name = this.formatPlayerName(stats.playerName);
			const avg = stats.averageTickets.toFixed(1).padStart(6, ' ');
			const missing = stats.totalMissingTickets.toString().padStart(7, ' ');
			const violations = stats.violationCount.toString().padStart(4, ' ');

			return `${rank}. ${name} ${avg} ${missing} ${violations}`;
		});

		return ['```', header, ...lines, '```'].join('\n');
	}

	private formatPlayerName(name: string): string {
		const maxLength = 18;
		if (name.length <= maxLength) {
			return name.padEnd(maxLength, ' ');
		}

		return `${name.slice(0, maxLength - 3)}...`;
	}
}
