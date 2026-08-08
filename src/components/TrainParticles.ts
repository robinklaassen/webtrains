import * as THREE from "three";
import { createGlowTexture } from "../three/Atmosphere";
import type { Train } from "./Train";
import {
	DEFAULT_COLOR,
	GROUND_CLEARANCE,
	MATERIAL_COLOR_MAP,
	screenScaleFactor,
} from "./TrainInstances";

// Ring buffer capacity. Dead particles are simply drawn black (invisible under
// additive blending), so the whole buffer is always one draw call. Sized
// generously so dense ("golden ribbon") trails are not truncated; once full the
// oldest particles are recycled.
const MAX_PARTICLES = 20000;
const PARTICLE_OPACITY = 0.9;

// Particles move at a constant velocity for their whole life (no damping), so a
// trail particle keeps slowly hovering in its random direction instead of
// shooting to a spot and stopping.

// Despawn / lift-off effect: particles shoot upward and rise into the sky as
// they fade.
const DESPAWN_COUNT = 5;
const DESPAWN_UP_SPEED = 12; // upward launch speed
const DESPAWN_SPREAD = 0.4; // small horizontal scatter at launch

/**
 * Despawn settings, mutated live by the debug GUI.
 */
export const DESPAWN_CONFIG = {
	enabled: true,
};

/**
 * Tunable trail/despawn parameters, mutated live by the debug GUI.
 */
export const TRAIL_CONFIG = {
	enabled: true,
	// Scene units of travel between emitted trail particles. Higher = sparser;
	// drop it low for a dense, continuous "golden ribbon" trail.
	spacing: 4.0,
	// Horizontal drift speed of trail particles (0 = they stay put horizontally).
	spreadSpeed: 0.1,
	// Seconds a particle lives before fading out (trail and despawn).
	lifespan: 12.0,
	// Point size of trail/despawn particles.
	size: 2.8,
};

const _color = new THREE.Color();

/**
 * Particles emitted by the trains themselves: a colored trail dropped along the
 * rails that slowly drifts outward, plus an upward burst when a train disappears
 * that rises into the sky and dissipates. One Points object = one draw call.
 */
export class TrainParticles {
	private geometry: THREE.BufferGeometry;
	private positions: Float32Array;
	private colors: Float32Array; // displayed color = baseColor * alpha
	private baseColors: Float32Array;
	private velocities: Float32Array;
	private ages: Float32Array;
	private lifetimes: Float32Array;
	private head: number = 0;
	private points: THREE.Points;
	private material: THREE.PointsMaterial;
	private camera: THREE.PerspectiveCamera;

	constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
		this.camera = camera;
		this.positions = new Float32Array(MAX_PARTICLES * 3);
		this.colors = new Float32Array(MAX_PARTICLES * 3);
		this.baseColors = new Float32Array(MAX_PARTICLES * 3);
		this.velocities = new Float32Array(MAX_PARTICLES * 3);
		this.ages = new Float32Array(MAX_PARTICLES);
		this.lifetimes = new Float32Array(MAX_PARTICLES);
		// Start every particle dead (age >= lifetime); colors default to 0 (black).
		this.ages.fill(1);
		this.lifetimes.fill(0.0001);

		this.geometry = new THREE.BufferGeometry();
		this.geometry.setAttribute(
			"position",
			new THREE.BufferAttribute(this.positions, 3),
		);
		this.geometry.setAttribute(
			"color",
			new THREE.BufferAttribute(this.colors, 3),
		);

		this.material = new THREE.PointsMaterial({
			size: TRAIL_CONFIG.size,
			map: createGlowTexture(64),
			transparent: true,
			opacity: PARTICLE_OPACITY,
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			sizeAttenuation: true,
		});

		this.points = new THREE.Points(this.geometry, this.material);
		this.points.frustumCulled = false;
		scene.add(this.points);
	}

	private emit(
		x: number,
		y: number,
		z: number,
		hex: number,
		vx: number,
		vy: number,
		vz: number,
		lifetime: number,
	): void {
		const i = this.head;
		this.head = (this.head + 1) % MAX_PARTICLES;

		this.positions[i * 3] = x;
		this.positions[i * 3 + 1] = y;
		this.positions[i * 3 + 2] = z;

		_color.setHex(hex);
		this.baseColors[i * 3] = _color.r;
		this.baseColors[i * 3 + 1] = _color.g;
		this.baseColors[i * 3 + 2] = _color.b;

		this.velocities[i * 3] = vx;
		this.velocities[i * 3 + 1] = vy;
		this.velocities[i * 3 + 2] = vz;

		this.ages[i] = 0;
		this.lifetimes[i] = lifetime;
	}

	/**
	 * Drop a trail particle if the train has travelled far enough since the last
	 * one. Particles are emitted right where the train is and given a slow,
	 * constant drift in a random direction, so they hover away from that spot
	 * over their lifetime rather than darting to a fixed point.
	 */
	emitTrail(train: Train): void {
		if (!TRAIL_CONFIG.enabled || TRAIL_CONFIG.spacing <= 0) return;

		const distance = train.position.distanceTo(train.trailAnchor);
		if (distance < TRAIL_CONFIG.spacing) return;
		train.trailAnchor.copy(train.position);

		const hex = MATERIAL_COLOR_MAP[train.material] ?? DEFAULT_COLOR;
		const angle = Math.random() * Math.PI * 2;
		const horizontal = TRAIL_CONFIG.spreadSpeed * (0.5 + Math.random() * 0.5);
		this.emit(
			train.position.x,
			// Lift to the trains' render height so trails sit level with them.
			train.position.y + GROUND_CLEARANCE,
			train.position.z,
			hex,
			Math.cos(angle) * horizontal,
			0,
			Math.sin(angle) * horizontal,
			TRAIL_CONFIG.lifespan,
		);
	}

	/**
	 * When a train disappears, send up a burst of its-color particles that shoot
	 * into the sky and slowly dissipate (vertical velocity is undamped).
	 */
	despawn(train: Train): void {
		if (!DESPAWN_CONFIG.enabled) return;
		const hex = MATERIAL_COLOR_MAP[train.material] ?? DEFAULT_COLOR;
		for (let k = 0; k < DESPAWN_COUNT; k++) {
			const angle = Math.random() * Math.PI * 2;
			const scatter = Math.random() * DESPAWN_SPREAD;
			this.emit(
				train.position.x,
				train.position.y,
				train.position.z,
				hex,
				Math.cos(angle) * scatter,
				DESPAWN_UP_SPEED * (0.7 + Math.random() * 0.6),
				Math.sin(angle) * scatter,
				TRAIL_CONFIG.lifespan * (0.7 + Math.random() * 0.5),
			);
		}
	}

	/**
	 * Send every currently-alive particle up into the sky to dissipate. Called on
	 * animation reset so the whole field lifts off gracefully instead of lingering
	 * or vanishing abruptly. Particles keep their remaining lifetime, so they fade
	 * as they rise.
	 */
	liftOff(): void {
		for (let i = 0; i < MAX_PARTICLES; i++) {
			if (this.ages[i] >= this.lifetimes[i]) continue; // already dead
			this.velocities[i * 3] *= 0.2; // mostly cancel horizontal drift
			this.velocities[i * 3 + 1] =
				DESPAWN_UP_SPEED * (0.6 + Math.random() * 0.5);
			this.velocities[i * 3 + 2] *= 0.2;
		}
	}

	/**
	 * Advance all particles. Runs on real time so trails and poofs animate at a
	 * readable pace regardless of the game clock speed.
	 */
	update(deltaTime: number): void {
		// Scale the whole trail field by camera distance/zoom, matching the
		// trains. Points share one size, so this is a single global factor (from
		// the scene centre) rather than per-particle.
		const fovTangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
		this.material.size =
			TRAIL_CONFIG.size *
			screenScaleFactor(this.camera.position.length(), fovTangent);
		const { positions, colors, baseColors, velocities, ages, lifetimes } = this;

		for (let i = 0; i < MAX_PARTICLES; i++) {
			const life = lifetimes[i];
			const age = ages[i] + deltaTime;

			if (age >= life) {
				// Blank a particle the frame it dies, then leave it alone.
				if (ages[i] < life) {
					colors[i * 3] = 0;
					colors[i * 3 + 1] = 0;
					colors[i * 3 + 2] = 0;
					ages[i] = life;
				}
				continue;
			}
			ages[i] = age;

			// Constant-velocity drift (no damping): trails keep hovering, despawn
			// and lift-off bursts keep rising.
			positions[i * 3] += velocities[i * 3] * deltaTime;
			positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
			positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;

			// Fade in quickly, then fade out over the rest of the lifetime.
			// Under additive blending, scaling rgb toward 0 is the fade.
			const t = age / life;
			const fadeIn = 0.12;
			let alpha = t < fadeIn ? t / fadeIn : 1 - (t - fadeIn) / (1 - fadeIn);
			alpha *= alpha;
			colors[i * 3] = baseColors[i * 3] * alpha;
			colors[i * 3 + 1] = baseColors[i * 3 + 1] * alpha;
			colors[i * 3 + 2] = baseColors[i * 3 + 2] * alpha;
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;
	}
}
