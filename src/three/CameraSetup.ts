import * as THREE from "three";

interface CameraConfig {
	fov: number;
	near: number;
	far: number;
	position: [number, number, number];
	lookAt: [number, number, number];
}

const DEFAULT_CONFIG: CameraConfig = {
	fov: 40,
	near: 0.1,
	far: 10000,
	position: [0, 420, 0],
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

/**
 * Parameters that describe the camera in orbit form around a target.
 * - cameraDistanceToTarget: distance from camera to target.
 * - cameraTilt: degrees above the horizontal XZ plane (0 = horizontal, 90 = straight above).
 * - cameraPan: degrees around the Y axis (azimuth), measured from the +X axis toward +Z.
 * - fov: optional field of view (in degrees) to animate toward for this move.
 */
export interface CameraOrbitParameters {
	cameraDistanceToTarget: number;
	cameraTilt: number;
	cameraPan: number;
	fov?: number;
}

/**
 * Single camera "keyframe" used in higher-level camera movement sequences.
 */
export interface CameraKeyframeConfig {
	target: THREE.Vector3;
	orbit: CameraOrbitParameters;
}

/**
 * Computes an absolute camera position from a target point and orbit-style parameters.
 * Returns a new Vector3 instance.
 */
export function computeCameraPositionFromTarget(
	cameraTarget: THREE.Vector3,
	params: CameraOrbitParameters,
): THREE.Vector3 {
	const { cameraDistanceToTarget, cameraTilt, cameraPan } = params;

	// Convert orbit-style degrees into Three.js spherical coordinates.
	// Tilt: 0° = horizontal, 90° = directly above the target.
	const radius = cameraDistanceToTarget;
	const phi = THREE.MathUtils.degToRad(90 - cameraTilt); // polar angle from +Y
	const theta = THREE.MathUtils.degToRad(cameraPan); // azimuth around Y

	const spherical = new THREE.Spherical(radius, phi, theta);
	const offset = new THREE.Vector3().setFromSpherical(spherical);

	return cameraTarget.clone().add(offset);
}

/**
 * Simple helper to lerp between two Vector3s into an output vector.
 * Re-usable for any kind of camera- or target-related interpolation.
 */
export function lerpVector3(
	from: THREE.Vector3,
	to: THREE.Vector3,
	alpha: number,
	out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
	return out.copy(from).lerp(to, alpha);
}

interface CameraAnimationState {
	startPosition: THREE.Vector3;
	endPosition: THREE.Vector3;
	startTarget: THREE.Vector3;
	endTarget: THREE.Vector3;
	startFov: number;
	endFov: number;
	elapsedSeconds: number;
	durationSeconds: number;
	active: boolean;
}

interface CameraSequenceState {
	keyframes: CameraKeyframeConfig[];
	nextIndex: number;
	segmentDurationSeconds: number;
	loop: boolean;
}

/**
 * Small helper that keeps track of a camera target and smoothly animates
 * the camera between orbit positions around that target.
 *
 * Usage pattern:
 *   const camera = createCamera();
 *   const animator = new CameraAnimator(camera, new THREE.Vector3(0, 0, 0));
 *   animator.setTargetWithOrbit(new THREE.Vector3(100, 0, 50), {
 *     cameraDistanceToTarget: 600,
 *     cameraTilt: 45,
 *     cameraPan: 120,
 *   });
 *   // In your render loop: animator.update(deltaSeconds);
 */
export class CameraAnimator {
	private camera: THREE.PerspectiveCamera;
	private cameraTarget: THREE.Vector3;
	private animationState: CameraAnimationState | null = null;
	private defaultDurationSeconds: number;
	private sequenceState: CameraSequenceState | null = null;

	constructor(
		camera: THREE.PerspectiveCamera,
		initialTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
		defaultDurationSeconds: number = 4,
	) {
		this.camera = camera;
		this.cameraTarget = initialTarget.clone();
		this.defaultDurationSeconds = defaultDurationSeconds;
	}

	/**
	 * Returns the current logical camera target.
	 */
	getTarget(): THREE.Vector3 {
		return this.cameraTarget.clone();
	}

	/**
	 * Returns the camera's current world position.
	 */
	getPosition(): THREE.Vector3 {
		return this.camera.position.clone();
	}

	/**
	 * Schedules a smooth camera move to a new target plus orbit parameters.
	 * The camera position is recomputed from the target/distance/tilt/pan and
	 * both the position and look-at target are smoothly interpolated.
	 *
	 * @param newTarget - Desired target point for the camera to look at.
	 * @param orbit     - Orbit parameters (distance, tilt in degrees, pan in degrees).
	 * @param durationSeconds - Optional duration override for this move (in seconds).
	 */
	setTargetWithOrbit(
		newTarget: THREE.Vector3,
		orbit: CameraOrbitParameters,
		durationSeconds?: number,
	): void {
		const startPosition = this.camera.position.clone();
		const endPosition = computeCameraPositionFromTarget(newTarget, orbit);

		const startTarget = this.cameraTarget.clone();
		const endTarget = newTarget.clone();

		const startFov = this.camera.fov;
		const endFov = orbit.fov ?? this.camera.fov;

		const duration =
			durationSeconds !== undefined
				? Math.max(durationSeconds, 0.001)
				: this.defaultDurationSeconds;

		this.animationState = {
			startPosition,
			endPosition,
			startTarget,
			endTarget,
			startFov,
			endFov,
			elapsedSeconds: 0,
			durationSeconds: duration,
			active: true,
		};
	}

	/**
	 * Defines a higher-level camera movement made up of multiple camera
	 * keyframes. The camera is smoothly moved through each keyframe in order.
	 *
	 * The total duration is split evenly across all segments. The first
	 * segment moves from the *current* camera state to the first keyframe,
	 * subsequent segments move between the provided keyframes.
	 */
	setCameraSequence(
		keyframes: CameraKeyframeConfig[],
		totalDurationSeconds?: number,
		options?: { loop?: boolean },
	): void {
		if (keyframes.length === 0) {
			return;
		}

		// If there is only one keyframe, just treat it as a single move.
		if (keyframes.length === 1) {
			const single = keyframes[0];
			this.sequenceState = null;
			this.setTargetWithOrbit(single.target, single.orbit, totalDurationSeconds);
			return;
		}

		const loop = options?.loop ?? false;

		const segmentsCount = keyframes.length; // includes current->first + between keyframes
		const total =
			totalDurationSeconds !== undefined
				? Math.max(totalDurationSeconds, 0.001)
				: this.defaultDurationSeconds * segmentsCount;

		const segmentDurationSeconds = total / segmentsCount;

		this.sequenceState = {
			keyframes: keyframes.map((kf) => ({
				target: kf.target.clone(),
				orbit: { ...kf.orbit },
			})),
			nextIndex: 0,
			segmentDurationSeconds,
			loop,
		};

		this.startNextSequenceSegment();
	}

	private startNextSequenceSegment(): void {
		if (!this.sequenceState) return;

		const { keyframes, segmentDurationSeconds, loop } = this.sequenceState;

		if (this.sequenceState.nextIndex >= keyframes.length) {
			// Sequence finished.
			if (loop) {
				this.sequenceState.nextIndex = 0;
			} else {
				this.sequenceState = null;
				return;
			}
		}

		const nextKeyframe = keyframes[this.sequenceState.nextIndex];
		this.sequenceState.nextIndex += 1;

		this.setTargetWithOrbit(
			nextKeyframe.target,
			nextKeyframe.orbit,
			segmentDurationSeconds,
		);
	}

	/**
	 * Advances any in-progress camera animation. Call this once per frame,
	 * passing the real-time delta in seconds (e.g. from your render loop).
	 */
	update(deltaSeconds: number): void {
		if (!this.animationState || !this.animationState.active) return;

		const state = this.animationState;
		state.elapsedSeconds += deltaSeconds;

		const t = Math.min(state.elapsedSeconds / state.durationSeconds, 1);
		const easedT = this.easeInOutCubic(t);

		const position = lerpVector3(
			state.startPosition,
			state.endPosition,
			easedT,
		);
		const target = lerpVector3(state.startTarget, state.endTarget, easedT);
		const fov = THREE.MathUtils.lerp(state.startFov, state.endFov, easedT);

		this.camera.position.copy(position);
		this.camera.lookAt(target);
		this.cameraTarget.copy(target);
		this.camera.fov = fov;
		this.camera.updateProjectionMatrix();

		if (t >= 1) {
			state.active = false;

			// If we are in a sequence, immediately schedule the next segment.
			if (this.sequenceState) {
				this.startNextSequenceSegment();
			}
		}
	}

	private easeInOutCubic(t: number): number {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}
}
