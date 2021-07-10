import "../fixprocess";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getCache, getPointer, NULL } from "box2d.js";

import { TestFactory } from "../types";

export const box2dJsFactory: TestFactory = async (gravity, edgeV1, edgeV2, edgeDensity) => {
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
      edgeShape.Set(vec0, vec1);
      destroy(vec1);
    }
    destroy(vec0);
    ground.CreateFixture(edgeShape, edgeDensity);
    destroy(edgeShape);

    return {
        name: "box2d.js",
        createBoxShape(hx: number, hy: number) {
            const box = new b2PolygonShape();
            box.SetAsBox(hx, hy);
            return box;
        },
        createBoxBody(shape: any, x: number, y: number, density: number) {
            const bd = new b2BodyDef();
            bd.set_type(b2_dynamicBody);
            bd.set_position(new b2Vec2(x, y));
            const body = world.CreateBody(bd);
            body.CreateFixture(shape, density);
        },
        step(timeStep: number, velocityIterations: number, positionIterations: number) {
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
