/**
 * Manages UI element updates: clock display, status, train count.
 * Keeps DOM manipulation centralized and separate from game logic.
 */
export class UIManager {
	private clockElement: HTMLElement | null;
	private statusElement: HTMLElement | null;
	private trainCountElement: HTMLElement | null;
	private sceneObjectCountElement: HTMLElement | null;

	constructor() {
		this.clockElement = document.getElementById("clock");
		this.statusElement = document.getElementById("status");
		this.trainCountElement = document.getElementById("train-count");
		this.sceneObjectCountElement =
			document.getElementById("scene-object-count");
	}

	/**
	 * Update the clock display with formatted date/time.
	 */
	updateClock(formattedDateTime: string): void {
		if (this.clockElement) {
			this.clockElement.textContent = formattedDateTime;
		}
	}

	/**
	 * Update the status display.
	 */
	updateStatus(status: string): void {
		if (this.statusElement) {
			this.statusElement.textContent = `Status: ${status}`;
		}
	}

	/**
	 * Update the train count display.
	 */
	updateTrainCount(count: number): void {
		if (this.trainCountElement) {
			this.trainCountElement.textContent = `Train count: ${count}`;
		}
	}

	/**
	 * Update the scene object count display.
	 */
	updateSceneObjectCount(count: number): void {
		if (this.sceneObjectCountElement) {
			this.sceneObjectCountElement.textContent = `Scene object count: ${count}`;
		}
	}
}
