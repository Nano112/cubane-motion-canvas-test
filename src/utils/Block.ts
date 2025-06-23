import { SimpleSignal, createSignal } from "@motion-canvas/core/lib/signals";
import { SignalableObject3D } from "../motion-canvas-3d";
import * as THREE from "three";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { WorldGrid } from "./WorldGrid";

export abstract class Block {
	protected canvas: ThreeCanvasWithPostProcessing;
	protected world: WorldGrid;
	protected signalableObject: SignalableObject3D;

	// Grid position (discrete coordinates like 0,1,2)
	public gridPosition: [number, number, number];

	// World position (continuous coordinates for animation)
	public worldPosition: SimpleSignal<[number, number, number], void>;

	// Movement state
	public isMoving: boolean = false;

	// Block properties
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

		// Create position signal and initialize with grid position
		this.worldPosition =
			createSignal<[number, number, number]>(initialGridPosition);

		// Add to canvas and get the signalable object
		[this.signalableObject] = canvas.push(mesh);

		// Link our position signal to the signalable object
		this.signalableObject.position(this.worldPosition);

		// Register with world grid
		this.world.setBlock(
			initialGridPosition[0],
			initialGridPosition[1],
			initialGridPosition[2],
			this
		);
	}

	/**
	 * Whether this block can be pushed by pistons
	 * Default: can be pushed if not currently moving
	 */
	public canBePushed(): boolean {
		return !this.isMoving;
	}

	/**
	 * Set the block's position (updates both grid and world position)
	 */
	public setPosition(gridPos: [number, number, number]): void {
		// Update world grid
		this.world.moveBlock(this.gridPosition, gridPos);

		// Update our position
		this.gridPosition = [...gridPos];
		this.worldPosition(gridPos);
	}

	/**
	 * Get the current world position
	 */
	public getWorldPosition(): [number, number, number] {
		return this.worldPosition();
	}

	/**
	 * Set rotation using quaternion
	 */
	public setRotation(quat: [number, number, number, number]): void {
		this.signalableObject.quaternion(quat);
	}

	/**
	 * Update method called each frame - override for custom behavior
	 */
	public abstract update(): void;

	/**
	 * Cleanup when block is removed
	 */
	public destroy(): void {
		this.world.removeBlock(
			this.gridPosition[0],
			this.gridPosition[1],
			this.gridPosition[2]
		);
		// Note: You might need to remove from canvas too depending on your setup
	}
}
