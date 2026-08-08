import dayjs from "dayjs";
import * as THREE from "three";

export function getRandomPosition(): THREE.Vector3 {
	const x = (Math.random() - 0.5) * 4;
	const z = (Math.random() - 0.5) * 4;
	return new THREE.Vector3(x, 0, z); // using y as height is engine convention
}

// Offset (in km) that centers the map on Amersfoort
const RDS_CENTER_OFFSET = new THREE.Vector3(155, 0, -463);

// Convert the RDS coordinates from API to an ingame vector.
// Writes into `out` when provided, to avoid allocating in hot paths.
export function vectorizeXY(
	x: number,
	y: number,
	out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
	return out
		.set(x, 0, -y) // using y as height is engine convention, trains move in the xz plane
		.divideScalar(1000) // RDS coordinates to kilometers
		.sub(RDS_CENTER_OFFSET); // center on Amersfoort
	// NOTE z axis points down in current orientation, that's why we negate the value
}

export function roundToNearestTenSeconds(timestamp: dayjs.Dayjs): dayjs.Dayjs {
	const roundedTimestamp = Math.round(timestamp.unix() / 10) * 10;
	return dayjs.unix(roundedTimestamp);
}
