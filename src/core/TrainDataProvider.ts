import type { TrainRecord } from "@/models";

export class TrainDataProvider {
	// TODO switch to keyed locations endpoint to minimize data transfer and processing
	private readonly API_URL = "https://aid2.robinklaassen.com/trains/locations";
	private readonly API_KEY = import.meta.env.VITE_AID_API_KEY;

	/**
	 * Fetches train locations for the given time range from the API.
	 * Caching is handled by TrainCache, this method just retrieves raw data.
	 * @param start - ISO formatted start timestamp
	 * @param end - ISO formatted end timestamp
	 * @returns Promise resolving to an array of train records
	 */
	async fetchFromAPI(start: string, end: string): Promise<TrainRecord[]> {
		const url = new URL(this.API_URL);
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

		return response.json();
	}
}
