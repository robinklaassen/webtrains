import dayjs from "dayjs";
import * as THREE from "three";

const SPHERE_RADIUS = 0.7;

const DEFAULT_COLOR = 0xffffff; // white

// const TYPE_COLOR_MAP: { [key: string]: number } = {
// 	SPR: 0xffff00, // yellow
// 	IC: 0x0000ff, // blue
// 	ARR: 0xff0000, // red
// 	Unknown: 0xffffff, // white
// };

// tip: use extension 'Color Picker Universal' in VSCode
export const MATERIAL_COLOR_MAP: { [key: string]: number } = {
	// intercity
	VIRM: 0x00ffc8,
	DDZ: 0x00a2ff,
	ICM: 0x8c00ff,
	ICNG: 0x0000ff,

	// sprinter
	SLT: 0xc3e600,
	SNG: 0xffff00,
	FLIRT: 0xff8800,
	GTW: 0xff0000,
};

/**
 * Represents a train in the 3D scene.
 */
export class Train {
	// Shared resources across all train instances (Tier 1 & 2 optimization)
	private static readonly sharedGeometry = new THREE.SphereGeometry(
		SPHERE_RADIUS,
		32, // width segments (reduced from 32 for Tier 2 optimization)
		32, // height segments (reduced from 32 for Tier 2 optimization)
	);
	private static readonly materialCache = new Map<
		number,
		THREE.MeshPhongMaterial
	>();

	/**
	 * Get or create a material for the given color.
	 */
	private static getMaterial(color: number): THREE.MeshPhongMaterial {
		const existing = Train.materialCache.get(color);
		if (existing) {
			return existing;
		}
		const material = new THREE.MeshPhongMaterial({ color });
		Train.materialCache.set(color, material);
		return material;
	}

	mesh: THREE.Mesh;
	type: string = "Unknown"; // TODO use enum for train types
	material: string = "Unknown"; // TODO use enum for train materials

	// Movement is done by interpolation between origin and target based on alpha factor [0, 1].
	origin: THREE.Vector3;
	target: THREE.Vector3;
	alpha: number = 0;

	// last ingame timestamp when this train received a new target position
	lastUpdateTimestamp: dayjs.Dayjs;

	constructor(
		position: THREE.Vector3,
		type: string,
		material: string | undefined,
		timestamp: dayjs.Dayjs = dayjs(),
	) {
		this.type = type;
		if (material) {
			this.material = material;
		}

		const color = MATERIAL_COLOR_MAP[this.material] ?? DEFAULT_COLOR;

		// Use shared geometry and cached material (Tier 1 & 2 optimization)
		this.mesh = new THREE.Mesh(Train.sharedGeometry, Train.getMaterial(color));
		this.mesh.position.copy(position);
		this.origin = position.clone();
		this.target = position.clone();
		this.lastUpdateTimestamp = timestamp;
	}

	/**
	 * Set a new target position for the train. The train will move towards this target in the update loop of the TrainManager.
	 * @param newTarget - The new target position.
	 * @param timestamp - The timestamp for the target position.
	 */
	updateTarget(newTarget: THREE.Vector3, timestamp: dayjs.Dayjs) {
		this.lastUpdateTimestamp = timestamp;
		// this.mesh.position.copy(newTarget); // temporarily removed smoothing animation
		this.origin.copy(this.mesh.position);
		this.target.copy(newTarget);
		this.alpha = 0;
	}

	// Updates every frame from the render loop
	update(deltaTime: number, speedFactor: number) {
		// delta is the ingame time passed since last frame divided by 10 seconds between every clock update timestamp
		const delta = (deltaTime * speedFactor) / 10;
		this.alpha += delta;
		this.alpha = Math.min(this.alpha, 1); // Clamp to [0, 1] to prevent extrapolation past target
		this.mesh.position.lerpVectors(this.origin, this.target, this.alpha);
	}
}
