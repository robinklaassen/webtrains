import * as THREE from "three";

export function getRandomPosition(): THREE.Vector3 {
	const x = (Math.random() - 0.5) * 4;
	const z = (Math.random() - 0.5) * 4;
	return new THREE.Vector3(x, 0, z); // using y as height is engine convention
}
