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
		const block = this.blocks.get(key) || null;
		if (block) {
			// Verify the block's position matches what we expect
			if (
				block.gridPosition[0] !== x ||
				block.gridPosition[1] !== y ||
				block.gridPosition[2] !== z
			) {
				console.warn(
					`⚠️ Block ${block.blockType} has mismatched position! Grid key: [${x},${y},${z}], Block reports: [${block.gridPosition}]`
				);
			}
		}
		return block;
	}

	/**
	 * Set block at specific grid position
	 */
	public setBlock(x: number, y: number, z: number, block: Block): void {
		const key = this.gridToKey(x, y, z);
		const existing = this.blocks.get(key);
		if (existing && existing !== block) {
			console.warn(
				`⚠️ Overwriting block at [${x},${y},${z}]: ${existing.blockType} -> ${block.blockType}`
			);
		}
		this.blocks.set(key, block);
		console.log(
			`✅ Set block ${block.blockType} at [${x},${y},${z}] (key: ${key})`
		);
	}

	/**
	 * Remove block from specific grid position
	 */
	public removeBlock(x: number, y: number, z: number): Block | null {
		const key = this.gridToKey(x, y, z);
		const block = this.blocks.get(key) || null;
		if (block) {
			this.blocks.delete(key);
			console.log(`🗑️ Removed block ${block.blockType} from [${x},${y},${z}]`);
		}
		return block;
	}

	/**
	 * Move a block from one position to another
	 */
	public moveBlock(
		from: [number, number, number],
		to: [number, number, number]
	): void {
		const fromKey = this.gridToKey(from[0], from[1], from[2]);
		const toKey = this.gridToKey(to[0], to[1], to[2]);

		// Don't move if it's the same position
		if (fromKey === toKey) {
			console.log(`🔄 Block already at [${to}], no move needed`);
			return;
		}

		console.log(`🔄 WorldGrid: Moving block from [${from}] to [${to}]`);

		const block = this.blocks.get(fromKey);
		if (block) {
			// Check if destination is occupied
			const existingBlock = this.blocks.get(toKey);
			if (existingBlock && existingBlock !== block) {
				console.error(
					`❌ Cannot move to [${to}] - occupied by ${existingBlock.blockType}`
				);
				return;
			}

			console.log(`🔄 Moving ${block.blockType} from ${fromKey} to ${toKey}`);
			this.blocks.delete(fromKey);
			this.blocks.set(toKey, block);

			// Verify the move
			console.log(`🔄 World grid now has ${this.blocks.size} blocks`);
		} else {
			console.error(`❌ No block found at [${from}] to move!`);
			console.log(`Current blocks in world:`);
			this.blocks.forEach((b, key) => {
				console.log(
					`  ${b.blockType} at key ${key} (grid: [${b.gridPosition}])`
				);
			});
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

		console.log(
			`🔍 Searching line from [${startX}, ${startY}, ${startZ}] in direction [${directionX}, ${directionY}, ${directionZ}]`
		);

		// Important: Start from position 1 (not 0) to skip the piston itself
		for (let i = 1; i <= maxDistance; i++) {
			const checkX = startX + directionX * i;
			const checkY = startY + directionY * i;
			const checkZ = startZ + directionZ * i;

			console.log(`  Checking position [${checkX}, ${checkY}, ${checkZ}]...`);

			const block = this.getBlock(checkX, checkY, checkZ);

			if (block) {
				console.log(
					`  ✅ Found: ${block.blockType} at grid [${block.gridPosition}]`
				);

				// Verify this block is actually at the position we think it is
				if (
					block.gridPosition[0] !== checkX ||
					block.gridPosition[1] !== checkY ||
					block.gridPosition[2] !== checkZ
				) {
					console.error(
						`  ❌ Position mismatch! Expected [${checkX},${checkY},${checkZ}], got [${block.gridPosition}]`
					);
				}

				blocks.push(block);
			} else {
				console.log(`  ❌ Empty space - stopping search`);
				// Empty space found, stop scanning
				break;
			}
		}

		console.log(`🔍 Search complete: found ${blocks.length} blocks`);
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
		console.log(`🔍 Checking if ${blocks.length} blocks can be pushed...`);

		for (const block of blocks) {
			const targetX = block.gridPosition[0] + directionX;
			const targetY = block.gridPosition[1] + directionY;
			const targetZ = block.gridPosition[2] + directionZ;

			const canMove = this.canMoveTo(targetX, targetY, targetZ, blocks);
			console.log(
				`  Block at [${
					block.gridPosition
				}] -> [${targetX},${targetY},${targetZ}]: ${canMove ? "YES" : "NO"}`
			);

			if (!canMove) {
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
