import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const speedFactor = 450;

export class GameClock {
	timestamp: dayjs.Dayjs;
	private listeners: ((timestamp: dayjs.Dayjs) => void)[] = [];
	private lastTriggeredSecondMark: number;

	constructor(timestamp: Date) {
		this.timestamp = dayjs(timestamp);
		this.lastTriggeredSecondMark = this.getSecondMark();
	}

	private getSecondMark(): number {
		const seconds = this.timestamp.second();
		return Math.floor(seconds / 10) * 10;
	}

	private getRoundedTimestamp(): dayjs.Dayjs {
		return this.timestamp.second(this.lastTriggeredSecondMark);
	}

	incrementTime(deltaTime: number) {
		this.timestamp = this.timestamp.add(deltaTime * speedFactor, "second");
		const currentMark = this.getSecondMark();
		if (currentMark !== this.lastTriggeredSecondMark) {
			this.lastTriggeredSecondMark = currentMark;
			const roundedTime = this.getRoundedTimestamp();
			this.listeners.forEach((listener) => {
				listener(roundedTime);
			});
		}
	}

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
