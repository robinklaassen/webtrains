import * as dat from "dat.gui";
import dayjs from "dayjs";
import type { TrainManager } from "@/core/TrainManager";

interface DebugGUIParams {
	animationStartHours: number;
	clockSpeedFactor: number;
	startNewAnimation(): void;
}

/**
 * Manages dat.gui controls for debugging and parameter adjustment.
 */
export class DebugGUI {
	private gui: dat.GUI;
	private params: DebugGUIParams;

	constructor(trainManager: TrainManager) {
		this.params = {
			animationStartHours: dayjs().hour() - 1, // default to 1 hour ago
			clockSpeedFactor: 450, // how much faster in-game time runs vs real time
			startNewAnimation: () => {
				trainManager.newAnimation(
					dayjs().hour(this.params.animationStartHours).minute(0).second(0),
					dayjs(),
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
