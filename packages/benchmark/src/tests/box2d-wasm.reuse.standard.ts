import "../fixprocess";

// bypass box2d-wasm entrypoint to explicitly ask for non-SIMD flavour
import Box2DFactory from "box2d-wasm/dist/umd/Box2D";
// tell Parcel to serve WASM asset
import wasm from 'url:../../../../node_modules/box2d-wasm/dist/umd/Box2D.wasm';

import type { TestFactory, TestInterface } from "../types";

export const box2dWasmReuseNoSimdFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity): Promise<TestInterface> => {
  const { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getPointer, NULL } = await Box2DFactory({
    locateFile: (url: string, scriptDirectory: string): string => {
      switch (url) {
        case 'Box2D.wasm':
          return wasm;
        default:
          throw new Error(`Box2D requested unexpected asset '${scriptDirectory}${url}'; expected '${scriptDirectory}Box2D.wasm' only.`);
      }
    }
  });
  const vec0 = new b2Vec2(gravity.x, gravity.y);
  const world = new b2World(vec0);

  const bd = new b2BodyDef();
  const ground = world.CreateBody(bd);

  vec0.Set(edgeV1.x, edgeV1.y);
  const vec1 = new b2Vec2(edgeV2.x, edgeV2.y);
  const edgeShape = new b2EdgeShape();
  edgeShape.SetTwoSided(vec0, vec1);
  destroy(vec1);
  ground.CreateFixture(edgeShape, edgeDensity);
  destroy(edgeShape);

  bd.set_type(b2_dynamicBody);

  const box = new b2PolygonShape();

  return {
    name: "box2d-wasm (object re-use) (non-SIMD)",
    createBoxShape(hx: number, hy: number): Box2D.b2PolygonShape {
      box.SetAsBox(hx, hy);
      return box;
    },
    createBoxBody(shape: Box2D.b2PolygonShape, x: number, y: number, density: number): void {
      vec0.Set(x, y);
      const body = world.CreateBody(bd);
      body.CreateFixture(shape, density);
    },
    step(timeStep: number, velocityIterations: number, positionIterations: number): void {
      world.Step(timeStep, velocityIterations, positionIterations);
    },
    cleanup(): void {
      destroy(box);
      for (let body = world.GetBodyList(); getPointer(body) !== getPointer(NULL); body = body.GetNext()) {
        world.DestroyBody(body);
      }
      destroy(bd);
      destroy(world);
      destroy(vec0);
    }
  };
};
