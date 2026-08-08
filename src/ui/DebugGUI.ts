import * as dat from "dat.gui";
import dayjs from "dayjs";
import type * as THREE from "three";
import type { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
	SPEED_NORMALIZATION,
	SPEED_SIZE_CONFIG,
	SPEED_VIBRANCE_CONFIG,
} from "@/components/Train";
import {
	SPAWN_BEAM_CONFIG,
	type TrainEffects,
} from "@/components/TrainEffects";
import {
	SCREEN_SCALE_CONFIG,
	TRAIN_PULSE_CONFIG,
} from "@/components/TrainInstances";
import { DESPAWN_CONFIG, TRAIL_CONFIG } from "@/components/TrainParticles";
import type { TrainManager } from "@/core/TrainManager";
import type { AmbientParticles, CameraAnimator } from "@/three";
import { CAMERA_MOVEMENT_OVERVIEW, CAMERA_MOVEMENT_ZOOM_IN } from "@/three";

interface DebugGUIParams {
	fps: number;
	animationStartHours: number;
	clockSpeedFactor: number;
	cameraTourLooping: boolean;
	showParticles: boolean;
	startNewAnimation(): void;
	playOverviewCameraTour(): void;
	playZoomInCameraTour(): void;
}

/** Live graphics objects the GUI can tune. */
interface GraphicsControls {
	bloomPass: UnrealBloomPass;
	fog: THREE.FogExp2;
	particles: AmbientParticles;
	effects: TrainEffects;
}

/**
 * Manages dat.gui controls for debugging and parameter adjustment.
 */
export class DebugGUI {
	private gui: dat.GUI;
	private params: DebugGUIParams;
	// Smoothed frame time (seconds) backing the FPS readout.
	private smoothedFrameSeconds: number = 0;

	constructor(
		trainManager: TrainManager,
		cameraAnimator: CameraAnimator,
		graphics: GraphicsControls,
	) {
		this.params = {
			fps: 0,
			animationStartHours: dayjs().hour() - 4, // default to 4 hours ago
			clockSpeedFactor: 300, // how much faster in-game time runs vs real time
			cameraTourLooping: true,
			showParticles: false,
			startNewAnimation: () => {
				trainManager.newAnimation(
					dayjs().hour(this.params.animationStartHours).minute(0).second(0),
					dayjs(),
					{ loop: true },
				);
			},
			playOverviewCameraTour: () => {
				// Smooth, wide overview movement across the network. Re-enable in
				// case the user had taken manual control of the camera.
				cameraAnimator.setEnabled(true);
				cameraAnimator.setCameraSequence(CAMERA_MOVEMENT_OVERVIEW, 30, {
					loop: this.params.cameraTourLooping,
				});
			},
			playZoomInCameraTour: () => {
				// Gradual zoom from high-level overview into close-up
				cameraAnimator.setEnabled(true);
				cameraAnimator.setCameraSequence(CAMERA_MOVEMENT_ZOOM_IN, 24, {
					loop: this.params.cameraTourLooping,
				});
			},
		};

		this.gui = new dat.GUI();
		// Live FPS readout (updated via updateFps each frame; .listen() refreshes it).
		this.gui.add(this.params, "fps").name("FPS").listen();
		this.gui
			.add(this.params, "animationStartHours", 0, 23, 1)
			.name("Start Time (hours)");
		this.gui
			.add(this.params, "clockSpeedFactor", 1, 1000, 1)
			.name("Clock Speed Factor");
		this.gui.add(this.params, "startNewAnimation").name("Start New Animation");
		this.gui.add(this.params, "cameraTourLooping").name("Loop Camera Tour");
		this.gui
			.add(this.params, "playOverviewCameraTour")
			.name("Camera Tour: Overview");
		this.gui
			.add(this.params, "playZoomInCameraTour")
			.name("Camera Tour: Zoom In");
		this.gui
			.add(SPEED_VIBRANCE_CONFIG, "minVibrance", 0, 1, 0.05)
			.name("Min Vibrance");
		this.gui
			.add(SPEED_NORMALIZATION, "maxSpeedKmh", 40, 250, 10)
			.name("Full-speed (km/h)");

		const graphicsFolder = this.gui.addFolder("Graphics");
		graphicsFolder
			.add(graphics.bloomPass, "strength", 0, 3, 0.05)
			.name("Bloom Strength");
		graphicsFolder
			.add(graphics.bloomPass, "radius", 0, 1.5, 0.05)
			.name("Bloom Radius");
		graphicsFolder
			.add(graphics.bloomPass, "threshold", 0, 1, 0.01)
			.name("Bloom Threshold");
		graphicsFolder
			.add(TRAIN_PULSE_CONFIG, "amount", 0, 0.5, 0.01)
			.name("Pulse Amount");
		graphicsFolder
			.add(TRAIN_PULSE_CONFIG, "speed", 0, 8, 0.1)
			.name("Pulse Speed");
		graphicsFolder
			.add(graphics.fog, "density", 0, 0.004, 0.0001)
			.name("Fog Density");
		graphicsFolder
			.add(this.params, "showParticles")
			.name("Ambient Particles")
			.onChange((visible: boolean) => {
				graphics.particles.setVisible(visible);
			});
		graphicsFolder
			.add(SPEED_SIZE_CONFIG, "minScale", 0.3, 1.5, 0.05)
			.name("Min Train Size");
		graphicsFolder
			.add(SPEED_SIZE_CONFIG, "maxScale", 0.5, 3, 0.05)
			.name("Max Train Size");

		const spawnFolder = this.gui.addFolder("Spawn Beam");
		spawnFolder.add(graphics.effects, "enabled").name("Enabled");
		spawnFolder
			.add(SPAWN_BEAM_CONFIG, "duration", 0.2, 2, 0.05)
			.name("Duration (s)");
		spawnFolder.add(SPAWN_BEAM_CONFIG, "size", 0.01, 2, 0.01).name("Size");

		const despawnFolder = this.gui.addFolder("Despawn");
		despawnFolder.add(DESPAWN_CONFIG, "enabled").name("Enabled");

		const trailFolder = this.gui.addFolder("Train Trails");
		trailFolder.add(TRAIL_CONFIG, "enabled").name("Enabled");
		trailFolder
			.add(TRAIL_CONFIG, "spacing", 0.3, 20, 0.1)
			.name("Spacing (sparser →)");
		trailFolder
			.add(TRAIL_CONFIG, "spreadSpeed", 0, 3, 0.01)
			.name("Spread Speed");
		trailFolder
			.add(TRAIL_CONFIG, "lifespan", 0.5, 40, 0.5)
			.name("Lifespan (s)");
		trailFolder.add(TRAIL_CONFIG, "size", 0.5, 6, 0.1).name("Particle Size");
		trailFolder.open();

		const distanceFolder = this.gui.addFolder("Distance Scaling");
		distanceFolder.add(SCREEN_SCALE_CONFIG, "enabled").name("Enabled");
		distanceFolder
			.add(SCREEN_SCALE_CONFIG, "min", 0.2, 1.5, 0.05)
			.name("Min Scale");
		distanceFolder
			.add(SCREEN_SCALE_CONFIG, "max", 1, 4, 0.05)
			.name("Max Scale");
		distanceFolder
			.add(SCREEN_SCALE_CONFIG, "reference", 40, 300, 5)
			.name("Reference (=1x)");
	}

	/**
	 * Update the FPS readout from the latest real frame time. Smoothed with an
	 * exponential moving average so the number is stable to read.
	 * @param deltaTime - Real seconds since the previous frame.
	 */
	updateFps(deltaTime: number): void {
		if (deltaTime <= 0) return;
		this.smoothedFrameSeconds =
			this.smoothedFrameSeconds === 0
				? deltaTime
				: this.smoothedFrameSeconds +
					(deltaTime - this.smoothedFrameSeconds) * 0.1;
		this.params.fps = Math.round(1 / this.smoothedFrameSeconds);
	}

	/**
	 * Get the current GUI parameters.
	 */
	getParams(): DebugGUIParams {
		return this.params;
	}

	/**
	 * Destroy the GUI.
	 */
	destroy(): void {
		this.gui.destroy();
	}
}
