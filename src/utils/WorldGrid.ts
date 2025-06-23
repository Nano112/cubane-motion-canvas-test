import { Block } from "./Block";

export class WorldGrid {
	private blocks: Map<string, Block> = new Map();

	/**
	 * Convert grid coordinates to string key
	 */
	private gridToKey(x: number, y: number, z: number): string {
		return `${x},${y},${z}`;
	}

	/**
	 * Convert string key back to grid coordinates
	 */
	private keyToGrid(key: string): [number, number, number] {
		const parts = key.split(",").map(Number);
		return [parts[0], parts[1], parts[2]];
	}

	/**
	 * Get block at specific grid position
	 */
	public getBlock(x: number, y: number, z: number): Block | null {
		const key = this.gridToKey(x, y, z);
		return this.blocks.get(key) || null;
	}

	/**
	 * Set block at specific grid position
	 */
	public setBlock(x: number, y: number, z: number, block: Block): void {
		const key = this.gridToKey(x, y, z);
		this.blocks.set(key, block);
	}

	/**
	 * Remove block from specific grid position
	 */
	public removeBlock(x: number, y: number, z: number): Block | null {
		const key = this.gridToKey(x, y, z);
		const block = this.blocks.get(key) || null;
		this.blocks.delete(key);
		return block;
	}

	/**
	 * Move a block from one position to another
	 */
	public moveBlock(
		from: [number, number, number],
		to: [number, number, number]
	): void {
		const block = this.removeBlock(from[0], from[1], from[2]);
		if (block) {
			this.setBlock(to[0], to[1], to[2], block);
		}
	}

	/**
	 * Check if a position is empty
	 */
	public isEmpty(x: number, y: number, z: number): boolean {
		return this.getBlock(x, y, z) === null;
	}

	/**
	 * Get all blocks in a line starting from a position, going in a direction
	 * Used for piston push detection
	 */
	public getBlocksInLine(
		startX: number,
		startY: number,
		startZ: number,
		directionX: number,
		directionY: number,
		directionZ: number,
		maxDistance: number = 12
	): Block[] {
		const blocks: Block[] = [];

		for (let i = 1; i <= maxDistance; i++) {
			const checkX = startX + directionX * i;
			const checkY = startY + directionY * i;
			const checkZ = startZ + directionZ * i;

			const block = this.getBlock(checkX, checkY, checkZ);

			if (block) {
				blocks.push(block);
			} else {
				// Empty space found, stop scanning
				break;
			}
		}

		return blocks;
	}

	/**
	 * Get all blocks in the world
	 */
	public getAllBlocks(): Block[] {
		return Array.from(this.blocks.values());
	}

	/**
	 * Get all block positions
	 */
	public getAllPositions(): [number, number, number][] {
		return Array.from(this.blocks.keys()).map((key) => this.keyToGrid(key));
	}

	/**
	 * Check if there's space for a block to move to a position
	 * Useful for validating push chains
	 */
	public canMoveTo(
		x: number,
		y: number,
		z: number,
		excludeBlocks: Block[] = []
	): boolean {
		const blockAtPosition = this.getBlock(x, y, z);

		// Position is free if it's empty or contains a block we're planning to move
		return blockAtPosition === null || excludeBlocks.includes(blockAtPosition);
	}

	/**
	 * Validate if a chain of blocks can all be pushed in a direction
	 */
	public canPushChain(
		blocks: Block[],
		directionX: number,
		directionY: number,
		directionZ: number
	): boolean {
		for (const block of blocks) {
			const targetX = block.gridPosition[0] + directionX;
			const targetY = block.gridPosition[1] + directionY;
			const targetZ = block.gridPosition[2] + directionZ;

			if (!this.canMoveTo(targetX, targetY, targetZ, blocks)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Clear all blocks from the world
	 */
	public clear(): void {
		this.blocks.clear();
	}

	/**
	 * Get count of blocks in the world
	 */
	public getBlockCount(): number {
		return this.blocks.size;
	}
}
