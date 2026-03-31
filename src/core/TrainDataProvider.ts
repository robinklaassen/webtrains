import type { TrainPosition } from "@/models";

export class TrainDataProvider {
	private readonly API_BASE_URL = "https://aid.robinklaassen.com";
	private readonly API_KEY = import.meta.env.VITE_AID_API_KEY;

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

		// TODO add timeout and retry logic for robustness
		const response = await fetch(url.toString(), {
			headers: {
				"x-api-key": this.API_KEY,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch train locations: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		// Convert plain object to Map
		return new Map(Object.entries(data));
	}

	async getTrainTypes(): Promise<Map<number, string>> {
		const url = new URL("/trains/types/json", this.API_BASE_URL);

		const response = await fetch(url.toString(), {
			headers: {
				"x-api-key": this.API_KEY,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch train types: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		return new Map(
			Object.entries(data).map(([key, value]) => [
				Number(key),
				value as string,
			]),
		);
	}
}
