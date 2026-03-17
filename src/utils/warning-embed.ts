import { EmbedBuilder } from 'discord.js';
import type { PlayerWarningSummary } from '../api/warning-client';

/**
 * Build a Discord embed for a player's warning summary
 */
export function buildPlayerWarningSummaryEmbed(summary: PlayerWarningSummary): EmbedBuilder {
	const { player, period, summary: stats, warnings } = summary;

	// Format dates
	const startDate = new Date(period.startDate);
	const endDate = new Date(period.endDate);
	const dateFormat: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const startStr = startDate.toLocaleDateString('en-US', dateFormat);
	const endStr = endDate.toLocaleDateString('en-US', dateFormat);
	const year = endDate.getFullYear();

	const embed = new EmbedBuilder()
		.setTitle(`Warning Summary for ${player.playerName || player.allyCode}`)
		.setDescription(`Last ${period.days} days (${startStr} - ${endStr}, ${year})`)
		.setColor(stats.totalWarnings > 0 ? 0xFFA500 : 0x00FF00) // Orange if warnings, green if clean
		.setTimestamp();

	// Summary field
	const summaryLines = [
		`**Total Warnings:** ${stats.totalWarnings}`,
		`**Total Points:** ${stats.totalPoints}`,
		`**Guild Rank:** #${stats.rank} of ${stats.guildMemberCount} members`,
		`**Guild Total:** ${stats.guildTotalPoints} pts | **Average:** ${stats.guildAveragePoints} pts`,
	];
	embed.addFields({ name: 'Summary', value: summaryLines.join('\n'), inline: false });

	// Warnings field
	if (warnings.length === 0) {
		embed.addFields({
			name: 'Warnings',
			value: 'No warnings recorded during this period.',
			inline: false
		});
	} else {
		const warningLines: string[] = [];
		for (const w of warnings) {
			const date = new Date(w.createdAt).toLocaleDateString('en-US', dateFormat);
			let line = `**${date}** - ${w.warningType.name} (${w.warningType.severity} pts)`;

			const details: string[] = [];
			if (w.warningType.category) {
				details.push(`[${w.warningType.category}]`);
			}
			if (w.issuedBy) {
				details.push(`Issued by ${w.issuedBy}`);
			}
			if (details.length > 0) {
				line += `\n${details.join(' ')}`;
			}
			if (w.note) {
				line += `\n> ${w.note}`;
			}
			warningLines.push(line);
		}

		// Discord embed field value limit is 1024 chars
		let warningsValue = warningLines.join('\n\n');
		if (warningsValue.length > 1000) {
			// Truncate and add indicator
			const truncated = warningLines.slice(0, 5);
			warningsValue = truncated.join('\n\n') + `\n\n*...and ${warnings.length - 5} more*`;
		}

		embed.addFields({ name: 'Warnings', value: warningsValue, inline: false });
	}

	return embed;
}
