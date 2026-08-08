import * as THREE from "three";
import { createGlowTexture } from "./Atmosphere";

// Number of ambient drifting glow particles
const PARTICLE_COUNT = 350;

// Bounds of the particle volume (scene units, roughly covering the map)
const BOUNDS_X = 200;
const BOUNDS_Z = 170;
const MIN_Y = 1;
const MAX_Y = 30;

// Horizontal drift speed range (units/second, real time)
const DRIFT_SPEED = 1.2;
// Vertical bobbing
const BOB_SPEED = 0.35;
const BOB_AMOUNT = 1.5;

const PARTICLE_SIZE = 1.7;
const PARTICLE_OPACITY = 0.8;

// Soft firefly palette: warm whites, pinks, cyans and mints
const PARTICLE_COLORS = [
	0xfff3c4, // warm white
	0xffd2e8, // soft pink
	0xff9bb0, // rose
	0x8fd8ff, // ice blue
	0xb7ffda, // mint
	0xf0e9ff, // pale lavender
];

/**
 * A field of slowly drifting, softly glowing particles above the map,
 * like fireflies / dust motes. One Points object = one draw call.
 */
export class AmbientParticles {
	private points: THREE.Points;
	private geometry: THREE.BufferGeometry;
	private positions: Float32Array;
	private velocities: Float32Array;
	private bobPhases: Float32Array;
	private baseY: Float32Array;

	constructor(scene: THREE.Scene) {
		this.positions = new Float32Array(PARTICLE_COUNT * 3);
		this.velocities = new Float32Array(PARTICLE_COUNT * 2); // x and z drift
		this.bobPhases = new Float32Array(PARTICLE_COUNT);
		this.baseY = new Float32Array(PARTICLE_COUNT);
		const colors = new Float32Array(PARTICLE_COUNT * 3);

		const color = new THREE.Color();
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			this.positions[i * 3] = (Math.random() * 2 - 1) * BOUNDS_X;
			this.baseY[i] = MIN_Y + Math.random() * (MAX_Y - MIN_Y);
			this.positions[i * 3 + 1] = this.baseY[i];
			this.positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOUNDS_Z;

			const angle = Math.random() * Math.PI * 2;
			const speed = (0.3 + Math.random() * 0.7) * DRIFT_SPEED;
			this.velocities[i * 2] = Math.cos(angle) * speed;
			this.velocities[i * 2 + 1] = Math.sin(angle) * speed;
			this.bobPhases[i] = Math.random() * Math.PI * 2;

			color.setHex(
				PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
			);
			colors[i * 3] = color.r;
			colors[i * 3 + 1] = color.g;
			colors[i * 3 + 2] = color.b;
		}

		this.geometry = new THREE.BufferGeometry();
		this.geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(this.positions, 3),
		);
		this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: PARTICLE_SIZE,
			map: createGlowTexture(64),
			transparent: true,
			opacity: PARTICLE_OPACITY,
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			sizeAttenuation: true,
		});

		this.points = new THREE.Points(this.geometry, material);
		this.points.frustumCulled = false;
		scene.add(this.points);
	}

	/**
	 * Drift the particles. Runs on real time (not game time) so the ambience
	 * keeps breathing even when the animation is paused.
	 * @param deltaTime - Real seconds since last frame.
	 * @param elapsedTime - Total real seconds since start.
	 */
	update(deltaTime: number, elapsedTime: number): void {
		// Nothing to animate while hidden (the field is off by default).
		if (!this.points.visible) return;

		const positions = this.positions;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			let x = positions[i * 3] + this.velocities[i * 2] * deltaTime;
			let z = positions[i * 3 + 2] + this.velocities[i * 2 + 1] * deltaTime;

			// Wrap around the bounds so the field stays filled
			if (x > BOUNDS_X) x = -BOUNDS_X;
			else if (x < -BOUNDS_X) x = BOUNDS_X;
			if (z > BOUNDS_Z) z = -BOUNDS_Z;
			else if (z < -BOUNDS_Z) z = BOUNDS_Z;

			positions[i * 3] = x;
			positions[i * 3 + 1] =
				this.baseY[i] +
				Math.sin(elapsedTime * BOB_SPEED + this.bobPhases[i]) * BOB_AMOUNT;
			positions[i * 3 + 2] = z;
		}
		this.geometry.attributes.position.needsUpdate = true;
	}

	setVisible(visible: boolean): void {
		this.points.visible = visible;
	}
}
