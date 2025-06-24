import { SimpleSignal, createSignal } from "@motion-canvas/core/lib/signals";
import { SignalableObject3D } from "../motion-canvas-3d";
import * as THREE from "three";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { WorldGrid } from "./WorldGrid";
import { Cubane } from "cubane";

export class Block {
	protected canvas: ThreeCanvasWithPostProcessing;
	protected world: WorldGrid;
	protected signalableObject: SignalableObject3D;

	public gridPosition: [number, number, number];
	public worldPosition: SimpleSignal<[number, number, number], void>;
	public isMoving: boolean = false;
	public readonly blockType: string;

	constructor(
		canvas: ThreeCanvasWithPostProcessing,
		world: WorldGrid,
		mesh: THREE.Object3D,
		blockType: string,
		initialGridPosition: [number, number, number]
	) {
		this.canvas = canvas;
		this.world = world;
		this.blockType = blockType;
		this.gridPosition = [...initialGridPosition];
		this.worldPosition =
			createSignal<[number, number, number]>(initialGridPosition);

		[this.signalableObject] = canvas.push(mesh);
		this.signalableObject.position(this.worldPosition);

		// Register with world grid upon creation
		this.world.setBlock(
			initialGridPosition[0],
			initialGridPosition[1],
			initialGridPosition[2],
			this
		);
	}

	public static async create(
		canvas: ThreeCanvasWithPostProcessing,
		world: WorldGrid,
		cubane: Cubane,
		blockType: string,
		initialGridPosition: [number, number, number]
	): Promise<Block> {
		const mesh = await cubane.getBlockMesh(blockType);
		return new Block(canvas, world, mesh, blockType, initialGridPosition);
	}

	public canBePushed(): boolean {
		return !this.isMoving;
	}

	/**
	 * Sets the block's definitive grid position.
	 * This is the ONLY function that should update the WorldGrid.
	 * It should only be called at the END of a movement.
	 */
	public setPosition(gridPos: [number, number, number]): void {
		const oldPos = [...this.gridPosition];

		// If the position hasn't changed, do nothing.
		if (
			oldPos[0] === gridPos[0] &&
			oldPos[1] === gridPos[1] &&
			oldPos[2] === gridPos[2]
		) {
			return;
		}

		console.log(
			`📍 Block ${this.blockType} moving from grid [${this.gridPosition}] to grid [${gridPos}]`
		);

		// Update the source of truth
		this.world.moveBlock(oldPos, gridPos);

		// Update our internal state
		this.gridPosition = [...gridPos];
		this.worldPosition(gridPos); // Snap visual position to the grid
	}

	public getWorldPosition(): [number, number, number] {
		return this.worldPosition();
	}

	/**
	 * Sets the block's visual world position during animation.
	 * CRITICAL: This does NOT update the WorldGrid. It only moves the mesh.
	 */
	public setWorldPosition(worldPos: [number, number, number]): void {
		this.worldPosition(worldPos);
	}

	public setRotation(quat: [number, number, number, number]): void {
		this.signalableObject.quaternion(quat);
	}

	public destroy(): void {
		this.world.removeBlock(
			this.gridPosition[0],
			this.gridPosition[1],
			this.gridPosition[2]
		);
		// You might also want to remove the object from the canvas here
	}
}
