import "../fixprocess";
import Box2DFactory from "box2d-wasm";

import type { TestFactory, TestInterface } from "../types";

export const box2dWasmFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity): Promise<TestInterface> => {
  // I have no idea what's going on with Parcel, but it's wrapped box2d-wasm in an extra layer of { default: box2d-wasm }
  const { default: Box2DFactory_ } = Box2DFactory as unknown as { default: typeof Box2DFactory };
  const { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getPointer, NULL } = await Box2DFactory_();
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
    name: "box2d-wasm",
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
      // unfortunately, for a fair comparison I've had to leak every `new` created during the benchmark
    }
  };
};
