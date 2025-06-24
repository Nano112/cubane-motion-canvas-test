import { SimpleSignal, createSignal, tween } from "@motion-canvas/core";
import { Block } from "./Block";
import { WorldGrid } from "./WorldGrid";
import { SignalableObject3D } from "../motion-canvas-3d";
import * as THREE from "three";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { Cubane } from "cubane";

export default class Piston extends Block {
	public extension: SimpleSignal<number, void>;
	private pistonHeadShort: SignalableObject3D;
	private pistonHeadNormal: SignalableObject3D;

	// Piston state
	private isExtending: boolean = false;
	private isRetracting: boolean = false;
	private isSticky: boolean = false;

	// Piston direction
	private pushDirection: [number, number, number] = [1, 0, 0];

	// Animation tracking for pushed blocks
	private blocksBeingPushed: Block[] = [];
	private blockStartPositions: Map<Block, [number, number, number]> = new Map();

	// State tracking for deterministic behavior
	private hasStartedPush: boolean = false;
	private hasFinalized: boolean = false;
	private lastProcessedExtension: number = -1; // Track last extension we processed

	private constructor(
		canvas: ThreeCanvasWithPostProcessing,
		world: WorldGrid,
		bodyMesh: THREE.Object3D,
		shortHeadMesh: THREE.Object3D,
		normalHeadMesh: THREE.Object3D,
		blockType: string,
		initialGridPosition: [number, number, number],
		isSticky: boolean = false
	) {
		super(canvas, world, bodyMesh, blockType, initialGridPosition);

		this.isSticky = isSticky;
		this.extension = createSignal<number>(0);

		// Add the piston heads to canvas
		[this.pistonHeadShort] = canvas.push(shortHeadMesh);
		[this.pistonHeadNormal] = canvas.push(normalHeadMesh);

		// Set initial visibility
		this.pistonHeadShort.object.visible = true;
		this.pistonHeadNormal.object.visible = false;

		// Initialize head positions
		this.updateHeadPositions();

		// Add update callback - this is called every frame
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
		world: WorldGrid,
		cubane: Cubane,
		initialGridPosition: [number, number, number],
		type: "sticky" | "regular" = "regular",
		facing: "east" | "west" | "north" | "south" | "up" | "down" = "east"
	): Promise<Piston> {
		const blockType = type === "sticky" ? "sticky_piston" : "piston";
		const headType = type === "sticky" ? "sticky" : "normal";

		const facingMap = {
			east: {
				blockState: "east",
				pushDirection: [1, 0, 0] as [number, number, number],
			},
			west: {
				blockState: "west",
				pushDirection: [-1, 0, 0] as [number, number, number],
			},
			north: {
				blockState: "north",
				pushDirection: [0, 0, -1] as [number, number, number],
			},
			south: {
				blockState: "south",
				pushDirection: [0, 0, 1] as [number, number, number],
			},
			up: {
				blockState: "up",
				pushDirection: [0, 1, 0] as [number, number, number],
			},
			down: {
				blockState: "down",
				pushDirection: [0, -1, 0] as [number, number, number],
			},
		};

		const facingData = facingMap[facing];

		const [bodyMesh, shortHeadMesh, normalHeadMesh] = await Promise.all([
			cubane.getBlockMesh(
				`minecraft:${blockType}[facing=${facingData.blockState},extended=true]`
			),
			cubane.getBlockMesh(
				`minecraft:piston_head[extended=true,facing=${facingData.blockState},short=true,type=${headType}]`
			),
			cubane.getBlockMesh(
				`minecraft:piston_head[extended=true,facing=${facingData.blockState},short=false,type=${headType}]`
			),
		]);

		const piston = new Piston(
			canvas,
			world,
			bodyMesh,
			shortHeadMesh,
			normalHeadMesh,
			`minecraft:${blockType}`,
			initialGridPosition,
			type === "sticky"
		);

		piston.setPushDirection(facingData.pushDirection);
		return piston;
	}

	public canBePushed(): boolean {
		return (
			this.extension() === 0 &&
			!this.isExtending &&
			!this.isRetracting &&
			!this.isMoving
		);
	}

	public setPushDirection(direction: [number, number, number]): void {
		this.pushDirection = [...direction];
	}

	public setPosition(gridPos: [number, number, number]): void {
		super.setPosition(gridPos);
		this.updateHeadPositions();
	}

	public setRotation(quat: [number, number, number, number]): void {
		super.setRotation(quat);
		this.pistonHeadShort.quaternion(quat);
		this.pistonHeadNormal.quaternion(quat);
	}

	private updateHeadPositions(): void {
		const ext = this.extension();
		const basePos = this.getWorldPosition();

		// Calculate head position with proper rounding to avoid floating point issues
		const headPos: [number, number, number] = [
			Math.round((basePos[0] + this.pushDirection[0] * ext) * 1000) / 1000,
			Math.round((basePos[1] + this.pushDirection[1] * ext) * 1000) / 1000,
			Math.round((basePos[2] + this.pushDirection[2] * ext) * 1000) / 1000,
		];

		this.pistonHeadShort.position(headPos);
		this.pistonHeadNormal.position(headPos);

		// Switch between short and normal head at exactly 0.25 extension
		const shouldShowNormal = ext >= 0.25;
		if (this.pistonHeadNormal.object.visible !== shouldShowNormal) {
			this.pistonHeadShort.object.visible = !shouldShowNormal;
			this.pistonHeadNormal.object.visible = shouldShowNormal;
		}
	}

	private processExtensionState(currentExtension: number): void {
		// Round to avoid floating point comparison issues
		currentExtension = Math.round(currentExtension * 1000) / 1000;

		// State transitions based on specific extension values
		if (
			currentExtension > 0 &&
			currentExtension < 0.1 &&
			!this.hasStartedPush
		) {
			// Start pushing when extension begins
			this.hasStartedPush = true;
			this.hasFinalized = false;
			this.startPushing();
		}

		if (
			currentExtension >= 0.999 &&
			!this.hasFinalized &&
			this.blocksBeingPushed.length > 0
		) {
			// Finalize when fully extended
			this.finalizePushedBlocks();
			this.hasFinalized = true;
		}

		if (
			this.isSticky &&
			this.lastProcessedExtension >= 0.999 &&
			currentExtension < 0.999 &&
			!this.hasStartedPush
		) {
			// Sticky piston starting to retract
			this.hasStartedPush = true;
			this.hasFinalized = false;
			this.startPulling();
		}

		if (currentExtension <= 0.001) {
			// Reset when fully retracted
			if (this.blocksBeingPushed.length > 0 && !this.hasFinalized) {
				this.finalizePushedBlocks();
				this.hasFinalized = true;
			}
			this.hasStartedPush = false;
		}

		// Update positions if we have blocks to move
		if (this.blocksBeingPushed.length > 0) {
			this.updatePushedBlockPositions(currentExtension);
		}

		this.lastProcessedExtension = currentExtension;
	}

	private startPushing(): void {
		if (this.blocksBeingPushed.length > 0) return;

		console.log(`\n=== PISTON PUSH START ===`);
		console.log(
			`Piston at: [${this.gridPosition}], direction: [${this.pushDirection}]`
		);

		// Get blocks in front of piston
		const blocksInPath = this.world.getBlocksInLine(
			this.gridPosition[0],
			this.gridPosition[1],
			this.gridPosition[2],
			this.pushDirection[0],
			this.pushDirection[1],
			this.pushDirection[2],
			12
		);

		if (blocksInPath.length === 0) {
			console.log("No blocks to push");
			return;
		}

		// Filter to only pushable blocks (not other pistons)
		const pushableBlocks = blocksInPath.filter((block) => {
			if (block instanceof Piston) {
				return false;
			}
			return block.canBePushed();
		});

		if (pushableBlocks.length !== blocksInPath.length) {
			console.log("Cannot push - immovable block in chain");
			return;
		}

		// Check if there's space for all blocks
		if (
			!this.world.canPushChain(
				pushableBlocks,
				this.pushDirection[0],
				this.pushDirection[1],
				this.pushDirection[2]
			)
		) {
			console.log("Cannot push - no space for blocks");
			return;
		}

		// Start tracking blocks
		this.blocksBeingPushed = pushableBlocks;
		pushableBlocks.forEach((block) => {
			block.isMoving = true;
			// Store the current grid position
			this.blockStartPositions.set(block, [...block.gridPosition]);
		});

		console.log(`Started pushing ${pushableBlocks.length} blocks`);
	}

	private startPulling(): void {
		if (!this.isSticky || this.blocksBeingPushed.length > 0) return;

		const blockInFront = this.world.getBlock(
			this.gridPosition[0] + this.pushDirection[0],
			this.gridPosition[1] + this.pushDirection[1],
			this.gridPosition[2] + this.pushDirection[2]
		);

		if (
			blockInFront &&
			blockInFront.canBePushed() &&
			!(blockInFront instanceof Piston)
		) {
			console.log(`Sticky piston pulling block: ${blockInFront.blockType}`);
			this.blocksBeingPushed = [blockInFront];
			blockInFront.isMoving = true;
			this.blockStartPositions.set(blockInFront, [
				...blockInFront.gridPosition,
			]);
		}
	}

	private updatePushedBlockPositions(currentExtension: number): void {
		const roundedExtension = Math.round(currentExtension * 1000) / 1000;

		// For pushing or sticky pistons extending
		if (!this.isSticky || currentExtension > this.lastProcessedExtension) {
			this.blocksBeingPushed.forEach((block) => {
				const startPos = this.blockStartPositions.get(block);
				if (!startPos) return;

				// Calculate position based on integer start position + extension
				const newWorldPos: [number, number, number] = [
					startPos[0] + this.pushDirection[0] * roundedExtension,
					startPos[1] + this.pushDirection[1] * roundedExtension,
					startPos[2] + this.pushDirection[2] * roundedExtension,
				];

				block.setWorldPosition(newWorldPos, true);
			});
		}
		// For sticky pistons pulling
		else if (this.isSticky && this.blocksBeingPushed.length === 1) {
			const block = this.blocksBeingPushed[0];
			const startPos = this.blockStartPositions.get(block);
			if (!startPos) return;

			const newWorldPos: [number, number, number] = [
				startPos[0] - this.pushDirection[0] * (1 - roundedExtension),
				startPos[1] - this.pushDirection[1] * (1 - roundedExtension),
				startPos[2] - this.pushDirection[2] * (1 - roundedExtension),
			];

			block.setWorldPosition(newWorldPos, true);
		}
	}

	private finalizePushedBlocks(): void {
		if (this.blocksBeingPushed.length === 0) return;

		console.log(`\n=== FINALIZING ${this.blocksBeingPushed.length} BLOCKS ===`);

		this.blocksBeingPushed.forEach((block) => {
			block.isMoving = false;
			// Ensure final grid position is correct
			const worldPos = block.getWorldPosition();
			const finalGridPos: [number, number, number] = [
				Math.round(worldPos[0]),
				Math.round(worldPos[1]),
				Math.round(worldPos[2]),
			];
			block.setPosition(finalGridPos);
			console.log(
				`Block ${block.blockType} finalized at grid [${finalGridPos}]`
			);
		});

		this.blocksBeingPushed = [];
		this.blockStartPositions.clear();
	}

	public update(): void {
		const currentExtension = this.extension();

		// Process state changes
		this.processExtensionState(currentExtension);

		// Always update head positions
		this.updateHeadPositions();
	}

	public *extend(duration: number = 0.2) {
		if (this.isExtending || this.extension() > 0) return;
		this.isExtending = true;
		yield* tween(duration, (t) => {
			this.extension(t);
		});
		this.isExtending = false;
	}

	public *retract(duration: number = 0.2) {
		if (this.isRetracting || this.extension() === 0) return;
		this.isRetracting = true;
		yield* tween(duration, (t) => {
			this.extension(1 - t);
		});
		this.isRetracting = false;
	}
}
