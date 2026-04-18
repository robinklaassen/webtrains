import * as THREE from "three";
import type { CameraKeyframeConfig } from "./CameraSetup";

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
			cameraPan: 0,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 50),
		orbit: {
			cameraDistanceToTarget: 300,
			cameraTilt: 45,
			cameraPan: -10,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 50),
		orbit: {
			cameraDistanceToTarget: 250,
			cameraTilt: 45,
			cameraPan: 25,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 250,
			cameraTilt: 60,
			cameraPan: -25,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 30),
		orbit: {
			cameraDistanceToTarget: 200,
			cameraTilt: 60,
			cameraPan: 25,
		},
	},
];

export const CAMERA_MOVEMENT_ZOOM_IN: CameraKeyframeConfig[] = [
	{
		target: new THREE.Vector3(0, 0, 0),
		orbit: {
			cameraDistanceToTarget: 850,
			cameraTilt: 80,
			cameraPan: 0,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 0),
		orbit: {
			cameraDistanceToTarget: 550,
			cameraTilt: 55,
			cameraPan: 40,
		},
	},
	{
		target: new THREE.Vector3(0, 0, 0),
		orbit: {
			cameraDistanceToTarget: 260,
			cameraTilt: 35,
			cameraPan: 85,
		},
	},
];

