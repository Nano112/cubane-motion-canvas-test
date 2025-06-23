import { SimpleSignal, createSignal } from "@motion-canvas/core/lib/signals";
import {
	ThreeCanvas,
	axisAngle,
	SignalableObject3D,
} from "../motion-canvas-3d";

import * as THREE from "three";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { Cubane } from "cubane";

export default class Piston {
	public extension: SimpleSignal<number, void>;
	private pistonBody: SignalableObject3D;
	private pistonHeadShort: SignalableObject3D;
	private pistonHeadNormal: SignalableObject3D;
	private canvas: ThreeCanvasWithPostProcessing;

	private constructor(
		canvas: ThreeCanvasWithPostProcessing,
		bodyMesh: THREE.Object3D,
		shortHeadMesh: THREE.Object3D,
		normalHeadMesh: THREE.Object3D
	) {
		this.canvas = canvas;
		this.extension = createSignal<number>(0);

		[this.pistonBody] = canvas.push(bodyMesh);
		[this.pistonHeadShort] = canvas.push(shortHeadMesh);
		[this.pistonHeadNormal] = canvas.push(normalHeadMesh);

		// Set initial visibility
		this.pistonHeadShort.object.visible = true;
		this.pistonHeadNormal.object.visible = false;

		// Add this piston to canvas objects for automatic updates
		canvas.addDynamicObject({
			position: createSignal([0, 0, 0]),
			scale: createSignal([1, 1, 1]),
			quaternion: createSignal([0, 0, 0, 1]),
			lookAt: createSignal(undefined),
			object: new THREE.Object3D(),
			update: () => this.update(),
		});
	}

	public static async create(
		canvas: ThreeCanvasWithPostProcessing,
		cubane: Cubane,
		type: "sticky" | "regular" = "regular"
	) {
		const blockType = type === "sticky" ? "sticky_piston" : "piston";
		const headType = type === "sticky" ? "sticky" : "normal";
		const [bodyMesh, shortHeadMesh, normalHeadMesh] = await Promise.all([
			cubane.getBlockMesh(`minecraft:${blockType}[facing=east,extended=true]`),
			cubane.getBlockMesh(
				`minecraft:piston_head[extended=true,facing=east,short=true,type=${headType}]`
			),
			cubane.getBlockMesh(
				`minecraft:piston_head[extended=true,facing=east,short=false,type=${headType}]`
			),
		]);
		return new Piston(canvas, bodyMesh, shortHeadMesh, normalHeadMesh);
	}

	// Set the piston's base position
	position(pos: [number, number, number]) {
		this.pistonBody.position(pos);
		this.update(); // Update head positions immediately
	}

	// Set the piston's rotation
	quaternion(quat: [number, number, number, number]) {
		this.pistonBody.quaternion(quat);
		this.pistonHeadShort.quaternion(quat);
		this.pistonHeadNormal.quaternion(quat);
	}

	// Internal update method called automatically
	private update() {
		const ext = this.extension();
		const basePos = this.pistonBody.position();

		// Calculate head position based on extension
		const headPos: [number, number, number] = [
			basePos[0] + ext,
			basePos[1],
			basePos[2],
		];

		// Update both head positions
		this.pistonHeadShort.position(headPos);
		this.pistonHeadNormal.position(headPos);

		// Handle mesh switching at 0.25 blocks
		if (ext >= 0.25) {
			this.pistonHeadShort.object.visible = false;
			this.pistonHeadNormal.object.visible = true;
		} else {
			this.pistonHeadShort.object.visible = true;
			this.pistonHeadNormal.object.visible = false;
		}
	}
}
