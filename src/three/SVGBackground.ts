import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

const BACKGROUND_SVG_URL = new URL(
	"../assets/images/nederland.svg",
	import.meta.url,
).href;
const BACKGROUND_MESH_COLOR = "#10204e"; // deep night blue for the SVG map, below the bloom threshold
const BACKGROUND_SCALE = 0.38; // scale factor for the SVG background mesh
const BACKGROUND_POSITION = new THREE.Vector3(-10, 0, -1); // position for the SVG background mesh

/** Adds the Nederland SVG as a background on the XZ plane. */
export function addSvgBackground(scene: THREE.Scene): void {
	const loader = new SVGLoader();

	loader.load(
		BACKGROUND_SVG_URL,
		(data) => {
			const group = new THREE.Group();

			// All paths share one material (same color for the whole map)
			const material = new THREE.MeshBasicMaterial({
				color: new THREE.Color(BACKGROUND_MESH_COLOR),
				transparent: false,
				side: THREE.DoubleSide,
			});

			for (const path of data.paths) {
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

			group.rotation.x = -Math.PI / 2;
			group.scale.set(BACKGROUND_SCALE, -BACKGROUND_SCALE, BACKGROUND_SCALE);

			group.position.copy(BACKGROUND_POSITION);

			scene.add(group);
		},
		undefined,
		(error) => {
			console.error("Failed to load SVG background:", error);
		},
	);
}
