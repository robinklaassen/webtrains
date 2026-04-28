import * as THREE from "three";

/**
 * Creates and configures a Three.js scene with basic helpers.
 * This is a factory function that returns a configured scene ready for use.
 */
export function createScene(): THREE.Scene {
	const scene = new THREE.Scene();

	return scene;
}
