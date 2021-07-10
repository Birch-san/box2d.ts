import "../fixprocess";

// bypass box2d-wasm entrypoint to explicitly ask for non-SIMD flavour
import Box2DFactory from "box2d-wasm/dist/umd/Box2D";
// tell Parcel to serve WASM asset
import wasm from 'url:../../../../node_modules/box2d-wasm/dist/umd/Box2D.wasm';

import type { TestFactory, TestInterface } from "../types";

import { box2dWasmReuseFactory } from './box2d-wasm.reuse.common';

export const box2dWasmReuseNoSimdFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity): Promise<TestInterface> => {
  const box2D = await Box2DFactory({
    locateFile: (url: string, scriptDirectory: string): string => {
      switch (url) {
        case 'Box2D.wasm':
          return wasm;
        default:
          throw new Error(`Box2D requested unexpected asset '${scriptDirectory}${url}'; expected '${scriptDirectory}Box2D.wasm' only.`);
      }
    }
  });
  
  const test = box2dWasmReuseFactory(box2D, gravity, edgeV1, edgeV2, edgeDensity);

  return {
    name: "box2d-wasm (object re-use) (non-SIMD)",
    ...test
  };
};
