export class BaseApiClient {
	protected baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	protected async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
		const maxRetries = 3;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const url = `${this.baseUrl}${endpoint}`;
				const response = await fetch(url, {
					...options,
					headers: {
						'Content-Type': 'application/json',
						...options?.headers
					}
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
