import dayjs from "dayjs";
import type * as THREE from "three";
import { Train } from "@/components/Train";
import type { TrainPosition } from "@/models";
import { vectorizeXY } from "@/utils";
import type { GameClock } from "./GameClock";
import type { TrainCache } from "./TrainCache";

// Amount of seconds after train with no updates will be removed
const DESTROY_TRAIN_AFTER_SECONDS = 60;

export class TrainManager {
	private scene: THREE.Scene;
	private trainsByID: Map<number, Train> = new Map();
	private trainTypes: Map<number, string> = new Map();
	private isPlaying: boolean = false;
	private gameClock: GameClock;
	private trainCache: TrainCache;
	private animationEndTime: dayjs.Dayjs = dayjs();
	status: string = "stopped";

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
	 */
	async newAnimation(
		startTime: dayjs.Dayjs,
		endTime: dayjs.Dayjs,
	): Promise<void> {
		this.animationEndTime = endTime;
		this.status = "loading";
		await this.trainCache.ensureRangeLoaded(startTime, endTime);
		this.trainTypes = await this.trainCache.dataProvider.getTrainTypes();

		// TODO destroy all trains here?
		const timestamp = dayjs(startTime);
		this.onGameClockUpdate(timestamp); // Initialize trains based on first timestamp's data
		this.gameClock.setTimestamp(timestamp); // Reset game clock so animation starts from the beginning of the preloaded data
		this.gameClock.start(); // Start the game clock to begin the animation
		this.isPlaying = true;
		this.status = "playing";
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		if (!this.isPlaying) return;

		this.trainsByID.forEach((train) => {
			train.update(deltaTime, speedFactor);
		});
	}

	getTrainCount(): number {
		return this.trainsByID.size;
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
			this.status = "stopped";

			console.log("Animation ended");
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
		const train = new Train(
			position,
			this.trainTypes.get(id) ?? "Unknown",
			timestamp,
		);
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
				train.destroy();
				this.trainsByID.delete(id);
				console.debug(`Train ${id} destroyed due to inactivity`);
			}
		});
	}
}
