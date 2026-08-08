import * as THREE from "three";
import { TrainMaterial } from "../models";
import type { Train } from "./Train";

const SPHERE_RADIUS = 0.7;
// 24x16 segments look identical to the previous 32x32 at typical viewing
// distances, with ~2.5x fewer triangles.
const SPHERE_WIDTH_SEGMENTS = 24;
const SPHERE_HEIGHT_SEGMENTS = 16;

// Height above the ground plane at which trains (and the trails they leave
// behind) are rendered, so they sit on the map instead of half-embedded in it.
export const GROUND_CLEARANCE = 1.4;

// Instance capacity each material group starts with; doubles on demand.
const INITIAL_CAPACITY = 128;

export const DEFAULT_COLOR = 0xffffff; // white

// tip: use extension 'Color Picker Universal' in VSCode
// Colors are kept bright enough to pass the bloom luminance threshold,
// so every train glows (pure blue/red are too dark for it).
export const MATERIAL_COLOR_MAP: Record<TrainMaterial, number> = {
	[TrainMaterial.VIRM]: 0x00ffc8,
	[TrainMaterial.DDZ]: 0x00a2ff,
	[TrainMaterial.ICM]: 0x9d2bff,
	[TrainMaterial.ICNG]: 0x3355ff,
	[TrainMaterial.SLT]: 0xc3e600,
	[TrainMaterial.SNG]: 0x2bde5f,
	[TrainMaterial.FLIRT]: 0xff8800,
	[TrainMaterial.GTW]: 0xff2233,
};

// Organic "firefly" pulsing of the train glow.
// Mutable at runtime so the debug GUI can tune it.
export const TRAIN_PULSE_CONFIG = {
	amount: 0.14, // scale amplitude (0 = off)
	speed: 2.2, // radians per second
};

// Distance/zoom-based "screen size" scaling: each train scales up the farther it
// is from the camera (or the more zoomed out the view), and down when close, so
// trains stay a readable size. Computed per train in the instance-matrix write
// that already runs each frame, so it's cheap. Mutable for the debug GUI.
export const SCREEN_SCALE_CONFIG = {
	enabled: true,
	// "Screen-size metric" (distance-to-camera * tan(fov / 2)) that maps to a
	// scale factor of 1; smaller metrics scale down, larger scale up.
	reference: 110,
	min: 0.5, // never shrink past this (close / zoomed in)
	max: 1, // never grow past this (far / zoomed out)
};

/**
 * Distance/zoom size multiplier shared by trains and their trail particles:
 * larger the farther the thing is from the camera (or the more zoomed out the
 * view), clamped to [min, max]. Returns 1 when scaling is disabled.
 */
export function screenScaleFactor(
	distanceToCamera: number,
	fovTangent: number,
): number {
	if (!SCREEN_SCALE_CONFIG.enabled) return 1;
	const metric = distanceToCamera * fovTangent;
	return THREE.MathUtils.clamp(
		metric / SCREEN_SCALE_CONFIG.reference,
		SCREEN_SCALE_CONFIG.min,
		SCREEN_SCALE_CONFIG.max,
	);
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

// Scratch objects reused while writing instance matrices/colors
const _matrix = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();

/**
 * Renders all trains of a single material as one InstancedMesh, so the whole
 * group costs one draw call regardless of train count. Trains occupy dense
 * instance slots; removing a train moves the last train into its slot.
 */
class TrainInstanceGroup {
	private scene: THREE.Scene;
	private geometry: THREE.SphereGeometry;
	private material: THREE.MeshBasicMaterial;
	// The material's intended color; each instance's actual color is this scaled
	// by the train's speed-based vibrance, applied via instanceColor.
	private baseColor: THREE.Color;
	private mesh: THREE.InstancedMesh;
	private capacity: number = INITIAL_CAPACITY;
	private trains: Train[] = [];
	private slots: Map<Train, number> = new Map();
	// Animation time (seconds) used for the pulse, set by updateMatrices
	private time: number = 0;
	// Global [0..1] multiplier on size and brightness, used to fade trains out
	// during the end-of-animation outro.
	private fade: number = 1;
	// Camera state for per-train distance/zoom scaling (see SCREEN_SCALE_CONFIG).
	// cameraPosition is a live reference to the camera's world position.
	private cameraPosition: THREE.Vector3 = new THREE.Vector3();
	private fovTangent: number = 1;

	constructor(
		scene: THREE.Scene,
		geometry: THREE.SphereGeometry,
		color: number,
	) {
		this.scene = scene;
		this.geometry = geometry;
		this.baseColor = new THREE.Color(color);
		// Unlit material kept white; per-instance vibrance lives in instanceColor.
		// Trains are glowing light sources, the bloom pass provides the "lighting".
		this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
		this.mesh = this.createMesh(this.capacity);
		this.scene.add(this.mesh);
	}

	private createMesh(capacity: number): THREE.InstancedMesh {
		const mesh = new THREE.InstancedMesh(
			this.geometry,
			this.material,
			capacity,
		);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.count = this.trains.length;
		// Instances are spread across the whole map; the mesh is effectively
		// always in view and the default bounding volume would cull it wrongly.
		mesh.frustumCulled = false;
		return mesh;
	}

	add(train: Train): void {
		if (this.trains.length === this.capacity) {
			this.grow();
		}
		const slot = this.trains.length;
		this.trains.push(train);
		this.slots.set(train, slot);
		this.mesh.count = this.trains.length;
		this.writeMatrix(slot, train);
		this.flagNeedsUpdate();
	}

	remove(train: Train): void {
		const slot = this.slots.get(train);
		if (slot === undefined) return;
		this.slots.delete(train);

		// Keep slots dense: move the last train into the freed slot
		const last = this.trains.pop();
		if (last && last !== train) {
			this.trains[slot] = last;
			this.slots.set(last, slot);
			this.writeMatrix(slot, last);
			this.flagNeedsUpdate();
		}
		this.mesh.count = this.trains.length;
	}

	private flagNeedsUpdate(): void {
		this.mesh.instanceMatrix.needsUpdate = true;
		if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
	}

	clear(): void {
		this.trains.length = 0;
		this.slots.clear();
		this.mesh.count = 0;
	}

	setVisible(visible: boolean): void {
		this.mesh.visible = visible;
	}

	setFade(fade: number): void {
		this.fade = fade;
	}

	/** Write all instance matrices and colors from current train state. */
	updateMatrices(
		time: number,
		cameraPosition: THREE.Vector3,
		fovTangent: number,
	): void {
		this.time = time;
		this.cameraPosition = cameraPosition;
		this.fovTangent = fovTangent;
		if (this.trains.length === 0) return;
		for (let slot = 0; slot < this.trains.length; slot++) {
			this.writeMatrix(slot, this.trains[slot]);
		}
		this.flagNeedsUpdate();
	}

	private writeMatrix(slot: number, train: Train): void {
		// Gentle firefly pulse, with a per-train phase so they don't sync up
		const pulse =
			1 +
			TRAIN_PULSE_CONFIG.amount *
				Math.sin(this.time * TRAIN_PULSE_CONFIG.speed + train.pulsePhase);
		// Lift off the ground plane so the sphere sits on it (and level with the
		// trails it leaves behind) rather than half-embedded in it.
		_pos.copy(train.position);
		_pos.y += GROUND_CLEARANCE;
		// Per-train distance/zoom scaling, from this train's own camera distance.
		const distanceScale = screenScaleFactor(
			_pos.distanceTo(this.cameraPosition),
			this.fovTangent,
		);
		_scale.setScalar(train.scale * pulse * this.fade * distanceScale);
		_matrix.compose(_pos, IDENTITY_QUATERNION, _scale);
		this.mesh.setMatrixAt(slot, _matrix);

		// Per-instance color: material color dimmed by the train's speed vibrance
		// and the global outro fade.
		_color.copy(this.baseColor).multiplyScalar(train.vibrance * this.fade);
		this.mesh.setColorAt(slot, _color);
	}

	/** Double the instance capacity, carrying over existing matrices and colors. */
	private grow(): void {
		this.capacity *= 2;
		const old = this.mesh;
		const fresh = this.createMesh(this.capacity);
		(fresh.instanceMatrix.array as Float32Array).set(
			(old.instanceMatrix.array as Float32Array).subarray(
				0,
				this.trains.length * 16,
			),
		);
		fresh.instanceMatrix.needsUpdate = true;
		if (old.instanceColor) {
			fresh.instanceColor = new THREE.InstancedBufferAttribute(
				new Float32Array(this.capacity * 3),
				3,
			);
			(fresh.instanceColor.array as Float32Array).set(
				(old.instanceColor.array as Float32Array).subarray(
					0,
					this.trains.length * 3,
				),
			);
			fresh.instanceColor.needsUpdate = true;
		}
		fresh.visible = old.visible;
		this.scene.remove(old);
		old.dispose(); // frees instance buffers only, not the shared geometry/material
		this.scene.add(fresh);
		this.mesh = fresh;
	}
}

/**
 * Renderer for all trains in the scene, using one instanced mesh per train
 * material instead of one Mesh object per train.
 */
export class TrainInstances {
	// Accumulated real time (seconds) driving the pulse animation
	private time: number = 0;
	private camera: THREE.PerspectiveCamera;
	private groups: Map<TrainMaterial, TrainInstanceGroup> = new Map();
	// Trains whose material is not one of the known TrainMaterial values are
	// rendered in this always-visible group with the default (white) color.
	private unknownGroup: TrainInstanceGroup;
	private sharedGeometry = new THREE.SphereGeometry(
		SPHERE_RADIUS,
		SPHERE_WIDTH_SEGMENTS,
		SPHERE_HEIGHT_SEGMENTS,
	);

	constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
		this.camera = camera;
		Object.values(TrainMaterial).forEach((material) => {
			const color = MATERIAL_COLOR_MAP[material] ?? DEFAULT_COLOR;
			this.groups.set(
				material,
				new TrainInstanceGroup(scene, this.sharedGeometry, color),
			);
		});
		this.unknownGroup = new TrainInstanceGroup(
			scene,
			this.sharedGeometry,
			DEFAULT_COLOR,
		);
	}

	private groupFor(train: Train): TrainInstanceGroup {
		return this.groups.get(train.material) ?? this.unknownGroup;
	}

	add(train: Train): void {
		this.groupFor(train).add(train);
	}

	remove(train: Train): void {
		this.groupFor(train).remove(train);
	}

	clear(): void {
		this.groups.forEach((group) => {
			group.clear();
		});
		this.unknownGroup.clear();
	}

	/** Show or hide all trains of a material (a single visibility flip). */
	setMaterialVisible(material: TrainMaterial, visible: boolean): void {
		this.groups.get(material)?.setVisible(visible);
	}

	/**
	 * Globally scale train size and brightness by [0..1]; 1 is normal, 0 fully
	 * hidden. Used to fade all trains out during the end-of-animation outro.
	 */
	setFade(fade: number): void {
		this.groups.forEach((group) => {
			group.setFade(fade);
		});
		this.unknownGroup.setFade(fade);
	}

	/** Push current train positions into the instance buffers. Call once per frame. */
	updateMatrices(deltaTime: number): void {
		this.time += deltaTime;
		// Camera-derived values are constant across trains this frame; compute
		// once and let each group apply them per train.
		const cameraPosition = this.camera.position;
		const fovTangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
		this.groups.forEach((group) => {
			group.updateMatrices(this.time, cameraPosition, fovTangent);
		});
		this.unknownGroup.updateMatrices(this.time, cameraPosition, fovTangent);
	}
}
