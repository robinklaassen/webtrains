/**
 * Train material types.
 */
export const TrainMaterial = {
	// intercity
	VIRM: "VIRM",
	DDZ: "DDZ",
	ICM: "ICM",
	ICNG: "ICNG",

	// sprinter
	SLT: "SLT",
	SNG: "SNG",
	FLIRT: "FLIRT",
	GTW: "GTW",
} as const;

export type TrainMaterial = (typeof TrainMaterial)[keyof typeof TrainMaterial];

/**
 * Status of train animation playback.
 */
export const TrainAnimationStatus = {
	STOPPED: "stopped",
	LOADING: "loading",
	PLAYING: "playing",
	ERROR: "error",
} as const;

export type TrainAnimationStatus =
	(typeof TrainAnimationStatus)[keyof typeof TrainAnimationStatus];

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
