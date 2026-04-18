import * as dat from "dat.gui";
import dayjs from "dayjs";
import type { TrainManager } from "@/core/TrainManager";
import type { CameraAnimator } from "@/three";
import {
	CAMERA_MOVEMENT_OVERVIEW,
	CAMERA_MOVEMENT_ZOOM_IN,
} from "@/three";

interface DebugGUIParams {
	animationStartHours: number;
	clockSpeedFactor: number;
	cameraTourLooping: boolean;
	startNewAnimation(): void;
	playOverviewCameraTour(): void;
	playZoomInCameraTour(): void;
}

/**
 * Manages dat.gui controls for debugging and parameter adjustment.
 */
export class DebugGUI {
	private gui: dat.GUI;
	private params: DebugGUIParams;

	constructor(trainManager: TrainManager, cameraAnimator: CameraAnimator) {
		this.params = {
			animationStartHours: dayjs().hour() - 1, // default to 1 hour ago
			clockSpeedFactor: 450, // how much faster in-game time runs vs real time
			cameraTourLooping: false,
			startNewAnimation: () => {
				trainManager.newAnimation(
					dayjs().hour(this.params.animationStartHours).minute(0).second(0),
					dayjs(),
					{ loop: true },
				);
			},
			playOverviewCameraTour: () => {
				// Smooth, wide overview movement across the network
				cameraAnimator.setCameraSequence(
					CAMERA_MOVEMENT_OVERVIEW,
					30,
					{ loop: this.params.cameraTourLooping },
				);
			},
			playZoomInCameraTour: () => {
				// Gradual zoom from high-level overview into close-up
				cameraAnimator.setCameraSequence(
					CAMERA_MOVEMENT_ZOOM_IN,
					24,
					{ loop: this.params.cameraTourLooping },
				);
			},
		};

		this.gui = new dat.GUI();
		this.gui
			.add(this.params, "animationStartHours", 0, 23, 1)
			.name("Start Time (hours)");
		this.gui
			.add(this.params, "clockSpeedFactor", 1, 1000, 1)
			.name("Clock Speed Factor");
		this.gui.add(this.params, "startNewAnimation").name("Start New Animation");
		this.gui
			.add(this.params, "cameraTourLooping")
			.name("Loop Camera Tour");
		this.gui
			.add(this.params, "playOverviewCameraTour")
			.name("Camera Tour: Overview");
		this.gui
			.add(this.params, "playZoomInCameraTour")
			.name("Camera Tour: Zoom In");
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
