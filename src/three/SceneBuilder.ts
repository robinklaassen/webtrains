import * as THREE from "three";

/**
 * Creates and configures a Three.js scene with basic helpers.
 * This is a factory function that returns a configured scene ready for use.
 */
export function createScene(): THREE.Scene {
	const scene = new THREE.Scene();

	// Add debug helpers to visualize the scene
	const gridHelper = new THREE.GridHelper(300, 60, 0x444444, 0x222222);
	scene.add(gridHelper);

	// Uncomment to add axes helper for debugging
	// const axesHelper = new THREE.AxesHelper(150);
	// scene.add(axesHelper);

	return scene;
}
