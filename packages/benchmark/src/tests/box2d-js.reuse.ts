import "../fixprocess";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getCache, getPointer, NULL } from "box2d.js";

import { TestFactory } from "../types";

export const box2dJsReuseFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity) => {
  const vec0 = new b2Vec2(gravity.x, gravity.y);
  const world = new b2World(vec0);

  const bd = new b2BodyDef();
  const ground = world.CreateBody(bd);

  vec0.Set(edgeV1.x, edgeV1.y);
  const vec1 = new b2Vec2(edgeV2.x, edgeV2.y);
  const edgeShape = new b2EdgeShape();
  edgeShape.Set(vec0, vec1);
  destroy(vec1);
  ground.CreateFixture(edgeShape, edgeDensity);
  destroy(edgeShape);

  bd.set_type(b2_dynamicBody);

  const box = new b2PolygonShape();

  return {
    name: "box2d.js (object re-use)",
    createBoxShape(hx: number, hy: number) {
      box.SetAsBox(hx, hy);
      return box;
    },
    createBoxBody(shape, x: number, y: number, density: number): void {
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
