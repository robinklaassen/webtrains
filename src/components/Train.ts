import dayjs from "dayjs";
import * as THREE from "three";

const sphereRadius = 1;

const COLOR_Map: { [key: string]: number } = {
	SPR: 0xffff00, // yellow
	IC: 0x0000ff, // blue
	ARR: 0xff0000, // red
	Unknown: 0xffffff, // white
};

/**
 * Represents a train in the 3D scene.
 */
export class Train {
	mesh: THREE.Mesh;
	type: string = "Unknown"; // TODO use enum for train types

	// Movement is done by interpolation between origin and target based on alpha factor [0, 1].
	origin: THREE.Vector3;
	target: THREE.Vector3;
	alpha: number = 0;

	// last ingame timestamp when this train received a new target position
	lastUpdateTimestamp: dayjs.Dayjs;

	constructor(
		position: THREE.Vector3,
		type: string,
		timestamp: dayjs.Dayjs = dayjs(),
	) {
		// TODO use instanced mesh since the gemeotry is shared between all trains, and we can have many trains in the scene. This will require refactoring the TrainManager to manage a single InstancedMesh and update instance matrices instead of individual meshes.
		this.type = type;
		const geometry = new THREE.SphereGeometry(sphereRadius);
		const material = new THREE.MeshPhongMaterial({
			color: COLOR_Map[type] ?? 0xffffff,
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.copy(position);
		this.origin = position.clone();
		this.target = position.clone();
		this.lastUpdateTimestamp = timestamp;
	}

	/**
	 * Set a new target position for the train. The train will move towards this target in the update loop of the TrainManager.
	 * @param newTarget - The new target position.
	 * @param timestamp - The timestamp for the target position.
	 */
	updateTarget(newTarget: THREE.Vector3, timestamp: dayjs.Dayjs) {
		this.lastUpdateTimestamp = timestamp;
		// this.mesh.position.copy(newTarget); // temporarily removed smoothing animation
		this.origin.copy(this.mesh.position);
		this.target.copy(newTarget);
		this.alpha = 0;
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		// delta is the ingame time passed since last frame divided by 10 seconds between every clock update timestamp
		const delta = (deltaTime * speedFactor) / 10;
		this.alpha += delta;
		this.alpha = Math.min(this.alpha, 1); // Clamp to [0, 1] to prevent extrapolation past target
		this.mesh.position.lerpVectors(this.origin, this.target, this.alpha);
	}

	/**
	 * Clean up resources used by this train. Should be called when the train is removed from the scene to prevent memory leaks.
	 */
	destroy() {
		this.mesh.geometry.dispose();
		if (Array.isArray(this.mesh.material)) {
			this.mesh.material.forEach((material) => void material.dispose());
		} else {
			this.mesh.material.dispose();
		}
	}
}
