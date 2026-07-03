import dayjs from "dayjs";
import * as THREE from "three";
import { Train } from "@/components/Train";
import type { TrainEffects } from "@/components/TrainEffects";
import { TrainInstances } from "@/components/TrainInstances";
import type { TrainParticles } from "@/components/TrainParticles";
import type { TrainPosition } from "@/models";
import { TrainAnimationStatus, TrainMaterial } from "@/models";
import { vectorizeXY } from "@/utils";
import type { GameClock } from "./GameClock";
import type { TrainCache } from "./TrainCache";

// Amount of 'in-game' seconds after train with no updates will be removed
const DESTROY_TRAIN_AFTER_SECONDS = 120;

// End-of-animation outro timeline (real seconds). A single slow camera glide
// spans the whole outro (see main.ts) for a smooth finish.
const OUTRO_FADE_SECONDS = 2; // trains fade out over this, leaving their trails
const OUTRO_LIFT_AT_SECONDS = 5; // trails lift into the sky and the clock rewinds
const OUTRO_DURATION_SECONDS = 7; // the outro ends and the next animation begins

// Scratch vector for converting API coordinates without allocating per train
const _position = new THREE.Vector3();

export class TrainManager {
	private instances: TrainInstances;
	private effects: TrainEffects;
	private particles: TrainParticles;
	private trainsByID: Map<number, Train> = new Map();
	private trainTypes: Map<number, string> = new Map();
	private trainMaterials: Map<number, string> = new Map();
	private isPlaying: boolean = false;
	private gameClock: GameClock;
	private trainCache: TrainCache;
	private animationStartTime: dayjs.Dayjs = dayjs();
	private animationEndTime: dayjs.Dayjs = dayjs();
	private shouldLoop: boolean = false;
	private hiddenMaterials: Set<TrainMaterial> = new Set();
	// Suppresses spawn beams for the first populated tick of an animation, so the
	// initial mass of trains appears without an overwhelming wave of effects.
	private suppressEffects: boolean = false;
	// Real seconds elapsed in the end-of-animation outro, or null when not in it.
	private outroElapsedSeconds: number | null = null;
	// One-shot guard for the outro's lift/rewind event.
	private outroLifted: boolean = false;
	status: TrainAnimationStatus = TrainAnimationStatus.STOPPED;

	// Fired once when the outro begins, with the duration the camera glide should
	// take. The host (main.ts) moves the camera to the outro shot.
	onOutroCameraMove?: (durationSeconds: number) => void;

	constructor(
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera,
		gameClock: GameClock,
		cache: TrainCache,
		effects: TrainEffects,
		particles: TrainParticles,
	) {
		this.instances = new TrainInstances(scene, camera);
		this.effects = effects;
		this.particles = particles;
		this.gameClock = gameClock;
		this.trainCache = cache;
		this.gameClock.addEventListener((timestamp) =>
			this.onGameClockUpdate(timestamp),
		);
	}

	/**
	 * Start a new animation for the trains!
	 * @param startTime - dayjs timestamp to start from
	 * @param endTime - dayjs timestamp to end at
	 * @param options - Optional configuration: loop (whether to restart after end), delay (milliseconds to wait before loading)
	 */
	async newAnimation(
		startTime: dayjs.Dayjs,
		endTime: dayjs.Dayjs,
		options?: { loop?: boolean; delay?: number },
	): Promise<void> {
		this.animationStartTime = startTime;
		this.animationEndTime = endTime;
		this.shouldLoop = options?.loop ?? false;
		this.status = TrainAnimationStatus.LOADING;

		if (options?.delay) {
			// Create a delay promise
			const delayPromise = new Promise<void>((resolve) =>
				setTimeout(() => resolve(), options.delay),
			);

			// Create a loading promise
			const loadingPromise = this.loadAnimationData(startTime, endTime);

			// Wait for both delay and loading to complete
			await Promise.all([delayPromise, loadingPromise]);
		} else {
			await this.loadAnimationData(startTime, endTime);
		}

		if (this.status === TrainAnimationStatus.LOADING) {
			this.startAnimationFromTimestamp();
		}
	}

	/**
	 * Load animation data (train types and materials) from cache and data provider.
	 * Sets error status and cleans up trains if loading fails.
	 * @param startTime - Animation start time
	 * @param endTime - Animation end time
	 */
	private async loadAnimationData(
		startTime: dayjs.Dayjs,
		endTime: dayjs.Dayjs,
	): Promise<void> {
		try {
			await this.trainCache.ensureRangeLoaded(startTime, endTime);
			this.trainTypes = await this.trainCache.dataProvider.getTrainTypes(
				startTime.toISOString(),
				endTime.toISOString(),
			);
			this.trainMaterials =
				await this.trainCache.dataProvider.getTrainMaterials(
					startTime.toISOString(),
					endTime.toISOString(),
				);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.status = TrainAnimationStatus.ERROR;
			console.error(`[TrainManager] Animation failed: ${errorMessage}`, error);
			this.destroyAllTrains();
		}
	}

	/**
	 * Start the animation from animationStartTime (set by newAnimation).
	 */
	private startAnimationFromTimestamp(): void {
		this.resetToStart();
		this.beginPlayback();
	}

	/**
	 * Clear the world and rewind the clock to the animation's start, without
	 * starting playback: lift any lingering particles into the sky, restore the
	 * train fade, remove the trains, and reset the clock display to the start.
	 */
	private resetToStart(): void {
		this.particles.liftOff();
		this.instances.setFade(1);
		this.destroyAllTrains();
		this.gameClock.resetTimestamp(this.animationStartTime);
	}

	/**
	 * Begin playback from the current (start) timestamp. The first populated
	 * tick is kept silent so the initial wave of trains has no spawn beams.
	 */
	private beginPlayback(): void {
		this.suppressEffects = true;
		this.gameClock.start();
		this.isPlaying = true;
		this.status = TrainAnimationStatus.PLAYING;
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		if (this.outroElapsedSeconds !== null) {
			this.updateOutro(deltaTime);
			return;
		}
		if (!this.isPlaying) return;

		this.trainsByID.forEach((train) => {
			train.update(deltaTime, speedFactor);
			// Hidden materials leave no trail.
			if (this.isMaterialVisible(train.material)) {
				this.particles.emitTrail(train);
			}
		});
		this.instances.updateMatrices(deltaTime);
	}

	/**
	 * Begin the end-of-animation outro. See updateOutro for the timeline; the
	 * camera glide is delegated to onOutroCameraMove (see main.ts).
	 */
	private beginOutro(): void {
		if (this.outroElapsedSeconds !== null) return;
		this.outroElapsedSeconds = 0;
		this.outroLifted = false;
		this.onOutroCameraMove?.(OUTRO_DURATION_SECONDS);
	}

	/**
	 * Advance the outro timeline (real seconds from the end of the animation):
	 *   0 - OUTRO_FADE_SECONDS:  trains fade out, leaving their trails
	 *   OUTRO_LIFT_AT_SECONDS:   trails lift into the sky, the clock rewinds
	 *   OUTRO_DURATION_SECONDS:  the next animation begins
	 */
	private updateOutro(deltaTime: number): void {
		if (this.outroElapsedSeconds === null) return;
		this.outroElapsedSeconds += deltaTime;
		const elapsed = this.outroElapsedSeconds;

		// Fade the trains out (smoothstep for a gentle ramp); their trails remain.
		if (elapsed <= OUTRO_FADE_SECONDS) {
			const t = elapsed / OUTRO_FADE_SECONDS;
			const eased = t * t * (3 - 2 * t);
			this.instances.setFade(1 - eased);
		}
		this.instances.updateMatrices(deltaTime);

		// Lift the trails into the sky and rewind the clock to the start.
		if (!this.outroLifted && elapsed >= OUTRO_LIFT_AT_SECONDS) {
			this.outroLifted = true;
			if (this.shouldLoop) {
				this.resetToStart();
			} else {
				this.particles.liftOff();
			}
		}

		// The outro is over; begin the next animation (or stop).
		if (elapsed >= OUTRO_DURATION_SECONDS) {
			this.outroElapsedSeconds = null;
			if (this.shouldLoop) {
				this.beginPlayback();
			} else {
				this.status = TrainAnimationStatus.STOPPED;
			}
		}
	}

	// Get the amount of currently active trains in the scene, for display/debugging purposes
	getTrainCount(): number {
		return this.trainsByID.size;
	}

	/**
	 * Count active trains grouped by material, for the legend's per-material
	 * counts. All known materials are present in the result (0 when none).
	 */
	getCountsByMaterial(): Map<TrainMaterial, number> {
		const counts = new Map<TrainMaterial, number>();
		for (const material of Object.values(TrainMaterial)) {
			counts.set(material, 0);
		}
		this.trainsByID.forEach((train) => {
			counts.set(train.material, (counts.get(train.material) ?? 0) + 1);
		});
		return counts;
	}

	/**
	 * Toggle the visibility of trains with a specific material.
	 * Implements multi-select behavior:
	 * - If all materials are visible, clicking one hides all others (select only that one)
	 * - If some materials are visible, toggle the clicked material in/out
	 * - If no materials would be visible, show all trains instead
	 * Each material is one instanced mesh, so applying visibility is a single flag flip.
	 * @param material - The train material to toggle
	 */
	toggleMaterialVisibility(material: TrainMaterial): void {
		const allMaterials = this.getAllMaterials();
		const visibleMaterials = this.getVisibleMaterials();
		const visibleCount = visibleMaterials.size;
		const totalMaterials = allMaterials.length;

		// Case 1: All materials currently visible - select only the clicked one
		if (visibleCount === totalMaterials) {
			this.hiddenMaterials.clear();
			allMaterials.forEach((m) => {
				if (m !== material) {
					this.hiddenMaterials.add(m);
				}
			});
		} else {
			// Case 2: Some materials visible - toggle the clicked one
			if (this.hiddenMaterials.has(material)) {
				this.hiddenMaterials.delete(material);
			} else {
				this.hiddenMaterials.add(material);
			}

			// Case 3: If no materials would be left visible, show all
			const resultingVisibleCount = this.getVisibleMaterials().size;
			if (resultingVisibleCount === 0) {
				this.hiddenMaterials.clear();
			}
		}

		// Apply visibility to the per-material instanced meshes
		allMaterials.forEach((m) => {
			this.instances.setMaterialVisible(m, !this.hiddenMaterials.has(m));
		});
	}

	/**
	 * Get the set of currently visible materials.
	 */
	getVisibleMaterials(): Set<TrainMaterial> {
		const allMaterials = this.getAllMaterials();
		const visible = new Set<TrainMaterial>();
		allMaterials.forEach((material) => {
			if (!this.hiddenMaterials.has(material)) {
				visible.add(material);
			}
		});
		return visible;
	}

	/**	 * Check if a specific material is currently visible.
	 * @param material - The train material to check
	 * @returns true if the material trains are visible, false if hidden
	 */
	isMaterialVisible(material: TrainMaterial): boolean {
		return !this.hiddenMaterials.has(material);
	}

	/**	 * Get all available train materials.
	 */
	private getAllMaterials(): TrainMaterial[] {
		return Object.values(TrainMaterial);
	}

	/**
	 * Updates train targets based on actual train location data for the given timestamp.
	 * Fetches data from cache (extends if necessary via background request).
	 * @param timestamp - The current game timestamp
	 */
	private onGameClockUpdate(timestamp: dayjs.Dayjs): void {
		if (!this.isPlaying) return;

		if (timestamp.valueOf() >= this.animationEndTime.valueOf()) {
			this.gameClock.stop();
			this.isPlaying = false;
			this.beginOutro();
			return;
		}

		const trainData = this.trainCache.getTrainsAtTimestamp(timestamp);
		console.debug(
			`Timestamp is ${timestamp.format("YYYY-MM-DD HH:mm:ss")}, with ${trainData.length} train positions`,
		);

		this.updateTrainTargets(trainData, timestamp);
		this.destroyInactiveTrains(timestamp);

		// After the first populated tick, resume per-train spawn effects.
		this.suppressEffects = false;

		// TODO add slowdown effect near end of animation by changing game clock speed
	}

	private updateTrainTargets(
		trainData: TrainPosition[],
		timestamp: dayjs.Dayjs,
	) {
		trainData.forEach((position: TrainPosition) => {
			const positionVector = vectorizeXY(position.x, position.y, _position);

			// if the train does not exist yet, create it and add to scene
			if (!this.trainsByID.has(position.id)) {
				this.createTrain(position.id, positionVector, timestamp);
				return;
			}

			// if the train does exist, update its target position
			const train = this.trainsByID.get(position.id);
			train?.updateTarget(positionVector, timestamp);
		});
	}

	private createTrain(
		id: number,
		position: THREE.Vector3,
		timestamp: dayjs.Dayjs = dayjs(),
	): Train {
		const material = this.trainMaterials.get(id);
		if (!material) {
			console.log(
				`[TrainManager] Train ${id} has NO material in map. Map has ${this.trainMaterials.size} entries.`,
			);
		}
		const train = new Train(
			position,
			this.trainTypes.get(id) ?? "Unknown",
			material as TrainMaterial | undefined,
			timestamp,
		);

		this.instances.add(train);
		this.trainsByID.set(id, train);
		// Skip the beam during the bulk initial population (see suppressEffects),
		// and for hidden materials.
		if (!this.suppressEffects && this.isMaterialVisible(train.material)) {
			this.effects.trainAppeared(train);
		}
		return train;
	}

	private destroyInactiveTrains(timestamp: dayjs.Dayjs) {
		this.trainsByID.forEach((train, id) => {
			if (
				timestamp.diff(train.lastUpdateTimestamp, "second") >=
				DESTROY_TRAIN_AFTER_SECONDS
			) {
				this.instances.remove(train);
				this.trainsByID.delete(id);
				// Hidden materials despawn silently.
				if (this.isMaterialVisible(train.material)) {
					this.particles.despawn(train);
				}
				console.debug(`Train ${id} destroyed due to inactivity`);
			}
		});
	}

	private destroyAllTrains() {
		// Bulk teardown (start / restart / error): no poofs, that would be an
		// overwhelming mass effect. Individual despawns during play still poof.
		this.instances.clear();
		this.trainsByID.clear();
	}
}
