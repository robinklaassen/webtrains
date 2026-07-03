import dayjs from "dayjs";
import type * as THREE from "three";
import { TrainMaterial } from "../models";

// Speed (km/h) at and above which a train is treated as "full speed": full
// color vibrance and maximum size. Mutable at runtime so the GUI can tune it.
export const SPEED_NORMALIZATION = {
	maxSpeedKmh: 160,
};

// Speed-to-size mapping: faster trains are a bit bigger.
// Mutable at runtime so the debug GUI can tune it.
export const SPEED_SIZE_CONFIG = {
	minScale: 0.85, // size of a stopped train
	maxScale: 1.5, // size at full speed
};

// Speed-to-vibrance mapping: a stopped train is dimmed to minVibrance of its
// material color (so it barely glows), a full-speed train shows its full color.
// Mutable at runtime so the debug GUI can tune it.
export const SPEED_VIBRANCE_CONFIG = {
	minVibrance: 0.25,
};

// The position feed often carries a stale position forward when no fresh
// measurement arrived (~32% of samples), yielding a fake speed of 0 followed by
// a doubled speed once real data resumes. Speed is therefore measured from the
// last position that actually changed, which makes stale repeats resolve to the
// true average speed instead.
// Movements below this distance (in km) count as "unchanged" (GPS wobble of a
// stopped train is well below it per 10s sample).
const MIN_MOVEMENT_KM = 0.001;
// A position unchanged for longer than this (in-game seconds) means the train
// is genuinely stopped rather than missing data; its speed then decays to 0.
// Stale-data runs in the feed are nearly always 1-2 samples (10-30s).
const STOPPED_AFTER_SECONDS = 30;
// Raw speeds above this are data glitches (id reuse/teleports, observed up to
// 25000+ km/h); the new position is accepted but the speed sample is discarded.
const MAX_PLAUSIBLE_SPEED_KMH = 250;
// Time constant (in-game seconds) of the exponential moving average that
// smooths the remaining speed noise.
const SPEED_SMOOTHING_TAU_SECONDS = 30;

/**
 * Simulation state of a single train. Holds no Three.js objects: rendering is
 * done by TrainInstances, which draws all trains of a material as a single
 * instanced mesh using each train's position and scale.
 */
export class Train {
	type: string = "Unknown"; // TODO use enum for train types
	material: TrainMaterial = TrainMaterial.VIRM;

	// Rendered position, scale and color vibrance, consumed by TrainInstances
	// every frame. vibrance scales the material color [0..1] based on speed.
	position: THREE.Vector3;
	scale: number = 1;
	vibrance: number = 1;

	// Random phase offset so the glow pulse of each train is unsynchronized
	readonly pulsePhase: number = Math.random() * Math.PI * 2;

	// Last position where a trail particle was dropped; used by TrainParticles
	// to space trail emission along the rail.
	trailAnchor: THREE.Vector3;

	// Movement is done by interpolation between origin and target based on alpha factor [0, 1].
	origin: THREE.Vector3;
	target: THREE.Vector3;
	alpha: number = 0;

	// Smoothed horizontal speed in km/h, derived from received positions
	speedKmh: number = 0;

	// Anchor for speed measurement: the last received position that actually
	// differed from its predecessor, and the timestamp it was received at.
	private lastMovedPosition: THREE.Vector3;
	private lastMovedTimestamp: dayjs.Dayjs;

	// last ingame timestamp when this train received a new target position
	lastUpdateTimestamp: dayjs.Dayjs;

	constructor(
		position: THREE.Vector3,
		type: string,
		material: TrainMaterial | undefined,
		timestamp: dayjs.Dayjs = dayjs(),
	) {
		this.type = type;
		if (material) {
			this.material = material;
		}

		this.position = position.clone();
		this.origin = position.clone();
		this.target = position.clone();
		this.trailAnchor = position.clone();
		this.lastMovedPosition = position.clone();
		this.lastMovedTimestamp = timestamp;
		this.lastUpdateTimestamp = timestamp;
	}

	/**
	 * Set a new target position for the train. The train will move towards this target in the update loop of the TrainManager.
	 * The train's speed is derived from the distance to the previous target, and determines its size and color vibrance.
	 * @param newTarget - The new target position.
	 * @param timestamp - The timestamp for the target position.
	 */
	updateTarget(newTarget: THREE.Vector3, timestamp: dayjs.Dayjs) {
		this.updateSpeed(newTarget, timestamp);

		this.lastUpdateTimestamp = timestamp;
		// this.position.copy(newTarget); // temporarily removed smoothing animation
		this.origin.copy(this.position);
		this.target.copy(newTarget); // stays on the ground plane (y = 0)

		// Speed determines size and color vibrance (speedKmh is already smoothed,
		// so these change gradually)
		const normalized = Train.normalizedSpeed(this.speedKmh);
		this.scale =
			SPEED_SIZE_CONFIG.minScale +
			normalized * (SPEED_SIZE_CONFIG.maxScale - SPEED_SIZE_CONFIG.minScale);
		this.vibrance =
			SPEED_VIBRANCE_CONFIG.minVibrance +
			normalized * (1 - SPEED_VIBRANCE_CONFIG.minVibrance);

		this.alpha = 0;
	}

	/**
	 * Update the smoothed speed estimate from a newly received position.
	 * Stale repeated positions are not mistaken for stops: speed is measured
	 * against the last position that actually changed (see constants above).
	 */
	private updateSpeed(newPosition: THREE.Vector3, timestamp: dayjs.Dayjs) {
		const elapsedSeconds = timestamp.diff(this.lastMovedTimestamp, "second");
		if (elapsedSeconds <= 0) return;

		const dx = newPosition.x - this.lastMovedPosition.x;
		const dz = newPosition.z - this.lastMovedPosition.z;
		const distanceKm = Math.hypot(dx, dz);

		if (distanceKm < MIN_MOVEMENT_KM) {
			// Unchanged position: stale data (hold current speed) until it has
			// been frozen long enough to be a genuinely stopped train.
			if (elapsedSeconds > STOPPED_AFTER_SECONDS) {
				const sampleSeconds = timestamp.diff(
					this.lastUpdateTimestamp,
					"second",
				);
				this.speedKmh = Train.smooth(this.speedKmh, 0, sampleSeconds);
			}
			return;
		}

		this.lastMovedPosition.copy(newPosition);
		this.lastMovedTimestamp = timestamp;

		const rawSpeedKmh = (distanceKm / elapsedSeconds) * 3600;
		if (rawSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
			// Teleport glitch: accept the new position as anchor, discard the speed
			return;
		}
		this.speedKmh = Train.smooth(this.speedKmh, rawSpeedKmh, elapsedSeconds);
	}

	/**
	 * Exponential moving average step: move current towards target with a weight
	 * based on how much in-game time the new sample spans.
	 */
	private static smooth(
		current: number,
		target: number,
		elapsedSeconds: number,
	): number {
		const weight = 1 - Math.exp(-elapsedSeconds / SPEED_SMOOTHING_TAU_SECONDS);
		return current + (target - current) * weight;
	}

	/**
	 * Normalize a speed against the configured maximum: 0 at standstill,
	 * 1 at maxSpeedKmh and above. Drives both size and color vibrance.
	 */
	private static normalizedSpeed(speedKmh: number): number {
		const { maxSpeedKmh } = SPEED_NORMALIZATION;
		if (maxSpeedKmh <= 0) return 0;
		return Math.min(speedKmh / maxSpeedKmh, 1);
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		// delta is the ingame time passed since last frame divided by 10 seconds between every clock update timestamp
		const delta = (deltaTime * speedFactor) / 10;
		this.alpha += delta;
		this.alpha = Math.min(this.alpha, 1); // Clamp to [0, 1] to prevent extrapolation past target
		this.position.lerpVectors(this.origin, this.target, this.alpha);
	}
}
