import * as THREE from "three";
import { SCENE_BACKGROUND_COLOR } from "./RendererSetup";

// Gentle exponential fog: barely visible from the top-down view, but gives
// depth haze during tilted camera tours.
const FOG_DENSITY = 0.0009;

// Soft glow pool hovering over the center of the map, like moonlight
const GLOW_COLOR = "#3a4f9f";
const GLOW_OPACITY = 0.45;
const GLOW_SIZE_X = 430;
const GLOW_SIZE_Z = 300;

/**
 * Create a soft radial glow texture (white center fading to transparent).
 * Used for the atmosphere glow pool and the ambient particles.
 */
export function createGlowTexture(size: number = 128): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	if (context) {
		const half = size / 2;
		const gradient = context.createRadialGradient(
			half,
			half,
			0,
			half,
			half,
			half,
		);
		gradient.addColorStop(0, "rgba(255,255,255,1)");
		gradient.addColorStop(0.3, "rgba(255,255,255,0.5)");
		gradient.addColorStop(0.7, "rgba(255,255,255,0.12)");
		gradient.addColorStop(1, "rgba(255,255,255,0)");
		context.fillStyle = gradient;
		context.fillRect(0, 0, size, size);
	}
	return new THREE.CanvasTexture(canvas);
}

/**
 * Adds night-time atmosphere to the scene: depth fog and a large soft glow
 * hovering over the center of the map.
 * @returns the fog instance, so the debug GUI can tune its density.
 */
export function setupAtmosphere(scene: THREE.Scene): THREE.FogExp2 {
	const fog = new THREE.FogExp2(SCENE_BACKGROUND_COLOR, FOG_DENSITY);
	scene.fog = fog;

	const material = new THREE.MeshBasicMaterial({
		map: createGlowTexture(256),
		color: GLOW_COLOR,
		transparent: true,
		opacity: GLOW_OPACITY,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false, // always tint what's below, never get occluded
		fog: false,
	});
	const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
	glow.rotation.x = -Math.PI / 2;
	glow.position.set(0, 2, 0); // above the map so the additive glow tints it
	glow.scale.set(GLOW_SIZE_X, GLOW_SIZE_Z, 1);
	glow.renderOrder = 1; // draw right after the opaque map
	scene.add(glow);

	return fog;
}
