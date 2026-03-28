import * as THREE from "three";

export function getRandomPosition(): THREE.Vector3 {
	const x = (Math.random() - 0.5) * 4;
	const z = (Math.random() - 0.5) * 4;
	return new THREE.Vector3(x, 0, z); // using y as height is engine convention
}

// Convert the RDS coordinates from API to an ingame vector
export function vectorizeXY(x: number, y: number): THREE.Vector3 {
	return new THREE.Vector3(x, 0, y) // using y as height is engine convention
		.divideScalar(1000) // RDS coordinates to kilometers
		.sub(new THREE.Vector3(155, 0, 463)); // center on Amersfoort
}
