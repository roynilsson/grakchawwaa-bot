import { container } from '@sapphire/pieces';
import { TextChannel } from 'discord.js';
import type { Automation } from '../api/automation-client';
import type { NotificationProcessor, NotificationResult } from './NotificationProcessor';
import type { DiscordBotClient } from '../discord-bot-client';

interface GuildMember {
	player: {
		allyCode: string;
		playerId?: string;
		name?: string;
	};
	memberLevel: number;
	joinedAt: string; // ISO date string
	isActive: boolean;
}

interface MemberAnniversary {
	id: string;
	name: string;
	years: number;
	joinTime: number;
}

export class AnniversaryProcessor implements NotificationProcessor {
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
			// Fetch guild info and members in parallel
			const [guild, members] = await Promise.all([
				container.backendApi.guilds.get(automation.guildId),
				container.backendApi.guilds.getMembers(automation.guildId)
			]);

			if (!members?.length) {
				return { success: true, message: 'No member data found' };
			}

			const anniversaries = this.findAnniversaries(members);

			if (anniversaries.length === 0) {
				console.log(`No anniversaries today for guild ${automation.guildId}`);
				return { success: true, message: 'No anniversaries today' };
			}

			await this.sendAnniversaryMessage(channelId, guild?.name || 'Guild', anniversaries);

			return { success: true, message: `Sent ${anniversaries.length} anniversary notification(s)` };
		} catch (error) {
			console.error(`Error processing anniversaries for guild ${automation.guildId}:`, error);
			return { success: false, message: (error as Error).message };
		}
	}

	private findAnniversaries(members: GuildMember[]): MemberAnniversary[] {
		const anniversaries: MemberAnniversary[] = [];
		const today = new Date();

		for (const member of members) {
			if (!member.joinedAt) continue;

			const joinDate = new Date(member.joinedAt);

			// Check if today is the anniversary of the join date
			const isAnniversary =
				today.getUTCMonth() === joinDate.getUTCMonth() && today.getUTCDate() === joinDate.getUTCDate();

			if (isAnniversary) {
				const yearsJoined = today.getUTCFullYear() - joinDate.getUTCFullYear();

				// Only celebrate full years (1 year or more)
				if (yearsJoined >= 1) {
					anniversaries.push({
						id: member.player.playerId || member.player.allyCode,
						name: member.player.name || member.player.allyCode,
						years: yearsJoined,
						joinTime: Math.floor(joinDate.getTime() / 1000)
					});
				}
			}
		}

		return anniversaries;
	}

	private getAnniversaryEmoji(years: number): string {
		if (years >= 5) return '🏆 🎖️ 🎊';
		if (years >= 3) return '🥂 🎉';
		return '🎂 🎊';
	}

	private getYearText(years: number): string {
		if (years >= 5) return `${years} YEARS`;
		if (years >= 3) return `${years} Years`;
		return `${years} Year${years === 1 ? '' : 's'}`;
	}

	private async sendAnniversaryMessage(
		channelId: string,
		guildName: string,
		anniversaries: MemberAnniversary[]
	): Promise<void> {
		const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

		if (!channel || !channel.isTextBased()) {
			throw new Error(`Anniversary channel ${channelId} is invalid`);
		}

		// Sort by years (descending) so longest-standing members appear first
		const sortedAnniversaries = [...anniversaries].sort((a, b) => b.years - a.years);

		let message = `🎉 **Guild Membership Anniversaries for ${guildName}** 🎉\n\n`;
		message += `Today we celebrate ${anniversaries.length} guild member${anniversaries.length === 1 ? '' : 's'} who joined our ranks on this day in the past!\n\n`;

		for (const anniversary of sortedAnniversaries) {
			const joinDate = new Date(anniversary.joinTime * 1000);
			const formattedDate = joinDate.toISOString().slice(0, 10);
			const yearsSinceJoining = `${anniversary.years} year${anniversary.years === 1 ? '' : 's'} ago`;

			const emoji = this.getAnniversaryEmoji(anniversary.years);
			const yearText = this.getYearText(anniversary.years);

			message += `${emoji} **${anniversary.name}** - ${yearText} ${emoji}\n`;
			message += `Joined on ${formattedDate} (${yearsSinceJoining})\n\n`;
		}

		await channel.send({ content: message });
		console.log(`Sent anniversary notifications for ${anniversaries.length} members in guild ${guildName}`);
	}
}
