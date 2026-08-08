import * as THREE from "three";
import { createGlowTexture } from "../three/Atmosphere";
import type { Train } from "./Train";
import {
	DEFAULT_COLOR,
	MATERIAL_COLOR_MAP,
	screenScaleFactor,
} from "./TrainInstances";

// Pool size: at most this many beams animate at once; excess events are
// skipped (a mass spawn at loop restart still reads as an event).
const POOL_SIZE = 48;

// Base beam dimensions; scaled per-play by SPAWN_BEAM_CONFIG.size.
const BEAM_HEIGHT = 90;
const BEAM_RADIUS = 0.8;
// Ground flash ring expansion (also scaled by size).
const RING_MAX_SCALE = 9;
// Beams keep most of the train's color, with only a touch of white at the core
// so they still read as light. Lower = more distinctly the train's color.
const WHITE_BLEND = 0.15;

// Spawn animation shape (all in normalized time t = age / duration):
const ATTACK_FRACTION = 0.12; // portion of the effect spent striking to full brightness
const BEAM_RADIUS_START = 1.3; // beam radius multiplier at the strike...
const BEAM_RADIUS_END = 0.6; // ...tapering to this as it fades
const RING_PEAK_OPACITY = 0.9; // ground ring opacity at the strike, easing to 0

/**
 * Tunable spawn-beam parameters, mutated live by the debug GUI.
 */
export const SPAWN_BEAM_CONFIG = {
	duration: 0.4, // seconds (lower = faster strike)
	size: 0.2, // multiplier on beam height/radius (lower = smaller)
};

const _color = new THREE.Color();
const WHITE = new THREE.Color(0xffffff);

/**
 * Vertical gradient for the beam: hot at the base, fading towards the sky.
 */
function createBeamTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 4;
	canvas.height = 128;
	const context = canvas.getContext("2d");
	if (context) {
		// CylinderGeometry maps v=1 to the top of the cylinder; canvas y=0 is
		// the top of the texture, which lands on v=1.
		const gradient = context.createLinearGradient(0, 0, 0, 128);
		gradient.addColorStop(0, "rgba(255,255,255,0)"); // sky end
		gradient.addColorStop(0.55, "rgba(255,255,255,0.55)");
		gradient.addColorStop(1, "rgba(255,255,255,1)"); // ground end
		context.fillStyle = gradient;
		context.fillRect(0, 0, 4, 128);
	}
	return new THREE.CanvasTexture(canvas);
}

/** One poolable beam + ground ring pair. */
interface EffectInstance {
	beam: THREE.Mesh;
	ring: THREE.Mesh;
	beamMaterial: THREE.MeshBasicMaterial;
	ringMaterial: THREE.MeshBasicMaterial;
	// Spawn position, kept for distance/zoom scaling.
	position: THREE.Vector3;
	age: number;
	active: boolean;
}

/**
 * Spawn light effect for trains: a quick stroke of light from the heavens with
 * an expanding ground flash, tinted by the train's material color. (Despawns
 * are handled by the TrainParticles "poof" instead.)
 */
export class TrainEffects {
	enabled: boolean = true;

	private pool: EffectInstance[] = [];
	private camera: THREE.PerspectiveCamera;

	constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
		this.camera = camera;
		const beamGeometry = new THREE.CylinderGeometry(
			BEAM_RADIUS,
			BEAM_RADIUS,
			1, // unit height, scaled per effect
			10,
			1,
			true, // open-ended
		);
		const ringGeometry = new THREE.PlaneGeometry(4, 4);
		const beamTexture = createBeamTexture();
		const ringTexture = createGlowTexture(64);

		for (let i = 0; i < POOL_SIZE; i++) {
			const beamMaterial = new THREE.MeshBasicMaterial({
				map: beamTexture,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: false,
			});
			const beam = new THREE.Mesh(beamGeometry, beamMaterial);
			beam.visible = false;

			const ringMaterial = new THREE.MeshBasicMaterial({
				map: ringTexture,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				fog: false,
			});
			const ring = new THREE.Mesh(ringGeometry, ringMaterial);
			ring.rotation.x = -Math.PI / 2;
			ring.visible = false;

			scene.add(beam);
			scene.add(ring);
			this.pool.push({
				beam,
				ring,
				beamMaterial,
				ringMaterial,
				position: new THREE.Vector3(),
				age: 0,
				active: false,
			});
		}
	}

	/** Play the appear effect at the train's position. */
	trainAppeared(train: Train): void {
		if (!this.enabled) return;
		const instance = this.pool.find((candidate) => !candidate.active);
		if (!instance) return; // pool exhausted: skip the effect

		_color
			.setHex(MATERIAL_COLOR_MAP[train.material] ?? DEFAULT_COLOR)
			.lerp(WHITE, WHITE_BLEND);
		instance.beamMaterial.color.copy(_color);
		instance.ringMaterial.color.copy(_color);

		instance.ring.position.set(train.position.x, 0.4, train.position.z);
		instance.beam.position.x = train.position.x;
		instance.beam.position.z = train.position.z;
		instance.position.copy(train.position);

		instance.age = 0;
		instance.active = true;
		instance.beam.visible = true;
		instance.ring.visible = true;
	}

	/**
	 * Advance all active effects. Runs on real time so the beams animate at the
	 * same readable pace regardless of the game clock speed.
	 */
	update(deltaTime: number): void {
		// Camera-derived values are constant across beams this frame; compute once.
		const cameraPosition = this.camera.position;
		const fovTangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));

		for (const instance of this.pool) {
			if (!instance.active) continue;

			instance.age += deltaTime;
			const t = instance.age / SPAWN_BEAM_CONFIG.duration;

			if (t >= 1) {
				instance.active = false;
				instance.beam.visible = false;
				instance.ring.visible = false;
				continue;
			}

			this.animateSpawn(instance, t, cameraPosition, fovTangent);
		}
	}

	/** Strike: fast bright attack, tightening beam, expanding ground flash. */
	private animateSpawn(
		instance: EffectInstance,
		t: number,
		cameraPosition: THREE.Vector3,
		fovTangent: number,
	): void {
		// Scale the beam with distance/zoom, matching the trains.
		const distanceScale = screenScaleFactor(
			instance.position.distanceTo(cameraPosition),
			fovTangent,
		);
		const size = SPAWN_BEAM_CONFIG.size * distanceScale;
		const height = BEAM_HEIGHT * size;

		// Fast strike to full brightness, then an ease-out fade.
		instance.beamMaterial.opacity =
			t < ATTACK_FRACTION
				? t / ATTACK_FRACTION
				: (1 - (t - ATTACK_FRACTION) / (1 - ATTACK_FRACTION)) ** 2;

		// Beam tapers from its start radius to its end radius as it fades.
		const radiusFactor =
			BEAM_RADIUS_START + (BEAM_RADIUS_END - BEAM_RADIUS_START) * t;
		const radius = radiusFactor * size;
		instance.beam.scale.set(radius, height, radius);
		instance.beam.position.y = height / 2;

		// Ground flash ring expands (ease-out) and fades.
		const expand = 1 - (1 - t) ** 2;
		instance.ring.scale.setScalar((1 + expand * RING_MAX_SCALE) * size);
		instance.ringMaterial.opacity = RING_PEAK_OPACITY * (1 - t) ** 1.5;
	}
}
