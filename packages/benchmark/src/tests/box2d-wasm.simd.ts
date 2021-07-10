import "../fixprocess";
import { hasSIMD } from './hasSimd';

// bypass box2d-wasm entrypoint to explicitly ask for SIMD flavour
import Box2DFactory from "../../../../node_modules/box2d-wasm/dist/umd/Box2D.simd";
// tell Parcel to serve WASM asset
import wasmSimd from 'url:../../../../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm';

import type { TestFactory, TestInterface } from "../types";

import { box2dWasmFactory } from './box2d-wasm.common';

export const box2dWasmSimdFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity): Promise<TestInterface> => {
  if (!hasSIMD) {
    throw new Error('Cannot run SIMD test on platform which lacks SIMD support.');
  }
  const box2D = await Box2DFactory({
    locateFile: (url: string, scriptDirectory: string): string => {
      switch (url) {
        case 'Box2D.simd.wasm':
          return wasmSimd;
        default:
          throw new Error(`Box2D requested unexpected asset '${scriptDirectory}${url}'; expected '${scriptDirectory}Box2D.simd.wasm' only.`);
      }
    }
  });
  
  const test = box2dWasmFactory(box2D, gravity, edgeV1, edgeV2, edgeDensity);

  return {
    name: "box2d-wasm (SIMD)",
    ...test
  };
};
