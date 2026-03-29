import * as THREE from "three";

interface CameraConfig {
	fov: number;
	near: number;
	far: number;
	position: [number, number, number];
	lookAt: [number, number, number];
}

const DEFAULT_CONFIG: CameraConfig = {
	fov: 75,
	near: 0.1,
	far: 10000,
	position: [0, 150, 0],
	lookAt: [0, 0, 0],
};

/**
 * Creates and configures a Three.js perspective camera.
 * Positions the camera to view the Dutch train region (Rijksdriehoek coordinates).
 */
export function createCamera(
	config: Partial<CameraConfig> = {},
): THREE.PerspectiveCamera {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	const camera = new THREE.PerspectiveCamera(
		finalConfig.fov,
		window.innerWidth / window.innerHeight,
		finalConfig.near,
		finalConfig.far,
	);

	camera.position.set(...finalConfig.position);
	camera.lookAt(...finalConfig.lookAt);

	return camera;
}
