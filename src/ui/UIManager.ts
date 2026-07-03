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
	// Per-material count elements in the legend, keyed by material
	private legendCountElements = new Map<TrainMaterial, HTMLElement>();

	constructor() {
		this.clockElement = document.getElementById("clock");
		this.statusElement = document.getElementById("status");
		this.trainCountElement = document.getElementById("train-count");
		this.legendElement = document.getElementById("legend");
		this.sceneObjectCountElement =
			document.getElementById("scene-object-count");
	}

	/**
	 * Write text to an element, skipping the DOM mutation when unchanged.
	 * The update methods below are called every frame from the render loop.
	 */
	private static setText(element: HTMLElement | null, text: string): void {
		if (element && element.textContent !== text) {
			element.textContent = text;
		}
	}

	/**
	 * Update the clock display with formatted date/time.
	 */
	updateClock(formattedDateTime: string): void {
		UIManager.setText(this.clockElement, formattedDateTime);
	}

	/**
	 * Update the status display.
	 */
	updateStatus(status: string | TrainAnimationStatus): void {
		UIManager.setText(this.statusElement, `Status: ${status}`);
	}

	/**
	 * Update the train count display.
	 */
	updateTrainCount(count: number): void {
		UIManager.setText(this.trainCountElement, `Train count: ${count}`);
	}

	/**
	 * Update the scene object count display.
	 */
	updateSceneObjectCount(count: number): void {
		UIManager.setText(
			this.sceneObjectCountElement,
			`Scene object count: ${count}`,
		);
	}

	/**
	 * Build the legend: one clickable colored entry per material, each showing a
	 * live train count next to the name. Clicking an entry toggles that
	 * material's visibility. Call once at startup.
	 * @param colorMap - Material -> hex color used for the trains.
	 * @param trainManager - Reference to TrainManager for toggling visibility.
	 */
	buildLegend(
		colorMap: Record<TrainMaterial, number>,
		trainManager: TrainManager,
	): void {
		if (!this.legendElement) return;
		this.legendElement.innerHTML = "";
		this.legendCountElements.clear();

		for (const [material, color] of Object.entries(colorMap) as [
			TrainMaterial,
			number,
		][]) {
			const hexColor = `#${color.toString(16).padStart(6, "0")}`;

			const entry = document.createElement("div");
			entry.className = "legend-entry";
			entry.dataset.material = material;
			entry.style.color = hexColor;

			const name = document.createElement("span");
			name.className = "legend-name";
			name.textContent = material;

			const count = document.createElement("span");
			count.className = "legend-count";
			count.textContent = "0";

			entry.append(name, document.createTextNode(" "), count);
			entry.addEventListener("click", (event) => {
				trainManager.toggleMaterialVisibility(material);
				this.refreshLegendVisibility(trainManager);
				event.stopPropagation();
			});

			this.legendElement.appendChild(entry);
			this.legendCountElements.set(material, count);
		}

		this.refreshLegendVisibility(trainManager);
	}

	/**
	 * Update the per-material train counts shown in the legend.
	 * Called every frame from the render loop.
	 */
	updateLegendCounts(counts: Map<TrainMaterial, number>): void {
		this.legendCountElements.forEach((element, material) => {
			UIManager.setText(element, String(counts.get(material) ?? 0));
		});
	}

	/**
	 * Update the strikethrough style of every legend entry based on its
	 * material's current visibility.
	 * @param trainManager - Reference to TrainManager.
	 */
	private refreshLegendVisibility(trainManager: TrainManager): void {
		if (!this.legendElement) return;
		this.legendElement
			.querySelectorAll<HTMLElement>(".legend-entry")
			.forEach((entry) => {
				const material = entry.dataset.material as TrainMaterial | undefined;
				if (!material) return;
				if (trainManager.isMaterialVisible(material)) {
					entry.classList.remove("legend-hidden");
				} else {
					entry.classList.add("legend-hidden");
				}
			});
	}
}
