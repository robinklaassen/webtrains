import type * as THREE from "three";
import { Train } from "@/components/Train";
import { getRandomPosition } from "@/utils";

const speedFactor = 0.1;

export class TrainManager {
	scene: THREE.Scene;
	trains: Train[] = [];
	isPlaying: boolean = true;

	constructor(scene: THREE.Scene) {
		this.scene = scene;
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

		// TODO give them new targets at some point, maybe when they reach their current target?

		this.trains.forEach((train) => {
			train.updatePosition(deltaTime * speedFactor);
		});
	}
}
