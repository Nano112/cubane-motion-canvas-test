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
	 * Factory method to create a block from Cubane
	 */
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
		console.log(
			`📍 Block ${this.blockType} moving from grid [${this.gridPosition}] to grid [${gridPos}]`
		);

		// Update world grid
		this.world.moveBlock(this.gridPosition, gridPos);

		// Update our position
		this.gridPosition = [...gridPos];
		this.worldPosition(gridPos);

		console.log(
			`📍 Block ${this.blockType} now at grid [${
				this.gridPosition
			}], world [${this.worldPosition()}]`
		);
	}

	/**
	 * Get the current world position
	 */
	public getWorldPosition(): [number, number, number] {
		return this.worldPosition();
	}

	/**
	 * Set the block's world position (for animation) and optionally update grid position
	 */
	public setWorldPosition(
		worldPos: [number, number, number],
		updateGrid: boolean = false
	): void {
		// Round world position to avoid floating point issues
		const roundedWorldPos: [number, number, number] = [
			Math.round(worldPos[0] * 1000) / 1000,
			Math.round(worldPos[1] * 1000) / 1000,
			Math.round(worldPos[2] * 1000) / 1000,
		];

		// Update the visual position
		this.worldPosition(roundedWorldPos);

		if (updateGrid) {
			// Calculate the new grid position by rounding
			const newGridPos: [number, number, number] = [
				Math.round(roundedWorldPos[0]),
				Math.round(roundedWorldPos[1]),
				Math.round(roundedWorldPos[2]),
			];

			// Only update grid if position actually changed
			if (
				newGridPos[0] !== this.gridPosition[0] ||
				newGridPos[1] !== this.gridPosition[1] ||
				newGridPos[2] !== this.gridPosition[2]
			) {
				console.log(
					`📍 Block ${this.blockType} grid update: [${
						this.gridPosition
					}] -> [${newGridPos}] (world: [${roundedWorldPos[0].toFixed(
						3
					)}, ${roundedWorldPos[1].toFixed(3)}, ${roundedWorldPos[2].toFixed(
						3
					)}])`
				);

				// CRITICAL: Update world grid BEFORE updating our position
				const oldPos = [...this.gridPosition] as [number, number, number];
				this.gridPosition = [...newGridPos];

				// Move in world grid
				this.world.moveBlock(oldPos, newGridPos);

				// Verify the move worked
				const blockAtNewPos = this.world.getBlock(
					newGridPos[0],
					newGridPos[1],
					newGridPos[2]
				);
				if (blockAtNewPos !== this) {
					console.error(
						`❌ Failed to move block ${
							this.blockType
						} to [${newGridPos}]! Found: ${
							blockAtNewPos?.blockType || "nothing"
						}`
					);
				}
			}
		}
	}

	/**
	 * Set rotation using quaternion
	 */
	public setRotation(quat: [number, number, number, number]): void {
		this.signalableObject.quaternion(quat);
	}

	/**
	 * Update method called each frame - can be overridden for custom behavior
	 */
	public update(): void {
		// Default implementation - no special update logic needed for regular blocks
	}

	/**
	 * Cleanup when block is removed
	 */
	public destroy(): void {
		this.world.removeBlock(
			this.gridPosition[0],
			this.gridPosition[1],
			this.gridPosition[2]
		);
	}
}
