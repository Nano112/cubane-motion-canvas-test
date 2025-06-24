import { makeScene2D, useScene2D } from "@motion-canvas/2d";
import { ThreeCanvas, axisAngle, SignalableObject3D } from "../motion-canvas-3d";

import * as THREE from "three";
import { easeInOutCubic, easeOutQuart, easeInQuart, easeInOutQuart, tween, waitFor, all } from "@motion-canvas/core";

import { Cubane, ResourcePackLoadOptions, ResourcePackLoader } from "cubane";

import ThreeCanvasWithPostProcessing from "../utils/ThreeCanvasWithPostProcessing";
import Piston from "../utils/piston";
import { Block } from "../utils/Block"; // Updated import
import { WorldGrid } from "../utils/WorldGrid";

const cubane = new Cubane();
const resourcePackName = "resource-pack.zip";

const resourcePackLoader = () => {
  return new Promise<Blob>((resolve, reject) => {
    fetch(`/${resourcePackName}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => resolve(blob))
      .catch((error) => reject(error));
  });
}

const resourcePackLoadOptions = {
  packId: resourcePackName,
  useCache: true,
}

cubane.loadResourcePack(resourcePackLoadOptions, resourcePackLoader)
  .then(() => {
    console.log("Resource pack loaded successfully");
  })
  .catch((error) => {
    console.error("Failed to load resource pack:", error);
  });

export default makeScene2D(function* (view) {
  const { x: canvasWidth, y: canvasHeight } = useScene2D().getSize();
  const c = new ThreeCanvasWithPostProcessing({ canvasWidth, canvasHeight });
  c.setBackgroundColor(0x87CEEB); // Sky blue background

  // Create the world grid to track all blocks
  const world = new WorldGrid();

  // Set up camera
  c.camera.position([0, 0, -4]);
  c.camera.lookAt([0.5, 0, 0]);

  // Create the first piston at grid position [0, 1, 0] facing east
  const piston = yield Piston.create(
    c,
    world,
    cubane,
    [-1, 1, 0],
    "sticky"
  );

  // Create some blocks for the piston to push
  const stoneBlock1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    "minecraft:stone",
    [0, 1, 0]  // 1 block in front of piston
  );

  const stoneBlock2 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    "minecraft:stone",
    [1, 1, 0]  // 1 block in front of piston
  );

  // Create second piston facing up
  const secondPiston = yield Piston.create(c, world, cubane, [2, 0, 0], "regular", "up");

  // Add canvas to view
  view.add(c);

  // Set up lighting
  c.create(() => {
    const light = new THREE.AmbientLight(0xffffff, 0.6);
    return light;
  });

  c.create(() => {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(2, 3, 1);
    directionalLight.castShadow = true;
    return directionalLight;
  });

  // Optional: Add some ground plane for visual reference
  c.create(() => {
    const geometry = new THREE.PlaneGeometry(10, 10);
    const material = new THREE.MeshLambertMaterial({
      color: 0x90EE90
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.5;
    return plane;
  });

  // Log initial state
  console.log("=== INITIAL STATE ===");
  console.log("First piston at:", piston.gridPosition);
  console.log("First Stone block at:", stoneBlock1.gridPosition);
  console.log("Second Stone block at:", stoneBlock2.gridPosition);
  console.log("Second piston at:", secondPiston.gridPosition);
  console.log("World positions:", world.getAllPositions());

  // Animation sequence
  yield* all(
    // Camera rotation
    tween(12.0, (t) => {
      const angle = Math.PI * t;
      c.camera.position([
        Math.sin(angle) * 5,
        3,
        Math.cos(angle) * 5
      ]);
      c.camera.lookAt([1, 1, 0]); // Look at the action area
    }),

    // Piston animation sequence
    (function* () {
      console.log("=== STARTING FIRST PISTON ===");

      // First piston extends
      yield* tween(0.5, (t) => {
        const pistonExt = easeInOutCubic(t);
        piston.extension(pistonExt);
      });

      console.log("=== FIRST PISTON EXTENDED ===");
      console.log("World positions after first piston:", world.getAllPositions());

      // Wait a bit to ensure the block is in the right position
      yield* waitFor(0.2);

      console.log("=== STARTING SECOND PISTON ===");

      // Second piston extends
      yield* tween(0.5, (t) => {
        const pistonExt = easeInOutCubic(t);
        secondPiston.extension(pistonExt);
      });

      console.log("=== SECOND PISTON EXTENDED ===");
      console.log("Final world positions:", world.getAllPositions());

      // Wait a bit then retract both pistons
      yield* waitFor(1.0);

      // Retract second piston first
      yield* tween(0.5, (t) => {
        const pistonExt = 1 - easeInOutCubic(t);
        secondPiston.extension(pistonExt);
      });

      // Then retract first piston
      yield* tween(0.5, (t) => {
        const pistonExt = 1 - easeInOutCubic(t);
        piston.extension(pistonExt);
      });

      console.log("=== PISTONS RETRACTED ===");
      console.log("Final world positions:", world.getAllPositions());
    })(),
  );

  // Log final state for debugging
  console.log("=== FINAL STATE ===");
  console.log("World has", world.getBlockCount(), "blocks");
  console.log("Block positions:", world.getAllPositions());
});