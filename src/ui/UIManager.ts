import type { TrainManager } from "@/core/TrainManager";
import type { TrainAnimationStatus, TrainMaterial } from "@/models";

/**
 * Manages UI element updates: clock display, status, train count.
 * Keeps DOM manipulation centralized and separate from game logic.
 */
export class UIManager {
	private clockElement: HTMLElement | null;
	private statusElement: HTMLElement | null;
	private trainCountElement: HTMLElement | null;
	private sceneObjectCountElement: HTMLElement | null;
	private legendElement: HTMLElement | null;

	constructor() {
		this.clockElement = document.getElementById("clock");
		this.statusElement = document.getElementById("status");
		this.trainCountElement = document.getElementById("train-count");
		this.legendElement = document.getElementById("legend");
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
	updateStatus(status: string | TrainAnimationStatus): void {
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

	/**
	 * Update the legend display with train type/material color info.
	 */
	updateLegend(legendText: string): void {
		if (this.legendElement) {
			this.legendElement.innerHTML = legendText;
		}
	}

	/**
	 * Set up click listeners on legend material spans to toggle visibility.
	 * Adds visual feedback for hidden materials.
	 * @param trainManager - Reference to TrainManager for toggling visibility
	 */
	setupMaterialToggleListeners(trainManager: TrainManager): void {
		if (!this.legendElement) return;

		const spans = this.legendElement.querySelectorAll("span");
		spans.forEach((span) => {
			span.style.cursor = "pointer";
			span.addEventListener("click", (e) => {
				const material = span.textContent?.trim() as TrainMaterial;
				if (!material) return;

				// Toggle visibility in train manager
				trainManager.toggleMaterialVisibility(material);

				// Update visual feedback
				const hiddenMaterials = trainManager.getHiddenMaterials();
				if (hiddenMaterials.has(material)) {
					span.classList.add("legend-hidden");
				} else {
					span.classList.remove("legend-hidden");
				}

				e.stopPropagation();
			});
		});
	}
}
