import * as THREE from "three";
import { Block } from "./Block";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { WorldGrid } from "./WorldGrid";
import { Cubane } from "cubane";

export class RegularBlock extends Block {
	constructor(
		canvas: ThreeCanvasWithPostProcessing,
		world: WorldGrid,
		mesh: THREE.Object3D,
		blockType: string,
		initialGridPosition: [number, number, number]
	) {
		super(canvas, world, mesh, blockType, initialGridPosition);
	}

	/**
	 * Factory method to create a block from Cubane
	 */
	public static async create(
		canvas: ThreeCanvasWithPostProcessing,
		world: WorldGrid,
		cubane: Cubane,
		blockType: string, // e.g., "minecraft:stone", "minecraft:dirt"
		initialGridPosition: [number, number, number]
	): Promise<RegularBlock> {
		const mesh = await cubane.getBlockMesh(blockType);
		return new RegularBlock(
			canvas,
			world,
			mesh,
			blockType,
			initialGridPosition
		);
	}

	/**
	 * Regular blocks can be pushed unless they're currently moving
	 */
	public canBePushed(): boolean {
		return !this.isMoving;
	}

	/**
	 * Regular blocks don't need any special update logic
	 */
	public update(): void {
		// No special update logic needed for regular blocks
		// Could add things like gravity, decay, etc. here later
	}

	/**
	 * Animate this block to a new position
	 * This would be called when the block is being pushed
	 */
	public animateToPosition(
		targetGridPos: [number, number, number],
		duration: number = 0.2
	): Promise<void> {
		return new Promise((resolve) => {
			this.isMoving = true;

			const startPos = this.getWorldPosition();
			const targetPos = targetGridPos;

			// This is pseudo-code - you'd use your motion-canvas tween here
			// tween(duration, (t) => {
			//   const interpolatedPos: [number, number, number] = [
			//     startPos[0] + (targetPos[0] - startPos[0]) * t,
			//     startPos[1] + (targetPos[1] - startPos[1]) * t,
			//     startPos[2] + (targetPos[2] - startPos[2]) * t
			//   ];
			//   this.worldPosition(interpolatedPos);
			// }).then(() => {
			//   this.setPosition(targetGridPos);
			//   this.isMoving = false;
			//   resolve();
			// });

			// For now, just move instantly
			this.setPosition(targetGridPos);
			this.isMoving = false;
			resolve();
		});
	}
}
