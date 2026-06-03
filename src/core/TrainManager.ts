import dayjs from "dayjs";
import type * as THREE from "three";
import { Train } from "@/components/Train";
import type { TrainPosition } from "@/models";
import { TrainAnimationStatus, TrainMaterial } from "@/models";
import { vectorizeXY } from "@/utils";
import type { GameClock } from "./GameClock";
import type { TrainCache } from "./TrainCache";

// Amount of 'in-game' seconds after train with no updates will be removed
const DESTROY_TRAIN_AFTER_SECONDS = 120;

// Delay in milliseconds between loop animations
const LOOP_DELAY_MS = 500000; // testing

// Three.js layer assignment for train materials.
// Layer 0 is reserved for default objects; material layers start at 1.
const MATERIAL_LAYER_OFFSET = 1;

export class TrainManager {
	private scene: THREE.Scene;
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
	status: TrainAnimationStatus = TrainAnimationStatus.STOPPED;

	constructor(scene: THREE.Scene, gameClock: GameClock, cache: TrainCache) {
		this.scene = scene;
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
			this.startAnimationFromTimestamp(startTime);
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
	 * Start the animation from the given timestamp.
	 * @param startTime - The timestamp to start animation from
	 */
	private startAnimationFromTimestamp(startTime: dayjs.Dayjs): void {
		this.destroyAllTrains();

		const timestamp = dayjs(startTime);
		this.onGameClockUpdate(timestamp); // Initialize trains based on first timestamp's data
		this.gameClock.resetTimestamp(timestamp); // Reset game clock so animation starts from the beginning of the preloaded data
		this.gameClock.start(); // Start the game clock to begin the animation
		this.isPlaying = true;
		this.status = TrainAnimationStatus.PLAYING;
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		if (!this.isPlaying) return;

		this.trainsByID.forEach((train) => {
			train.update(deltaTime, speedFactor);
		});
	}

	// Get the amount of currently active trains in the scene, for display/debugging purposes
	getTrainCount(): number {
		return this.trainsByID.size;
	}

	/**
	 * Toggle the visibility of trains with a specific material.
	 * Uses Three.js layers for efficient rendering control.
	 * @param material - The train material to toggle
	 */
	toggleMaterialVisibility(material: TrainMaterial): void {
		if (this.hiddenMaterials.has(material)) {
			this.hiddenMaterials.delete(material);
		} else {
			this.hiddenMaterials.add(material);
		}

		// Update all trains' layer visibility based on hidden materials
		this.trainsByID.forEach((train) => {
			const layerIndex = this.getMaterialLayer(train.material);
			const isHidden = this.hiddenMaterials.has(train.material);
			if (isHidden) {
				train.mesh.layers.disable(layerIndex);
			} else {
				train.mesh.layers.enable(layerIndex);
			}
		});
	}

	/**
	 * Get the set of currently hidden materials.
	 */
	getHiddenMaterials(): Set<TrainMaterial> {
		return this.hiddenMaterials;
	}

	/**
	 * Map a train material to a Three.js layer index.
	 * Layer 0 is reserved for default objects; material layers start at MATERIAL_LAYER_OFFSET.
	 */
	private getMaterialLayer(material: TrainMaterial): number {
		const materials = Object.values(TrainMaterial);
		const index = materials.indexOf(material as TrainMaterial);
		return index >= 0 ? index + MATERIAL_LAYER_OFFSET : MATERIAL_LAYER_OFFSET;
	}

	/**
	 * Get all Three.js layer indices required for rendering train materials.
	 * Used to configure camera and renderer for material visibility toggling.
	 * @returns Array of layer indices [1, 2, 3, ..., N] where N is the number of materials
	 */
	static getRequiredLayers(): number[] {
		const materialCount = Object.keys(TrainMaterial).length;
		return Array.from(
			{ length: materialCount },
			(_, i) => i + MATERIAL_LAYER_OFFSET,
		);
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
			this.status = TrainAnimationStatus.STOPPED;

			if (this.shouldLoop && this.animationStartTime) {
				console.log("Animation ended, restarting (loop enabled)");
				void this.newAnimation(this.animationStartTime, this.animationEndTime, {
					loop: true,
					delay: LOOP_DELAY_MS,
				});
			} else {
				console.log("Animation ended");
			}
			return;
		}

		const trainData = this.trainCache.getTrainsAtTimestamp(timestamp);
		console.debug(
			`Timestamp is ${timestamp.format("YYYY-MM-DD HH:mm:ss")}, with ${trainData.length} train positions`,
		);

		this.updateTrainTargets(trainData, timestamp);
		this.destroyInactiveTrains(timestamp);

		// TODO add slowdown effect near end of animation by changing game clock speed
	}

	private updateTrainTargets(
		trainData: TrainPosition[],
		timestamp: dayjs.Dayjs,
	) {
		trainData.forEach((position: TrainPosition) => {
			const positionVector = vectorizeXY(position.x, position.y);

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

		// Assign layer based on material
		const layerIndex = this.getMaterialLayer(train.material);
		train.mesh.layers.set(layerIndex);

		// If material is currently hidden, disable the layer
		if (this.hiddenMaterials.has(train.material)) {
			train.mesh.layers.disable(layerIndex);
		}

		this.scene.add(train.mesh);
		this.trainsByID.set(id, train);
		return train;
	}

	private destroyInactiveTrains(timestamp: dayjs.Dayjs) {
		this.trainsByID.forEach((train, id) => {
			if (
				timestamp.diff(train.lastUpdateTimestamp, "second") >=
				DESTROY_TRAIN_AFTER_SECONDS
			) {
				this.scene.remove(train.mesh);
				this.trainsByID.delete(id);
				console.debug(`Train ${id} destroyed due to inactivity`);
			}
		});
	}

	private destroyAllTrains() {
		this.trainsByID.forEach((train) => {
			this.scene.remove(train.mesh);
		});
		this.trainsByID.clear();
	}
}
