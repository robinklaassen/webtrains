import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TrainEffects } from "@/components/TrainEffects";
import { TrainParticles } from "@/components/TrainParticles";
// Game systems
import { TrainManager } from "@/core/TrainManager";
// Three.js setup
import {
	AmbientParticles,
	addSvgBackground,
	CAMERA_OUTRO_TOP,
	CameraAnimator,
	createCamera,
	createScene,
	PostProcessing,
	RendererSetup,
	setupAtmosphere,
	setupLighting,
} from "@/three";
// UI setup
import { DebugGUI, UIManager } from "@/ui";
import { MATERIAL_COLOR_MAP } from "./components/TrainInstances";
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
const sceneFog = setupAtmosphere(scene);
const ambientParticles = new AmbientParticles(scene);
// Temporarily off by default: the train-emitted trails are the focus, and the
// free-floating ambient dust made them hard to distinguish. Toggle in the GUI.
ambientParticles.setVisible(false);

const rendererSetup = new RendererSetup();
rendererSetup.initialize(scene, camera, animate);

// Post-processing (bloom) renders the scene instead of the plain renderer
const postProcessing = new PostProcessing(
	rendererSetup.getRenderer(),
	scene,
	camera,
);
rendererSetup.onResize(() => {
	postProcessing.setSize(window.innerWidth, window.innerHeight);
});

// Camera controls: the user can grab the camera at any time. Starting an
// interaction hands control from the automatic animator to OrbitControls; a
// Camera Tour button (in the debug GUI) hands it back.
const controls = new OrbitControls(
	camera,
	rendererSetup.getRenderer().domElement,
);
controls.enableDamping = true;
// Zoom towards the cursor, so you can zoom into any part of the map (e.g. the
// far north while viewing from the south) instead of only the orbit centre.
controls.zoomToCursor = true;
// Keep the camera above the ground plane — it can tilt down to the horizon but
// not through it.
controls.maxPolarAngle = Math.PI / 2;
controls.addEventListener("start", () => {
	// Hand off only on the first grab (auto -> manual): sync the orbit target to
	// whatever the animator was looking at for a seamless handoff. On later
	// drags the animator is already off, so leave OrbitControls' own target
	// alone — re-syncing it to the animator's stale target would jump the camera.
	if (cameraAnimator.isEnabled()) {
		controls.target.copy(cameraAnimator.getTarget());
		cameraAnimator.setEnabled(false);
	}
});

// Timer used to track time between frames for smooth animation
const timer = new THREE.Timer();
timer.connect(document);

// ============================================================================
// GAME SYSTEMS
// ============================================================================

const gameClock = new GameClock(new Date());
const trainCache = new TrainCache(new TrainDataProvider());
const trainEffects = new TrainEffects(scene, camera);
const trainParticles = new TrainParticles(scene, camera);
const trainManager = new TrainManager(
	scene,
	camera,
	gameClock,
	trainCache,
	trainEffects,
	trainParticles,
);

// The outro slowly glides the camera to a wide overview shot (duration comes
// from the TrainManager outro timeline). Using setTargetWithOrbit rather than a
// sequence lets the looping tour resume once the outro is done.
trainManager.onOutroCameraMove = (durationSeconds) => {
	cameraAnimator.setTargetWithOrbit(
		CAMERA_OUTRO_TOP.target,
		CAMERA_OUTRO_TOP.orbit,
		durationSeconds,
	);
};

// ============================================================================
// UI SETUP
// ============================================================================

const uiManager = new UIManager();
const debugGUI = new DebugGUI(trainManager, cameraAnimator, {
	bloomPass: postProcessing.bloomPass,
	fog: sceneFog,
	particles: ambientParticles,
	effects: trainEffects,
});

// Automatically start an animation and a looping overview camera tour on load
debugGUI.getParams().startNewAnimation();
debugGUI.getParams().playOverviewCameraTour();

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

	// Camera: the automatic animator drives it unless the user has taken control
	// via OrbitControls.
	if (cameraAnimator.isEnabled()) {
		cameraAnimator.update(deltaTime);
	} else {
		controls.update();
	}

	// Update game systems
	trainManager.update(deltaTime, guiParams.clockSpeedFactor);
	gameClock.incrementTime(deltaTime, guiParams.clockSpeedFactor);

	// Update atmosphere and effects (real time, also while paused/loading)
	ambientParticles.update(deltaTime, timer.getElapsed());
	trainEffects.update(deltaTime);
	trainParticles.update(deltaTime);

	// Update UI
	debugGUI.updateFps(deltaTime);
	uiManager.updateClock(gameClock.getFormattedDateTime());
	uiManager.updateStatus(trainManager.status);
	uiManager.updateTrainCount(trainManager.getTrainCount());
	uiManager.updateLegendCounts(trainManager.getCountsByMaterial());
	uiManager.updateSceneObjectCount(scene.children.length);

	// Render with post-processing (bloom)
	postProcessing.render();
}

// Build the legend once (colored, clickable entries with live per-material
// counts); the counts themselves are refreshed every frame in render().
uiManager.buildLegend(MATERIAL_COLOR_MAP, trainManager);
