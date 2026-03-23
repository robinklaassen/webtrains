import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TrainManager } from "@/core/TrainManager";
import { GameClock } from "./core/GameClock";

const scene = new THREE.Scene();

// set up the camera
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	1000,
);
camera.position.z = 2.5;

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
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const timer = new THREE.Timer();
timer.connect(document);

const gameClock = new GameClock(new Date());

const trainManager = new TrainManager(scene, gameClock);

const infoElement = document.getElementById("info");

function animate() {
	timer.update();
	render();
}

function render() {
	const deltaTime = timer.getDelta();
	gameClock.incrementTime(deltaTime);

	if (infoElement) {
		infoElement.textContent = gameClock.getFormattedDateTime();
	}

	trainManager.update(deltaTime);

	renderer.render(scene, camera);
}
