import type { TrainPosition } from "@/models";

export class TrainDataProvider {
	private readonly API_BASE_URL = "https://aid.robinklaassen.com";
	private readonly API_KEY = import.meta.env.VITE_AID_API_KEY;
	private readonly TIMEOUT_MS = 30_000;
	private readonly MAX_RETRIES = 3;

	/**
	 * Fetches train locations for the given time range from the API.
	 * Caching is handled by TrainCache, this method just retrieves raw data.
	 * @param start - ISO formatted start timestamp
	 * @param end - ISO formatted end timestamp
	 * @returns Promise resolving to an array of train records
	 */
	async getTrainPositions(
		start: string,
		end: string,
	): Promise<Map<string, TrainPosition[]>> {
		const url = new URL("/trains/locations-keyed", this.API_BASE_URL);
		url.searchParams.append("start", start);
		url.searchParams.append("end", end);

		const data = await this.fetchWithRetry(url.toString(), "train locations");
		return new Map(Object.entries(data as Record<string, TrainPosition[]>));
	}

	async getTrainTypes(
		start: string,
		end: string,
	): Promise<Map<number, string>> {
		const url = new URL("/trains/types/json", this.API_BASE_URL);
		url.searchParams.append("start", start);
		url.searchParams.append("end", end);

		const data = await this.fetchWithRetry(url.toString(), "train types");
		return new Map(
			Object.entries(data as Record<string, string>).map(([key, value]) => [
				Number(key),
				value,
			]),
		);
	}

	/**
	 * Fetches data from the API with timeout and retry logic.
	 */
	private async fetchWithRetry(url: string, label: string): Promise<unknown> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

				try {
					const response = await fetch(url, {
						headers: { "x-api-key": this.API_KEY },
						signal: controller.signal,
					});

					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					return await response.json();
				} finally {
					clearTimeout(timeoutId);
				}
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt < this.MAX_RETRIES) {
					await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
				}
			}
		}

		throw new Error(
			`Failed to fetch ${label}: ${lastError?.message} (after ${this.MAX_RETRIES} retries)`,
		);
	}
}
