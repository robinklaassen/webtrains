import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/** Adds the Nederland SVG as a background on the XZ plane. */
export function addSvgBackground(scene: THREE.Scene): void {
	const loader = new SVGLoader();

	const url = new URL(
		"../assets/images/nederland.svg",
		import.meta.url,
	).href;

	loader.load(
		url,
		(data) => {
			const group = new THREE.Group();

			for (const path of data.paths) {
				const material = new THREE.MeshBasicMaterial({
					color: new THREE.Color("#194C8F"),
					transparent: false,
					side: THREE.DoubleSide,
				});

				const shapes = SVGLoader.createShapes(path);
				for (const shape of shapes) {
					const geometry = new THREE.ShapeGeometry(shape);
					const mesh = new THREE.Mesh(geometry, material);
					group.add(mesh);
				}
			}

			group.updateMatrixWorld(true);
			const box = new THREE.Box3().setFromObject(group);
			const center = box.getCenter(new THREE.Vector3());
			for (const child of group.children) {
				child.position.sub(center);
			}

			// Rotate from XY into XZ (y = height)
			group.rotation.x = -Math.PI / 2;

			const SCALE = 0.4;

			// Mirror along Y to flip vertically
			group.scale.set(SCALE, -SCALE, SCALE);

			group.position.y = 0.1;
			group.position.x = 0;
			group.position.z = -10;

			group.renderOrder = -10;

			scene.add(group);
		},
		undefined,
		(error) => {
			console.error("Failed to load SVG background:", error);
		},
	);
}
