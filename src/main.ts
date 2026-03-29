import "./style.css";
import * as dat from "dat.gui";
import dayjs from "dayjs";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TrainManager } from "@/core/TrainManager";
import { GameClock } from "./core/GameClock";
import { TrainCache } from "./core/TrainCache";
import { TrainDataProvider } from "./core/TrainDataProvider";

// TODO separate scaffolding (scene, camera, renderer setup) from the main application logic (managing game clock, train manager, etc.) for better maintainability and readability
const scene = new THREE.Scene();

// set up the camera
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	10000,
);
// Position camera to view the Dutch train region (Rijksdriehoek coordinates)
// TODO fix camera position and orientation above Dutch boundaries
camera.position.set(0, 150, 0);
camera.lookAt(0, 0, 0);

// set up the renderer and add it to the DOM
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// this allows controlling the camera with mouse drag and zoom
new OrbitControls(camera, renderer.domElement);

// set up some basic lighting
// TODO fix light positions
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(150, 150, 150);
scene.add(directionalLight);

// Add debug helpers to visualize the scene
// const axesHelper = new THREE.AxesHelper(50);
// scene.add(axesHelper);
const gridHelper = new THREE.GridHelper(600, 60, 0x444444, 0x222222);
scene.add(gridHelper);

// timer used to track time between frames for smooth animation
const timer = new THREE.Timer();
timer.connect(document);

const gameClock = new GameClock(new Date());
const trainCache = new TrainCache(new TrainDataProvider());
const trainManager = new TrainManager(scene, gameClock, trainCache);

const animationStartHours = dayjs().hour() - 1; // default to 1 hour ago, can be changed via dat.gui
const clockSpeedFactor = 450; // how much faster the in-game time should run compared to real time, can be changed via dat.gui in the future

// Set up dat.gui controls
const guiParams = {
	animationStartHours,
	clockSpeedFactor,
	startNewAnimation() {
		trainManager.newAnimation(
			dayjs().hour(guiParams.animationStartHours).minute(0).second(0),
			dayjs(),
		);
	},
};

const gui = new dat.GUI();
gui.add(guiParams, "animationStartHours", 0, 23, 1).name("Start Time (hours)");
gui.add(guiParams, "clockSpeedFactor", 1, 1000, 1).name("Clock Speed Factor");
gui.add(guiParams, "startNewAnimation").name("Start New Animation");

// TODO info element now only contains ingame time, add a status element to the UI to show loading, playing, stopped etc. and maybe current ingame train count
const infoElement = document.getElementById("info");

function animate() {
	timer.update();
	render();
}

function render() {
	const deltaTime = timer.getDelta();
	trainManager.update(deltaTime, guiParams.clockSpeedFactor);
	gameClock.incrementTime(deltaTime, guiParams.clockSpeedFactor);

	if (infoElement) {
		infoElement.textContent = gameClock.getFormattedDateTime();
	}

	renderer.render(scene, camera);
}
