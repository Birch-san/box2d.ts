import type { TestFactory, TestInterface } from "../types";

type TestInterfacePartial = Omit<TestInterface, 'name'>;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
type Box2DModule = ThenArg<ReturnType<typeof import('box2d-wasm')>>;
type TestFactoryPartial = (box2D: Box2DModule, ...params: Parameters<TestFactory>) => TestInterfacePartial;

export const box2dWasmReuseFactory: TestFactoryPartial = (box2D, gravity, edgeV1, edgeV2, edgeDensity): TestInterfacePartial => {
  const { b2World, b2Vec2, b2EdgeShape, b2PolygonShape, b2_dynamicBody, b2BodyDef, destroy, getPointer, NULL } = box2D;
  const vec0 = new b2Vec2(gravity.x, gravity.y);
  const world = new b2World(vec0);

  const bd = new b2BodyDef();
  const ground = world.CreateBody(bd);

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
  ground.CreateFixture(edgeShape, edgeDensity);
  destroy(edgeShape);

  bd.set_type(b2_dynamicBody);

  const box = new b2PolygonShape();

  return {
    createBoxShape(hx: number, hy: number): Box2D.b2PolygonShape {
      box.SetAsBox(hx, hy);
      return box;
    },
    createBoxBody(shape: Box2D.b2PolygonShape, x: number, y: number, density: number): void {
      vec0.Set(x, y);
      bd.set_position(vec0);
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