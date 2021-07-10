import "../fixprocess";

// bypass box2d-wasm entrypoint to explicitly ask for SIMD flavour
import Box2DFactory from "../../../../node_modules/box2d-wasm/dist/umd/Box2D.simd";
// tell Parcel to serve WASM asset
import wasmSimd from 'url:../../../../node_modules/box2d-wasm/dist/umd/Box2D.simd.wasm';

import type { TestFactory, TestInterface } from "../types";

export const box2dWasmSimdFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity): Promise<TestInterface> => {
  const { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getCache, getPointer, NULL } = await Box2DFactory({
    locateFile: (url: string, scriptDirectory: string): string => {
      switch (url) {
        case 'Box2D.simd.wasm':
          return wasmSimd;
        default:
          throw new Error(`Box2D requested unexpected asset '${scriptDirectory}${url}'; expected '${scriptDirectory}Box2D.simd.wasm' only.`);
      }
    }
  });
  const vec0 = new b2Vec2(gravity.x, gravity.y);
  const world = new b2World(vec0);
  const bd = new b2BodyDef();
  const ground = world.CreateBody(bd);
  destroy(bd);

  const edgeShape = new b2EdgeShape();
  {
    const { x, y } = edgeV1;
    vec0.Set(x, y);
  }
  {
    const { x, y } = edgeV2;
    const vec1 = new b2Vec2(x, y);
    edgeShape.SetTwoSided(vec0, vec1);
    destroy(vec1);
  }
  destroy(vec0);
  ground.CreateFixture(edgeShape, edgeDensity);
  destroy(edgeShape);

  return {
    name: "box2d-wasm (SIMD)",
    createBoxShape(hx: number, hy: number): Box2D.b2PolygonShape {
      const box = new b2PolygonShape();
      box.SetAsBox(hx, hy);
      return box;
    },
    createBoxBody(shape: Box2D.b2PolygonShape, x: number, y: number, density: number): void {
      // this isn't a performant way to use Box2D.
      // why allocate new body definitions when we could mutate and re-use one?
      // why allocate new position vectors when we could mutate and re-use one?
      // joelgwebber's original C benchmarks _stack-allocated_ this structure:
      // https://github.com/joelgwebber/bench2d/blob/master/c/Bench2d.cpp#L73
      const bd = new b2BodyDef();
      bd.set_type(b2_dynamicBody);
      bd.set_position(new b2Vec2(x, y));
      const body = world.CreateBody(bd);
      body.CreateFixture(shape, density);
    },
    step(timeStep: number, velocityIterations: number, positionIterations: number): void {
      world.Step(timeStep, velocityIterations, positionIterations);
    },
    cleanup(): void {
      for (let body = world.GetBodyList(); getPointer(body) !== getPointer(NULL); body = body.GetNext()) {
        world.DestroyBody(body);
      }
      destroy(world);
      // free references to everything we leaked during benchmark
      for (const b2Class of [b2BodyDef, b2Vec2, b2PolygonShape]) {
        for(const instance of Object.values(getCache(b2Class))) {
          destroy(instance);
        }
      }
    }
  };
};
