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

  c.camera.position([2, 3, 7]);
  c.camera.lookAt([2, 3, 0]); // Look at the action area

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
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshLambertMaterial({
      color: 0x90EE90
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.5;
    plane.position.x = 2;
    plane.receiveShadow = true; // Allow shadows to be cast on the ground

    return plane;
  });


  const doorMaterial = "minecraft:white_concrete"; // Use a simple material for the door
  // Create the first piston at grid position [0, 1, 0] facing east
  const blockStorage = yield Piston.create(
    c,
    world,
    cubane,
    [0, 2, 0],
    "sticky"
  );

  // Create second piston facing up
  const doubleBottom = yield Piston.create(c, world, cubane, [2, 0, 0], "sticky", "up");
  const doubleTop = yield Piston.create(c, world, cubane, [2, 1, 0], "sticky", "up");



  // create left 3 pistons
  const leftPiston1 = yield Piston.create(c, world, cubane, [-1, 3, 0], "sticky", "east");
  const leftPiston2 = yield Piston.create(c, world, cubane, [-1, 4, 0], "sticky", "east");
  const leftPiston3 = yield Piston.create(c, world, cubane, [-1, 5, 0], "sticky", "east");

  // create left 3 blocks
  const leftBlock1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [0, 3, 0]  // 1 block in front of piston
  );

  const leftBlock2 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [0, 4, 0]  // 1 block in front of piston
  );
  const leftBlock3 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [0, 5, 0]  // 1 block in front of piston
  );

  // create right 3 pistons
  const rightPiston1 = yield Piston.create(c, world, cubane, [5, 3, 0], "sticky", "west");
  const rightPiston2 = yield Piston.create(c, world, cubane, [5, 4, 0], "sticky", "west");
  const rightPiston3 = yield Piston.create(c, world, cubane, [5, 5, 0], "sticky", "west");

  // create right 3 blocks
  const rightBlock1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [4, 3, 0]  // 1 block in front of piston
  );
  const rightBlock2 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [4, 4, 0]  // 1 block in front of piston
  );
  const rightBlock3 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [4, 5, 0]  // 1 block in front of piston
  );

  // Top piston 
  const topPiston1 = yield Piston.create(c, world, cubane, [2, 7, 0], "sticky", "down");

  // Top block
  const topBlock1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [2, 6, 0]  // 1 block in front of piston
  );


  // Create some blocks for the piston to push
  const block1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [1, 2, 0]  // 1 block in front of piston
  );

  const block2 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [2, 2, 0]  // 1 block in front of piston
  );

  const lastFloorBlock = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [3, 2, 0]  // 1 block in front of piston
  );

  const fillerCeilingBlock1 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [1, 6, 0]  // 1 block in front of piston
  );
  const fillerCeilingBlock2 = yield Block.create( // Updated to use Block directly
    c,
    world,
    cubane,
    doorMaterial,
    [3, 6, 0]  // 1 block in front of piston
  );




  yield* all(
    // Camera rotation
    // tween(12.0, (t) => {
    //   const angle = Math.PI * t;
    //   c.camera.position([
    //     Math.sin(angle) * 10,
    //     8,
    //     Math.cos(angle) * 10
    //   ]);
    //   c.camera.lookAt([1, 1, 0]); // Look at the action area
    // }),

    (function* () {
      yield* doubleBottom.pulse(0.4);
      yield* blockStorage.extend(0.2);
      // yield* doubleTop.pulse(1, true);
      yield* all(
        leftPiston1.extend(0.2),
        leftPiston2.extend(0.2),
        leftPiston3.extend(0.2),
        rightPiston1.extend(0.2),
        rightPiston2.extend(0.2),
        rightPiston3.extend(0.2),
        topPiston1.extend(0.2),
        doubleTop.extend(0.2),
      )
    })(),
  );

  yield* waitFor(0.5);
  //retract all pistons
  yield* all(
    leftPiston1.retract(0.2),
    leftPiston2.retract(0.2),
    leftPiston3.retract(0.2),
    rightPiston1.retract(0.2),
    rightPiston2.retract(0.2),
    rightPiston3.retract(0.2),
    topPiston1.retract(0.2),
    doubleTop.retract(0.2),
  );

  yield* waitFor(0.1);
  yield* blockStorage.retract(0.2);
  yield* waitFor(0.1);
  yield* doubleBottom.extend(0.2);
  yield* doubleTop.pulse(0.2);

  yield* waitFor(0.4);
  yield* doubleBottom.retract(0.2);
  yield* waitFor(2);


});