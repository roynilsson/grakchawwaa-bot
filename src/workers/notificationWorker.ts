import { container } from '@sapphire/pieces';
import type { DiscordBotClient } from '../discord-bot-client';
import type { NotificationProcessor } from '../processors/NotificationProcessor';
import { TicketReminderProcessor } from '../processors/TicketReminderProcessor';
import { TicketCollectionNotificationProcessor } from '../processors/TicketCollectionNotificationProcessor';
import { ViolationSummaryService } from '../services/violation-summary';

const CHECK_FREQUENCY_MS = 60 * 1000; // Check every minute

export class NotificationWorker {
	private client: DiscordBotClient;
	private processors: Record<string, NotificationProcessor>;
	private checkInterval: NodeJS.Timeout | null = null;

	constructor(client: DiscordBotClient) {
		this.client = client;
		const summaryService = new ViolationSummaryService(client);

		this.processors = {
			ticket_reminder: new TicketReminderProcessor(client),
			ticket_collection: new TicketCollectionNotificationProcessor(client, summaryService)
		};
	}

	public start(): void {
		console.log('Starting notification worker...');

		// Run initial check
		this.checkDueAutomations();

		// Schedule regular checks
		this.checkInterval = setInterval(() => {
			this.checkDueAutomations();
		}, CHECK_FREQUENCY_MS);
	}

	public stop(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		console.log('Notification worker stopped');
	}

	private async checkDueAutomations(): Promise<void> {
		try {
			// Fetch all automations due for bot processing
			const guilds = await container.backendApi.guilds.list();

			for (const guild of guilds) {
				const automations = await container.backendApi.automations.listByGuild(guild.id);

				for (const automation of automations) {
					// Skip if not bot-processed or not enabled
					if (automation.processedBy !== 'bot' || !automation.enabled) {
						continue;
					}

					// Skip if not due yet
					if (!automation.nextRunAt) {
						continue;
					}

					const nextRunAt = new Date(automation.nextRunAt).getTime();
					const now = Date.now();

					if (nextRunAt > now) {
						continue;
					}

					// Find processor for this automation type
					const processor = this.processors[automation.automationType];
					if (!processor) {
						console.warn(`No processor for automation type: ${automation.automationType}`);
						continue;
					}

					// Process the automation
					console.log(
						`Processing automation ${automation.id} (${automation.automationType}) for guild ${guild.id}`
					);

					const result = await processor.process(automation);

					if (result.success) {
						console.log(
							`Automation ${automation.id} processed successfully${result.message ? `: ${result.message}` : ''}`
						);
						// Mark as run in backend
						await container.backendApi.automations.markRun(automation.id);
					} else {
						console.error(`Automation ${automation.id} failed: ${result.message}`);
					}
				}
			}
		} catch (error) {
			console.error('Error checking due automations:', error);
		}
	}
}
