import { EffectComposer, RenderPass, EffectPass } from "postprocessing";
import { CanvasProps } from "../types";

import { ThreeCanvas } from "../motion-canvas-3d";
import GammaCorrectionEffect from "./GammaCorrectionEffect";

import { N8AOPostPass } from "n8ao";

import * as THREE from "three";

export default class ThreeCanvasWithPostProcessing extends ThreeCanvas {
	public composer: EffectComposer;
	public gammaCorrectionEffect: GammaCorrectionEffect;

	constructor(props: CanvasProps) {
		super(props);

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(new RenderPass(this.threeScene, this.threeCamera));

		const n8aoPass = new N8AOPostPass(this.threeScene, this.threeCamera, {
			resolutionScale: 1.0,
			blurRadius: 0.5,
			distanceThreshold: 0.01,
			normalThreshold: 0.1,
		});
		this.composer.addPass(n8aoPass);

		this.gammaCorrectionEffect = new GammaCorrectionEffect(1);
		const effectPass = new EffectPass(
			this.threeCamera,
			this.gammaCorrectionEffect
		);
		this.composer.addPass(effectPass);
	}

	render(context: CanvasRenderingContext2D): void {
		for (const obj of [this.camera, ...this.objects]) {
			obj.update();
		}

		this.composer.render();

		context.drawImage(
			this.canvas,
			this.position.x() - this.canvas.width / 2,
			this.position.y() - this.canvas.height / 2
		);
	}

	public setBackgroundColor(color: number): void {
		this.threeScene.background = new THREE.Color(color);
	}
}
