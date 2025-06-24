import { SimpleSignal, createSignal, all, tween } from "@motion-canvas/core";
import { Block } from "./Block";
import { WorldGrid } from "./WorldGrid";
import { SignalableObject3D } from "../motion-canvas-3d";
import * as THREE from "three";
import ThreeCanvasWithPostProcessing from "./ThreeCanvasWithPostProcessing";
import { Cubane } from "cubane";

enum PistonState {
	IDLE,
	EXTENDING,
	EXTENDED,
	RETRACTING,
}

export default class Piston extends Block {
	public extension: SimpleSignal<number, void>;
	private pistonHeadShort: SignalableObject3D;
	private pistonHeadNormal: SignalableObject3D;

	private state: PistonState = PistonState.IDLE;
	private isSticky: boolean = false;
	private pushDirection: [number, number, number] = [1, 0, 0];

	private shouldDropBlock: boolean = false;

	private blocksInMotion: Block[] = [];
	private blockStartPositions: Map<Block, [number, number, number]> = new Map();
	private lastProcessedExtension: number = 0;

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
		[this.pistonHeadShort] = canvas.push(shortHeadMesh);
		[this.pistonHeadNormal] = canvas.push(normalHeadMesh);
		this.pistonHeadShort.object.visible = true;
		this.pistonHeadNormal.object.visible = false;
		this.updateHeadPositions();
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

	public *extend(duration: number = 0.2) {
		if (this.state !== PistonState.IDLE) return;
		yield* tween(duration, (t) => this.extension(t));
	}

	public *retract(duration: number = 0.2) {
		if (this.state !== PistonState.EXTENDED) return;
		this.shouldDropBlock = false;
		yield* tween(duration, (t) => this.extension(1 - t));
	}

	public *pulse(duration: number = 0.4, drop: boolean = false) {
		if (this.state !== PistonState.IDLE) return;
		this.shouldDropBlock = drop;
		yield* tween(duration, (t) => {
			const progress = 1 - Math.abs(1 - 2 * t);
			this.extension(progress);
		});
		this.shouldDropBlock = false;
	}

	public canBePushed(): boolean {
		return this.extension() === 0 && this.state === PistonState.IDLE;
	}

	public setPushDirection(direction: [number, number, number]): void {
		this.pushDirection = [...direction];
	}

	public setPosition(gridPos: [number, number, number]): void {
		super.setPosition(gridPos);
		this.updateHeadPositions();
	}

	private updateHeadPositions(): void {
		const ext = this.extension();
		const basePos = this.getWorldPosition();
		const headPos: [number, number, number] = [
			basePos[0] + this.pushDirection[0] * ext,
			basePos[1] + this.pushDirection[1] * ext,
			basePos[2] + this.pushDirection[2] * ext,
		];
		this.pistonHeadShort.position(headPos);
		this.pistonHeadNormal.position(headPos);
		const shouldShowNormal = ext >= 0.25;
		this.pistonHeadShort.object.visible = !shouldShowNormal;
		this.pistonHeadNormal.object.visible = shouldShowNormal;
	}

	private processState(currentExtension: number): void {
		if (this.state === PistonState.IDLE && currentExtension > 0) {
			this.state = PistonState.EXTENDING;
			this.startPushing();
		}

		if (this.state === PistonState.EXTENDING && currentExtension >= 0.999) {
			this.state = PistonState.EXTENDED;
			this.finalizeExtension();
		}

		if (this.state === PistonState.EXTENDED && currentExtension < 0.999) {
			this.state = PistonState.RETRACTING;
			this.prepareForRetraction();
		}

		if (this.state === PistonState.RETRACTING && currentExtension <= 0.001) {
			this.finalizeRetraction();
			this.state = PistonState.IDLE;
		}

		if (
			this.state === PistonState.EXTENDING ||
			this.state === PistonState.RETRACTING
		) {
			this.updateBlockPositions(currentExtension);
		}

		this.lastProcessedExtension = currentExtension;
	}

	private startPushing(): void {
		const blocksToPush = this.world.getBlocksInLine(
			this.gridPosition[0],
			this.gridPosition[1],
			this.gridPosition[2],
			this.pushDirection[0],
			this.pushDirection[1],
			this.pushDirection[2],
			12
		);
		if (
			blocksToPush.length === 0 ||
			!this.world.canPushChain(
				blocksToPush,
				this.pushDirection[0],
				this.pushDirection[1],
				this.pushDirection[2]
			)
		) {
			this.state = PistonState.IDLE;
			return;
		}
		this.blocksInMotion = blocksToPush;
		this.blocksInMotion.forEach((block) => {
			block.isMoving = true;
			this.blockStartPositions.set(block, [...block.gridPosition]);
		});
	}

	private finalizeExtension(): void {
		if (this.blocksInMotion.length === 0) return;

		const moveOperations: {
			block: Block;
			finalPos: [number, number, number];
		}[] = [];
		this.blocksInMotion.forEach((block) => {
			const startPos = this.blockStartPositions.get(block);
			if (!startPos) return;
			const finalGridPos: [number, number, number] = [
				startPos[0] + this.pushDirection[0],
				startPos[1] + this.pushDirection[1],
				startPos[2] + this.pushDirection[2],
			];
			moveOperations.push({ block, finalPos: finalGridPos });
		});

		moveOperations.reverse();

		moveOperations.forEach(({ block, finalPos }) => {
			block.setPosition(finalPos);
			block.isMoving = false;
		});

		if (!this.isSticky) {
			this.blocksInMotion = [];
			this.blockStartPositions.clear();
		}
	}

	private prepareForRetraction(): void {
		if (this.shouldDropBlock || !this.isSticky) {
			this.blocksInMotion = [];
			this.blockStartPositions.clear();
			return;
		}

		if (this.blocksInMotion.length > 0) {
			const blockToPull = this.blocksInMotion[0];

			this.blocksInMotion.slice(1).forEach((b) => (b.isMoving = false));

			this.blocksInMotion = [blockToPull];
			blockToPull.isMoving = true;

			const currentPos = [...blockToPull.gridPosition];
			this.blockStartPositions.clear();
			this.blockStartPositions.set(
				blockToPull,
				currentPos as [number, number, number]
			);
		}
	}

	private updateBlockPositions(currentExtension: number): void {
		if (this.state === PistonState.RETRACTING) {
			this.blocksInMotion.forEach((block) => {
				const startPos = this.blockStartPositions.get(block);
				if (!startPos) return;
				const pullBackAmount = 1 - currentExtension;
				const newWorldPos: [number, number, number] = [
					startPos[0] - this.pushDirection[0] * pullBackAmount,
					startPos[1] - this.pushDirection[1] * pullBackAmount,
					startPos[2] - this.pushDirection[2] * pullBackAmount,
				];
				block.setWorldPosition(newWorldPos);
			});
		} else if (this.state === PistonState.EXTENDING) {
			this.blocksInMotion.forEach((block) => {
				const startPos = this.blockStartPositions.get(block);
				if (!startPos) return;
				const newWorldPos: [number, number, number] = [
					startPos[0] + this.pushDirection[0] * currentExtension,
					startPos[1] + this.pushDirection[1] * currentExtension,
					startPos[2] + this.pushDirection[2] * currentExtension,
				];
				block.setWorldPosition(newWorldPos);
			});
		}
	}

	private finalizeRetraction(): void {
		if (this.blocksInMotion.length === 0) return;
		this.blocksInMotion.forEach((block) => {
			const finalWorldPos = block.getWorldPosition();
			const finalGridPos: [number, number, number] = [
				Math.round(finalWorldPos[0]),
				Math.round(finalWorldPos[1]),
				// THIS IS THE FIX
				Math.round(finalWorldPos[2]),
			];
			block.setPosition(finalGridPos);
			block.isMoving = false;
		});
		this.blocksInMotion = [];
		this.blockStartPositions.clear();
	}

	public update(): void {
		const currentExtension = this.extension();
		this.processState(currentExtension);
		this.updateHeadPositions();
	}
}
