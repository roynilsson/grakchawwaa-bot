export interface RequestOptions extends Omit<RequestInit, 'headers'> {
	headers?: Record<string, string>;
	callerAllyCode?: string;
}

export class BaseApiClient {
	protected baseUrl: string;
	protected apiKey: string | undefined;

	constructor(baseUrl: string, apiKey?: string) {
		this.baseUrl = baseUrl;
		this.apiKey = apiKey;
	}

	protected async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
		const maxRetries = 3;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const url = `${this.baseUrl}${endpoint}`;
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...(options?.headers)
				};

				if (this.apiKey) {
					headers['x-api-key'] = this.apiKey;
				}

				if (options?.callerAllyCode) {
					headers['x-caller-ally-code'] = options.callerAllyCode;
				}

				const response = await fetch(url, {
					...options,
					headers
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string };

					// Don't retry client errors (4xx)
					if (response.status >= 400 && response.status < 500) {
						throw new Error(errorData.error || `HTTP ${response.status}`);
					}

					// Retry server errors (5xx)
					if (attempt < maxRetries - 1) {
						await this.delay(Math.pow(2, attempt) * 1000);
						continue;
					}

					throw new Error(errorData.error || `HTTP ${response.status}`);
				}

				return (await response.json()) as T;
			} catch (error: unknown) {
				lastError = error as Error;

				// Retry on network errors
				if (attempt < maxRetries - 1) {
					await this.delay(Math.pow(2, attempt) * 1000);
					continue;
				}
			}
		}

		throw lastError;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
