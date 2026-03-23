import type dayjs from "dayjs";
import type * as THREE from "three";
import { Train } from "@/components/Train";
import { getRandomPosition } from "@/utils";
import type { GameClock } from "./GameClock";

const speedFactor = 0.1;

export class TrainManager {
	scene: THREE.Scene;
	trains: Train[] = [];
	isPlaying: boolean = true;
	gameClock: GameClock;

	constructor(scene: THREE.Scene, gameClock: GameClock) {
		this.scene = scene;
		this.gameClock = gameClock;
		this.gameClock.addEventListener((timestamp) =>
			this.updateTargets(timestamp),
		);
		this.loadSampleData(); // Replace with your data loading logic
	}

	loadSampleData() {
		// Generate 10 sample trains for testing
		for (let i = 0; i < 10; i++) {
			const train = new Train(
				getRandomPosition(),
				0xff0000 + Math.random() * 0xffffff,
			);
			train.updateTarget(getRandomPosition());
			this.scene.add(train.mesh);
			this.trains.push(train);
		}
	}

	update(deltaTime: number) {
		if (!this.isPlaying) return;

		this.trains.forEach((train) => {
			train.updatePosition(deltaTime * speedFactor);
		});
	}

	updateTargets(_timestamp: dayjs.Dayjs) {
		// TODO get data from provider based on given timestamp and update train targets accordingly
		this.trains.forEach((train) => {
			train.updateTarget(getRandomPosition());
		});
	}
}
