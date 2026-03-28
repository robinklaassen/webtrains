import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const speedFactor = 450;

/**
 * Manager for the in-game time, triggers events every 10 second mark of the timestamp.
 * Internally uses dayjs objects for all timestamp operations.
 */
export class GameClock {
	// TODO clock should be able to start/stop, and not continue running when animation is not playing and/or timestamp exceeds the real current time
	private timestamp: dayjs.Dayjs;
	private listeners: ((timestamp: dayjs.Dayjs) => void)[] = [];
	private lastTriggeredSecondMark: number;

	constructor(timestamp: Date) {
		this.timestamp = dayjs(timestamp);
		this.lastTriggeredSecondMark = this.getSecondMark();
	}

	setTimestamp(newTimestamp: dayjs.Dayjs) {
		this.timestamp = newTimestamp;
		this.lastTriggeredSecondMark = this.getSecondMark();
	}

	private getSecondMark(): number {
		const seconds = this.timestamp.second();
		return Math.floor(seconds / 10) * 10;
	}

	private getRoundedTimestamp(): dayjs.Dayjs {
		return this.timestamp.second(this.lastTriggeredSecondMark);
	}

	// Called from the render loop
	incrementTime(deltaTime: number) {
		this.timestamp = this.timestamp.add(deltaTime * speedFactor, "second");
		this.checkSecondMarkPassed();
	}

	// Checks if we've passed a new 10-second mark and triggers listeners if so
	checkSecondMarkPassed() {
		const currentMark = this.getSecondMark();
		if (currentMark !== this.lastTriggeredSecondMark) {
			this.lastTriggeredSecondMark = currentMark;
			const roundedTime = this.getRoundedTimestamp();
			this.listeners.forEach((listener) => {
				listener(roundedTime);
			});
		}
	}

	// Formatted timestamp for display in the UI
	getFormattedDateTime(): string {
		return this.timestamp.format("YYYY-MM-DD HH:mm");
	}

	addEventListener(listener: (timestamp: dayjs.Dayjs) => void) {
		this.listeners.push(listener);
	}

	removeEventListener(listener: (timestamp: dayjs.Dayjs) => void) {
		const index = this.listeners.indexOf(listener);
		if (index !== -1) this.listeners.splice(index, 1);
	}
}
