import * as THREE from "three";

interface LightConfig {
	ambientIntensity: number;
	directionalIntensity: number;
	directionalPosition: [number, number, number];
}

const DEFAULT_CONFIG: LightConfig = {
	ambientIntensity: 0x404040,
	directionalIntensity: 1,
	directionalPosition: [-150, 150, -150],
};

/**
 * Sets up all lighting in the scene.
 * Includes ambient lighting and directional lighting from the top-left corner.
 */
export function setupLighting(
	scene: THREE.Scene,
	config: Partial<LightConfig> = {},
): void {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	// Ambient light provides overall illumination
	const ambientLight = new THREE.AmbientLight(finalConfig.ambientIntensity);
	scene.add(ambientLight);

	// Directional light provides directional shadows and highlights
	const directionalLight = new THREE.DirectionalLight(
		0xffffff,
		finalConfig.directionalIntensity,
	);
	directionalLight.position.set(...finalConfig.directionalPosition);
	scene.add(directionalLight);
}
