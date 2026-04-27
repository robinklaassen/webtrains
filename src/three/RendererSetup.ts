import * as THREE from "three";

interface RendererConfig {
	pixelRatio?: number;
}

/**
 * Manages the Three.js WebGL renderer and its lifecycle.
 * Handles initialization, resizing, and cleanup.
 */
export class RendererSetup {
	private renderer: THREE.WebGLRenderer;
	private camera!: THREE.PerspectiveCamera;
	private onResizeCallback: (() => void) | null = null;

	constructor(config: RendererConfig = {}) {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(config.pixelRatio ?? window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setClearColor("#143D73");

		// Add event listener for window resize
		window.addEventListener("resize", () => this.handleResize());
	}

	/**
	 * Complete initialization: append to DOM and set up animation loop.
	 */
	initialize(
		_scene: THREE.Scene,
		camera: THREE.PerspectiveCamera,
		animationLoop: FrameRequestCallback,
	): void {
		this.camera = camera;
		document.body.appendChild(this.renderer.domElement);
		this.renderer.setAnimationLoop(animationLoop);
	}

	/**
	 * Render the scene.
	 */
	render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
		this.renderer.render(scene, camera);
	}

	/**
	 * Handle window resize events.
	 */
	private handleResize(): void {
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);

		if (this.onResizeCallback) {
			this.onResizeCallback();
		}
	}

	/**
	 * Register a callback to be called on window resize.
	 */
	onResize(callback: () => void): void {
		this.onResizeCallback = callback;
	}

	/**
	 * Get the underlying Three.js renderer.
	 */
	getRenderer(): THREE.WebGLRenderer {
		return this.renderer;
	}

	/**
	 * Dispose of the renderer and clean up resources.
	 */
	dispose(): void {
		this.renderer.dispose();
		window.removeEventListener("resize", () => this.handleResize());
	}
}
