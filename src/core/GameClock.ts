import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { roundToNearestTenSeconds } from "@/utils";

dayjs.extend(utc);

const DEFAULT_SPEED_FACTOR = 450;

/**
 * Manager for the in-game time, triggers events every 10 second mark of the timestamp.
 * Internally uses dayjs objects for all timestamp operations.
 */
export class GameClock {
	private currentTimestamp: dayjs.Dayjs = dayjs();
	private currentRoundedTimestamp: dayjs.Dayjs = dayjs();
	private lastTriggeredTimestamp: dayjs.Dayjs = dayjs();
	private isRunning: boolean = false;
	private listeners: ((timestamp: dayjs.Dayjs) => void)[] = [];

	constructor(timestamp: Date) {
		this.resetTimestamp(dayjs(timestamp));
	}

	resetTimestamp(timestamp: dayjs.Dayjs) {
		this.currentTimestamp = timestamp;
		const roundedTimestamp = roundToNearestTenSeconds(this.currentTimestamp);
		this.currentRoundedTimestamp = roundedTimestamp;
		this.lastTriggeredTimestamp = roundedTimestamp;
	}

	start() {
		this.isRunning = true;
	}

	stop() {
		this.isRunning = false;
	}

	// Called from the render loop
	incrementTime(deltaTime: number, speedFactor: number = DEFAULT_SPEED_FACTOR) {
		if (!this.isRunning) return;

		this.currentTimestamp = this.currentTimestamp.add(
			deltaTime * speedFactor,
			"second",
		);
		this.currentRoundedTimestamp = roundToNearestTenSeconds(
			this.currentTimestamp,
		);

		if (this.currentRoundedTimestamp.isAfter(this.lastTriggeredTimestamp)) {
			this.lastTriggeredTimestamp = this.currentRoundedTimestamp;
			this.listeners.forEach((listener) => {
				listener(this.currentRoundedTimestamp);
			});
		}
	}

	// Formatted timestamp for display in the UI
	getFormattedDateTime(): string {
		return this.currentRoundedTimestamp.format("YYYY-MM-DD HH:mm");
	}

	addEventListener(listener: (timestamp: dayjs.Dayjs) => void) {
		this.listeners.push(listener);
	}

	removeEventListener(listener: (timestamp: dayjs.Dayjs) => void) {
		const index = this.listeners.indexOf(listener);
		if (index !== -1) this.listeners.splice(index, 1);
	}
}
