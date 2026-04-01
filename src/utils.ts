import dayjs from "dayjs";
import * as THREE from "three";

export function getRandomPosition(): THREE.Vector3 {
	const x = (Math.random() - 0.5) * 4;
	const z = (Math.random() - 0.5) * 4;
	return new THREE.Vector3(x, 0, z); // using y as height is engine convention
}

// Convert the RDS coordinates from API to an ingame vector
export function vectorizeXY(x: number, y: number): THREE.Vector3 {
	return new THREE.Vector3(x, 0, -y) // using y as height is engine convention, trains move in the xz plane
		.divideScalar(1000) // RDS coordinates to kilometers
		.sub(new THREE.Vector3(155, 0, -463)); // center on Amersfoort
	// NOTE z axis points down in current orientation, that's why we negate the value
}

export function roundToNearestTenSeconds(timestamp: dayjs.Dayjs): dayjs.Dayjs {
	const roundedTimestamp = Math.round(timestamp.unix() / 10) * 10;
	return dayjs.unix(roundedTimestamp);
}
