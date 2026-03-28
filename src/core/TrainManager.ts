import dayjs from "dayjs";
import type * as THREE from "three";
import { Train } from "@/components/Train";
import type { TrainPosition } from "@/models";
import { vectorizeXY } from "@/utils";
import type { GameClock } from "./GameClock";
import type { TrainCache } from "./TrainCache";

export class TrainManager {
	scene: THREE.Scene;
	trainsByID: Map<number, Train> = new Map();
	isPlaying: boolean = false;
	gameClock: GameClock;
	cache: TrainCache;
	animationEndTime: dayjs.Dayjs = dayjs();

	constructor(scene: THREE.Scene, gameClock: GameClock, cache: TrainCache) {
		this.scene = scene;
		this.gameClock = gameClock;
		this.cache = cache;
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
		await this.cache.ensureRangeLoaded(startTime, endTime);

		const timestamp = dayjs(startTime);
		this.onGameClockUpdate(timestamp); // Initialize trains based on first timestamp's data
		this.gameClock.setTimestamp(timestamp); // Reset game clock so animation starts from the beginning of the preloaded data
		this.gameClock.start(); // Start the game clock to begin the animation
		this.isPlaying = true;
	}

	// Updates every frame from the render loop
	update(deltaTime: number) {
		if (!this.isPlaying) return;

		this.trainsByID.forEach((train) => {
			train.updatePosition(deltaTime);
		});
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
			console.log("Animation ended");
			return;
		}

		const trainData = this.cache.getTrainsAtTimestamp(timestamp);
		console.debug(
			`Timestamp is ${timestamp.format("YYYY-MM-DD HH:mm:ss")}, with ${trainData.length} train positions`,
		);

		this.updateTrainTargets(trainData);
	}

	private updateTrainTargets(trainData: TrainPosition[]) {
		trainData.forEach((position: TrainPosition) => {
			const positionVector = vectorizeXY(position.x, position.y);

			// if the train does not exist yet, create it and add to scene
			if (!this.trainsByID.has(position.id)) {
				this.createTrain(position.id, positionVector);
				return;
			}

			// if the train does exist, update its target position
			const train = this.trainsByID.get(position.id);
			train?.updateTarget(positionVector);

			// TODO handle train removals
		});
	}

	private createTrain(id: number, position: THREE.Vector3): Train {
		const train = new Train(position, 0xff0000 + Math.random() * 0xffffff);
		this.scene.add(train.mesh);
		this.trainsByID.set(id, train);
		return train;
	}
}
