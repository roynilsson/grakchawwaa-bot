import type { Automation } from '../api/automation-client';

export interface NotificationResult {
	success: boolean;
	message?: string;
}

export interface NotificationProcessor {
	process(automation: Automation): Promise<NotificationResult>;
}
