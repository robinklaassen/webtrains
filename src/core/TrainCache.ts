import dayjs from "dayjs";
import type { TrainPosition } from "@/models";
import type { TrainDataProvider } from "./TrainDataProvider";

/**
 * Manages caching of train location data with smart boundary-aware loading.
 * Cache is keyed by 10-second timestamp marks.
 * On-demand extension of cache boundaries without buffering.
 */
export class TrainCache {
	private cache: Map<string, TrainPosition[]> = new Map();
	private firstTimestamp: dayjs.Dayjs | null = null;
	private lastTimestamp: dayjs.Dayjs | null = null;
	private dataProvider: TrainDataProvider;
	private extensionPromise: Promise<void> | null = null;

	constructor(dataProvider: TrainDataProvider) {
		this.dataProvider = dataProvider;
	}

	/**
	 * Ensures the cache is populated for the requested time range.
	 * Only fetches gaps that are not already cached. On first call, fetches the entire range.
	 * Subsequent calls are efficient - only fetching data before firstTimestamp or after lastTimestamp.
	 * @param startTime - dayjs timestamp to start from
	 * @param endTime - dayjs timestamp to end at
	 */
	async ensureRangeLoaded(
		startTime: dayjs.Dayjs,
		endTime: dayjs.Dayjs,
	): Promise<void> {
		// Determine what needs to be fetched
		const fetchRanges: Array<{ start: dayjs.Dayjs; end: dayjs.Dayjs }> = [];

		if (this.firstTimestamp === null || this.lastTimestamp === null) {
			// Cache is empty - fetch entire range
			fetchRanges.push({ start: startTime, end: endTime });
			console.log(
				`Loading train data for a time span of ${endTime.diff(startTime, "minute")} minutes (initial load)`,
			);
		} else {
			// Cache exists - identify gaps
			if (startTime.isBefore(this.firstTimestamp)) {
				fetchRanges.push({ start: startTime, end: this.firstTimestamp });
				console.log(
					`Loading train data for gap before: ${this.firstTimestamp.diff(startTime, "minute")} minutes`,
				);
			}

			if (endTime.isAfter(this.lastTimestamp)) {
				fetchRanges.push({ start: this.lastTimestamp, end: endTime });
				console.log(
					`Loading train data for gap after: ${endTime.diff(this.lastTimestamp, "minute")} minutes`,
				);
			}
		}

		// Fetch all identified gaps
		let totalRecords = 0;
		for (const range of fetchRanges) {
			const data = await this.dataProvider.getTrainPositions(
				range.start.toISOString(),
				range.end.toISOString(),
			);
			totalRecords += Array.from(data.values()).reduce(
				(sum, positions) => sum + positions.length,
				0,
			);

			// Merge into cache
			this.mergeDataIntoCache(data);
		}

		console.log(`Retrieved ${totalRecords} train records from API`);
	}

	/**
	 * Merges fetched data into the cache and updates boundaries.
	 * Data comes pre-keyed by normalized timestamp, so we store it directly.
	 * @param data - Map of normalized ISO timestamp strings to TrainPosition arrays
	 */
	private mergeDataIntoCache(data: Map<string, TrainPosition[]>): void {
		// Data is already keyed by normalized timestamp and contains TrainPosition objects
		data.forEach((positions, timestampStr) => {
			if (!this.cache.has(timestampStr)) {
				this.cache.set(timestampStr, []);
			}
			const cachedPositions = this.cache.get(timestampStr) ?? [];
			// Avoid duplicates
			positions.forEach((position) => {
				if (!cachedPositions.some((p) => p.id === position.id)) {
					cachedPositions.push(position);
				}
			});
		});

		// Update boundaries based on actual data
		if (data.size > 0) {
			const timestamps = Array.from(data.keys())
				.map((key) => dayjs(key))
				.sort((a, b) => a.valueOf() - b.valueOf());

			if (
				this.firstTimestamp === null ||
				timestamps[0].isBefore(this.firstTimestamp)
			) {
				this.firstTimestamp = timestamps[0];
			}
			if (
				this.lastTimestamp === null ||
				timestamps[timestamps.length - 1].isAfter(this.lastTimestamp)
			) {
				this.lastTimestamp = timestamps[timestamps.length - 1];
			}
		}
	}

	/**
	 * Gets all trains at a specific timestamp.
	 * Returns immediately from cache. If timestamp is outside cached range,
	 * starts background extension process and returns empty array.
	 * @param timestamp - dayjs timestamp object (10-second mark)
	 * @returns Array of train positions at that timestamp, or empty array if not cached
	 */
	getTrainsAtTimestamp(timestamp: dayjs.Dayjs): TrainPosition[] {
		const timestampStr = timestamp.format("YYYY-MM-DDTHH:mm:ss");
		if (this.cache.has(timestampStr)) {
			return this.cache.get(timestampStr) ?? [];
		}

		// Timestamp not yet cached - trigger background load if needed
		if (!this.isCached(timestamp)) {
			// Fire and forget - don't wait for this
			this.extendCacheIfNeeded(timestamp).catch((err) => {
				console.error("Failed to extend cache:", err);
			});
		}

		// Return empty array immediately (data will be available on next request)
		return [];
	}

	/**
	 * Checks if a timestamp is within the currently cached range.
	 * @param timestamp - dayjs timestamp object
	 * @returns true if timestamp is within cached boundaries
	 */
	private isCached(timestamp: dayjs.Dayjs): boolean {
		if (this.firstTimestamp === null || this.lastTimestamp === null) {
			return false;
		}
		return (
			timestamp.valueOf() >= this.firstTimestamp.valueOf() &&
			timestamp.valueOf() <= this.lastTimestamp.valueOf()
		);
	}

	/**
	 * Extends cache boundaries if the timestamp is outside the current range.
	 * Only fetches the missing gap, no buffering.
	 * @param timestamp - dayjs timestamp object that needs to be cached
	 */
	private async extendCacheIfNeeded(timestamp: dayjs.Dayjs): Promise<void> {
		// Avoid duplicate concurrent extension attempts
		if (this.extensionPromise) {
			await this.extensionPromise;
			return;
		}

		// Re-check after waiting for any in-flight request
		if (this.isCached(timestamp)) {
			return;
		}

		try {
			this.extensionPromise = this.performExtension(timestamp);
			await this.extensionPromise;
		} finally {
			this.extensionPromise = null;
		}
	}

	/**
	 * Performs the actual cache extension by fetching missing data.
	 * @param timestamp - dayjs timestamp object that needs to be in cache
	 */
	private async performExtension(timestamp: dayjs.Dayjs): Promise<void> {
		if (this.firstTimestamp === null || this.lastTimestamp === null) {
			// Cache is empty - shouldn't happen after ensureRangeLoaded, but be safe
			return;
		}

		let startToFetch: dayjs.Dayjs;
		let endToFetch: dayjs.Dayjs;

		if (timestamp.isBefore(this.firstTimestamp)) {
			// Extend backwards
			startToFetch = timestamp;
			endToFetch = this.firstTimestamp;
		} else if (timestamp.isAfter(this.lastTimestamp)) {
			// Extend forwards
			startToFetch = this.lastTimestamp;
			endToFetch = timestamp;
		} else {
			// Somehow already cached
			return;
		}

		// Fetch the missing gap
		const data = await this.dataProvider.getTrainPositions(
			startToFetch.toISOString(),
			endToFetch.toISOString(),
		);

		// Merge into cache
		this.mergeDataIntoCache(data);
	}

	/**
	 * Clears the entire cache.
	 */
	clearCache(): void {
		this.cache.clear();
		this.firstTimestamp = null;
		this.lastTimestamp = null;
	}

	/**
	 * Returns cache statistics for debugging.
	 */
	getStats() {
		return {
			entriesCount: this.cache.size,
			firstTimestamp: this.firstTimestamp,
			lastTimestamp: this.lastTimestamp,
			totalRecords: Array.from(this.cache.values()).reduce(
				(sum, records) => sum + records.length,
				0,
			),
		};
	}
}
