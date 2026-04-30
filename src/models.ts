/**
 * Status of train animation playback.
 */
export enum TrainAnimationStatus {
	STOPPED = "stopped",
	LOADING = "loading",
	PLAYING = "playing",
	ERROR = "error",
}

export interface TrainRecord {
	timestamp: string; // ISO formatted timestamp string from API
	id: number;
	x: number;
	y: number;
	speed: number;
	direction: number;
	accuracy: number;
	type: string;
}
/**
 * Optimized train position data for caching.
 * Contains only position and identity information; timestamp is the cache key.
 */

export interface TrainPosition {
	id: number;
	x: number;
	y: number;
}
