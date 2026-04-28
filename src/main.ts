import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// Game systems
import { TrainManager } from "@/core/TrainManager";
// Three.js setup
import {
	addSvgBackground,
	CameraAnimator,
	createCamera,
	createScene,
	RendererSetup,
	setupLighting,
} from "@/three";
// UI setup
import { DebugGUI, UIManager } from "@/ui";
import { MATERIAL_COLOR_MAP } from "./components/Train";
import { GameClock } from "./core/GameClock";
import { TrainCache } from "./core/TrainCache";
import { TrainDataProvider } from "./core/TrainDataProvider";

// ============================================================================
// THREE.JS SETUP
// ============================================================================

const scene = createScene();
const camera = createCamera();
setupLighting(scene);
const cameraAnimator = new CameraAnimator(camera, new THREE.Vector3(0, 0, 0));
addSvgBackground(scene);

const rendererSetup = new RendererSetup();
rendererSetup.initialize(scene, camera, animate);

// Add camera controls
new OrbitControls(camera, rendererSetup.getRenderer().domElement);

// Timer used to track time between frames for smooth animation
const timer = new THREE.Timer();
timer.connect(document);

// ============================================================================
// GAME SYSTEMS
// ============================================================================

const gameClock = new GameClock(new Date());
const trainCache = new TrainCache(new TrainDataProvider());
const trainManager = new TrainManager(scene, gameClock, trainCache);

// ============================================================================
// UI SETUP
// ============================================================================

const uiManager = new UIManager();
const debugGUI = new DebugGUI(trainManager, cameraAnimator);

// Automatically start an animation on load
debugGUI.getParams().startNewAnimation();

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
	timer.update();
	render();
}

function render() {
	const deltaTime = timer.getDelta();
	const guiParams = debugGUI.getParams();

	// Update camera animation
	cameraAnimator.update(deltaTime);

	// Update game systems
	trainManager.update(deltaTime, guiParams.clockSpeedFactor);
	gameClock.incrementTime(deltaTime, guiParams.clockSpeedFactor);

	// Update UI
	uiManager.updateClock(gameClock.getFormattedDateTime());
	uiManager.updateStatus(trainManager.status);
	uiManager.updateTrainCount(trainManager.getTrainCount());
	uiManager.updateSceneObjectCount(scene.children.length);

	// Render
	rendererSetup.render(scene, camera);
}

// setup legend once, no need to update it every frame
const legendText = Object.entries(MATERIAL_COLOR_MAP)
	.map(([material, color]) => {
		const hexColor = `#${color.toString(16).padStart(6, "0")}`;
		return `<span style="color: ${hexColor}">${material}</span>`;
	})
	.join("<br/>");
uiManager.updateLegend(legendText);
