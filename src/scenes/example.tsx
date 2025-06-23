import { makeScene2D, useScene2D } from "@motion-canvas/2d";
import { ThreeCanvas, axisAngle, SignalableObject3D } from "../motion-canvas-3d";

import * as THREE from "three";
import { easeInOutCubic, easeOutQuart, easeInQuart, easeInOutQuart, tween, waitFor, all } from "@motion-canvas/core";

import { Cubane, ResourcePackLoadOptions, ResourcePackLoader } from "cubane";

import ThreeCanvasWithPostProcessing from "../utils/ThreeCanvasWithPostProcessing";
import Piston from "../utils/piston";

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

  c.camera.position([0, 0, -4]);
  c.camera.lookAt([0.5, 0, 0]);

  const piston = yield Piston.create(
    c,
    cubane
  );
  piston.position([0, 0, 0]);

  view.add(c);


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


  yield* all(
    tween(3.0, (t) => {
      const angle = Math.PI * t;
      c.camera.position([
        Math.sin(angle) * 4,
        2.5,
        Math.cos(angle) * 4
      ]);

      const pistonExt = Math.sin(angle * 20) * 0.5 + 0.5;
      piston.extension(pistonExt);

      c.camera.lookAt([0.5, 0, 0]);
    }
    ));
});