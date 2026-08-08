import * as THREE from "three";
import type { CameraKeyframeConfig } from "./CameraSetup";

/**
 * Camera shot the end-of-animation outro slowly glides to: a wide, high overview.
 */
export const CAMERA_OUTRO_TOP: CameraKeyframeConfig = {
	target: new THREE.Vector3(0, 0, 0),
	orbit: {
		cameraDistanceToTarget: 400,
		cameraTilt: 60,
		cameraPan: 0,
		fov: 40,
	},
};

/**
 * Example camera movement presets that can be used to trigger
 * smooth camera tours from the debug UI or other systems.
 */
export const CAMERA_MOVEMENT_OVERVIEW: CameraKeyframeConfig[] = [
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 350,
			cameraTilt: 45,
			cameraPan: 10,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 50),
		orbit: {
			cameraDistanceToTarget: 300,
			cameraTilt: 50,
			cameraPan: -15,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 50),
		orbit: {
			cameraDistanceToTarget: 250,
			cameraTilt: 55,
			cameraPan: 20,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 250,
			cameraTilt: 60,
			cameraPan: -25,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 200,
			cameraTilt: 65,
			cameraPan: 30,
			fov: 40,
		},
	},
];

export const CAMERA_MOVEMENT_ZOOM_IN: CameraKeyframeConfig[] = [
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 350,
			cameraTilt: 45,
			cameraPan: 0,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(30, 0, 50),
		orbit: {
			cameraDistanceToTarget: 350,
			cameraTilt: 45,
			cameraPan: 0,
			fov: 10,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 350,
			cameraTilt: 45,
			cameraPan: 0,
			fov: 40,
		},
	},
	{
		target: new THREE.Vector3(-30, 0, -25),
		orbit: {
			cameraDistanceToTarget: 350,
			cameraTilt: 45,
			cameraPan: 0,
			fov: 10,
		},
	},
];
