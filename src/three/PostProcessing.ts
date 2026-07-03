import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// Bloom defaults: bright saturated objects (trains, particles) glow like
// fireflies, while the dark map and background stay below the threshold.
const BLOOM_STRENGTH = 1.1;
const BLOOM_RADIUS = 0.65;
const BLOOM_THRESHOLD = 0.18;

/**
 * Post-processing chain: render -> bloom -> output (tone mapping + sRGB).
 * The bloom pass is public so the debug GUI can tune it live.
 */
export class PostProcessing {
	private composer: EffectComposer;
	readonly bloomPass: UnrealBloomPass;

	constructor(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera,
	) {
		this.composer = new EffectComposer(renderer);
		this.composer.setPixelRatio(renderer.getPixelRatio());
		this.composer.addPass(new RenderPass(scene, camera));

		this.bloomPass = new UnrealBloomPass(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
			BLOOM_STRENGTH,
			BLOOM_RADIUS,
			BLOOM_THRESHOLD,
		);
		this.composer.addPass(this.bloomPass);

		this.composer.addPass(new OutputPass());
	}

	render(): void {
		this.composer.render();
	}

	setSize(width: number, height: number): void {
		this.composer.setSize(width, height);
	}
}
