import { Block } from "./Block";

export class WorldGrid {
	private blocks: Map<string, Block> = new Map();

	private gridToKey(x: number, y: number, z: number): string {
		return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
	}

	private keyToGrid(key: string): [number, number, number] {
		const parts = key.split(",").map(Number);
		return [parts[0], parts[1], parts[2]];
	}

	public getBlock(x: number, y: number, z: number): Block | null {
		const key = this.gridToKey(x, y, z);
		return this.blocks.get(key) || null;
	}

	public setBlock(x: number, y: number, z: number, block: Block): void {
		const key = this.gridToKey(x, y, z);
		const existing = this.blocks.get(key);
		if (existing && existing !== block) {
			console.warn(
				`⚠️ Overwriting block at [${x},${y},${z}]: ${existing.blockType} -> ${block.blockType}`
			);
		}
		this.blocks.set(key, block);
	}

	public removeBlock(x: number, y: number, z: number): Block | null {
		const key = this.gridToKey(x, y, z);
		const block = this.blocks.get(key) || null;
		if (block) {
			this.blocks.delete(key);
		}
		return block;
	}

	public moveBlock(
		from: [number, number, number],
		to: [number, number, number]
	): void {
		const fromKey = this.gridToKey(from[0], from[1], from[2]);
		const toKey = this.gridToKey(to[0], to[1], to[2]);

		if (fromKey === toKey) return;

		const block = this.removeBlock(from[0], from[1], from[2]);
		if (block) {
			// Important: update the block's own gridPosition property
			block.gridPosition = [...to];
			this.setBlock(to[0], to[1], to[2], block);
		} else {
			console.error(`❌ No block found at [${from}] to move!`);
		}
	}

	public getBlocksInLine(
		startX: number,
		startY: number,
		startZ: number,
		dirX: number,
		dirY: number,
		dirZ: number,
		maxDistance: number = 12
	): Block[] {
		const result: Block[] = [];
		for (let i = 1; i <= maxDistance; i++) {
			const checkX = startX + dirX * i;
			const checkY = startY + dirY * i;
			const checkZ = startZ + dirZ * i;
			const block = this.getBlock(checkX, checkY, checkZ);

			if (block) {
				// Piston cannot push other extended pistons
				if (!block.canBePushed()) {
					result.push(block); // Add the immovable block to the list so we know the chain is blocked
					break;
				}
				result.push(block);
			} else {
				break; // Empty space stops the chain
			}
		}
		return result;
	}

	public canPushChain(
		blocks: Block[],
		dirX: number,
		dirY: number,
		dirZ: number
	): boolean {
		if (blocks.length > 12) return false;

		// Check if the last block in the chain is movable
		const lastBlock = blocks[blocks.length - 1];
		if (!lastBlock.canBePushed()) {
			console.log(
				`Push chain blocked by immovable block: ${lastBlock.blockType}`
			);
			return false;
		}

		// Check if there is empty space after the last block
		const spaceAfterX = lastBlock.gridPosition[0] + dirX;
		const spaceAfterY = lastBlock.gridPosition[1] + dirY;
		const spaceAfterZ = lastBlock.gridPosition[2] + dirZ;

		const isSpaceFree =
			this.getBlock(spaceAfterX, spaceAfterY, spaceAfterZ) === null;
		if (!isSpaceFree) {
			console.log(
				`Push chain blocked by an object at [${spaceAfterX}, ${spaceAfterY}, ${spaceAfterZ}]`
			);
		}
		return isSpaceFree;
	}

	public getAllPositions(): [number, number, number][] {
		return Array.from(this.blocks.keys()).map((key) => this.keyToGrid(key));
	}
}
