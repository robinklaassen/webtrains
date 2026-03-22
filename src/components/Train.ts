import * as THREE from "three";

const sphereRadius = 0.1;

/**
 * Represents a train in the 3D scene. Each train has a mesh (a sphere) and a target position it moves towards. The Train class provides a method to update the train's position based on new coordinates.
 */
export class Train {
	mesh: THREE.Mesh;
	origin: THREE.Vector3;
	target: THREE.Vector3;
	alpha: number = 0; // [0, 1] interpolation factor for movement between origin and target

	constructor(position: THREE.Vector3, color: number = 0xffffff) {
		const geometry = new THREE.SphereGeometry(sphereRadius);
		const material = new THREE.MeshPhongMaterial({ color });
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.copy(position);
		this.origin = position.clone();
		this.target = position.clone();
	}

	/**
	 * Set a new target position for the train. The train will move towards this target in the update loop of the TrainManager.
	 * @param newTarget - The new target position.
	 */
	updateTarget(newTarget: THREE.Vector3) {
		this.origin.copy(this.mesh.position);
		this.target.copy(newTarget);
		this.alpha = 0;
	}

	/**
	 * Update the train's position based on the interpolation factor.
	 * @param delta interpolation factor, will be added to this train's alpha
	 */
	updatePosition(delta: number) {
		this.alpha += delta;
		this.alpha = Math.min(this.alpha, 1); // Clamp to [0, 1] to prevent extrapolation past target
		this.mesh.position.lerpVectors(this.origin, this.target, this.alpha);
	}
}
