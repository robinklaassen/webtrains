export { AmbientParticles } from "./AmbientParticles";
export { setupAtmosphere } from "./Atmosphere";
export {
	CAMERA_MOVEMENT_OVERVIEW,
	CAMERA_MOVEMENT_ZOOM_IN,
	CAMERA_OUTRO_TOP,
} from "./CameraPresets";
export {
	CameraAnimator,
	type CameraKeyframeConfig,
	type CameraOrbitParameters,
	computeCameraPositionFromTarget,
	createCamera,
	lerpVector3,
} from "./CameraSetup";
export { setupLighting } from "./LightingSetup";
export { PostProcessing } from "./PostProcessing";
export { RendererSetup } from "./RendererSetup";
export { createScene } from "./SceneBuilder";
export { addSvgBackground } from "./SVGBackground";
