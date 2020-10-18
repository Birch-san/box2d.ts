/*
 * Copyright (c) 2006-2012 Erin Catto http://www.box2d.org
 *
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 * 1. The origin of this software must not be misrepresented; you must not
 * claim that you wrote the original software. If you use this software
 * in a product, an acknowledgment in the product documentation would be
 * appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 * misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 */

import {
    b2RayCastCallback,
    b2Vec2,
    b2Fixture,
    b2Body,
    b2PolygonShape,
    b2CircleShape,
    b2EdgeShape,
    b2BodyDef,
    b2RandomRange,
    b2FixtureDef,
    b2Color,
} from "@box2d/core";

import { Test } from "../../test";
import { Settings } from "../../settings";
import { g_debugDraw } from "../../utils/draw";
import { HotKey, hotKeyPress } from "../../utils/hotkeys";

class RayCastClosestCallback extends b2RayCastCallback {
    public m_hit = false;

    public readonly m_point: b2Vec2 = new b2Vec2();

    public readonly m_normal: b2Vec2 = new b2Vec2();

    public ReportFixture(fixture: b2Fixture, point: b2Vec2, normal: b2Vec2, fraction: number): number {
        const body: b2Body = fixture.GetBody();
        const userData: any = body.GetUserData();
        if (userData) {
            const { index } = userData;
            if (index === 0) {
                // By returning -1, we instruct the calling code to ignore this fixture
                // and continue the ray-cast to the next fixture.
                return -1;
            }
        }

        this.m_hit = true;
        this.m_point.Copy(point);
        this.m_normal.Copy(normal);

        // By returning the current fraction, we instruct the calling code to clip the ray and
        // continue the ray-cast to the next fixture. WARNING: do not assume that fixtures
        // are reported in order. However, by clipping, we can always get the closest fixture.
        return fraction;
    }
}

// This callback finds any hit. Polygon 0 is filtered. For this type of query we are usually
// just checking for obstruction, so the actual fixture and hit point are irrelevant.
class RayCastAnyCallback extends b2RayCastCallback {
    public m_hit = false;

    public readonly m_point: b2Vec2 = new b2Vec2();

    public readonly m_normal: b2Vec2 = new b2Vec2();

    public ReportFixture(fixture: b2Fixture, point: b2Vec2, normal: b2Vec2, _fraction: number): number {
        const body: b2Body = fixture.GetBody();
        const userData: any = body.GetUserData();
        if (userData) {
            const { index } = userData;
            if (index === 0) {
                // By returning -1, we instruct the calling code to ignore this fixture
                // and continue the ray-cast to the next fixture.
                return -1;
            }
        }

        this.m_hit = true;
        this.m_point.Copy(point);
        this.m_normal.Copy(normal);

        // At this point we have a hit, so we know the ray is obstructed.
        // By returning 0, we instruct the calling code to terminate the ray-cast.
        return 0;
    }
}

// This ray cast collects multiple hits along the ray. Polygon 0 is filtered.
// The fixtures are not necessary reported in order, so we might not capture
// the closest fixture.
class RayCastMultipleCallback extends b2RayCastCallback {
    private static e_maxCount = 3;

    public m_points: b2Vec2[] = b2Vec2.MakeArray(RayCastMultipleCallback.e_maxCount);

    public m_normals: b2Vec2[] = b2Vec2.MakeArray(RayCastMultipleCallback.e_maxCount);

    public m_count = 0;

    public ReportFixture(fixture: b2Fixture, point: b2Vec2, normal: b2Vec2, _fraction: number): number {
        const body: b2Body = fixture.GetBody();
        const userData: any = body.GetUserData();
        if (userData) {
            const { index } = userData;
            if (index === 0) {
                // By returning -1, we instruct the calling code to ignore this fixture
                // and continue the ray-cast to the next fixture.
                return -1;
            }
        }

        // DEBUG: b2Assert(this.m_count < RayCastMultipleCallback.e_maxCount);

        this.m_points[this.m_count].Copy(point);
        this.m_normals[this.m_count].Copy(normal);
        ++this.m_count;

        if (this.m_count === RayCastMultipleCallback.e_maxCount) {
            // At this point the buffer is full.
            // By returning 0, we instruct the calling code to terminate the ray-cast.
            return 0;
        }

        // By returning 1, we instruct the caller to continue without clipping the ray.
        return 1;
    }
}

enum RayCastMode {
    e_closest,
    e_any,
    e_multiple,
}

export class RayCast extends Test {
    private static e_maxBodies = 256;

    private m_bodyIndex = 0;

    private m_bodies: Array<b2Body | null> = [];

    private m_polygons: b2PolygonShape[] = [];

    private m_circle: b2CircleShape = new b2CircleShape();

    private m_edge: b2EdgeShape = new b2EdgeShape();

    private m_angle = 0;

    private m_mode: RayCastMode = RayCastMode.e_closest;

    constructor() {
        super();

        for (let i = 0; i < 4; ++i) {
            this.m_polygons[i] = new b2PolygonShape();
        }

        // Ground body
        {
            const bd = new b2BodyDef();
            const ground = this.m_world.CreateBody(bd);

            const shape = new b2EdgeShape();
            shape.SetTwoSided(new b2Vec2(-40.0, 0.0), new b2Vec2(40.0, 0.0));
            ground.CreateFixture(shape, 0.0);
        }

        {
            const vertices: b2Vec2[] = [
                /* 3 */
            ];
            vertices[0] = new b2Vec2(-0.5, 0.0);
            vertices[1] = new b2Vec2(0.5, 0.0);
            vertices[2] = new b2Vec2(0.0, 1.5);
            this.m_polygons[0].Set(vertices, 3);
        }

        {
            const vertices: b2Vec2[] = [
                /* 3 */
            ];
            vertices[0] = new b2Vec2(-0.1, 0.0);
            vertices[1] = new b2Vec2(0.1, 0.0);
            vertices[2] = new b2Vec2(0.0, 1.5);
            this.m_polygons[1].Set(vertices, 3);
        }

        {
            const w = 1.0;
            const b = w / (2.0 + Math.sqrt(2.0));
            const s = Math.sqrt(2.0) * b;

            const vertices: b2Vec2[] = [
                /* 8 */
            ];
            vertices[0] = new b2Vec2(0.5 * s, 0.0);
            vertices[1] = new b2Vec2(0.5 * w, b);
            vertices[2] = new b2Vec2(0.5 * w, b + s);
            vertices[3] = new b2Vec2(0.5 * s, w);
            vertices[4] = new b2Vec2(-0.5 * s, w);
            vertices[5] = new b2Vec2(-0.5 * w, b + s);
            vertices[6] = new b2Vec2(-0.5 * w, b);
            vertices[7] = new b2Vec2(-0.5 * s, 0.0);

            this.m_polygons[2].Set(vertices, 8);
        }

        this.m_polygons[3].SetAsBox(0.5, 0.5);
        this.m_circle.m_radius = 0.5;
        this.m_edge.SetTwoSided(new b2Vec2(-1, 0), new b2Vec2(1, 0));

        this.m_bodyIndex = 0;
        for (let i = 0; i < RayCast.e_maxBodies; ++i) {
            this.m_bodies[i] = null;
        }

        this.m_angle = 0;

        this.m_mode = RayCastMode.e_closest;
    }

    public CreateBody(index: number): void {
        const old_body = this.m_bodies[this.m_bodyIndex];
        if (old_body !== null) {
            this.m_world.DestroyBody(old_body);
            this.m_bodies[this.m_bodyIndex] = null;
        }

        const bd: b2BodyDef = new b2BodyDef();

        const x: number = b2RandomRange(-10.0, 10.0);
        const y: number = b2RandomRange(0.0, 20.0);
        bd.position.Set(x, y);
        bd.angle = b2RandomRange(-Math.PI, Math.PI);

        bd.userData = {};
        bd.userData.index = index;

        if (index === 4) {
            bd.angularDamping = 0.02;
        }

        const new_body = (this.m_bodies[this.m_bodyIndex] = this.m_world.CreateBody(bd));

        if (index < 4) {
            const fd: b2FixtureDef = new b2FixtureDef();
            fd.shape = this.m_polygons[index];
            fd.friction = 0.3;
            new_body.CreateFixture(fd);
        } else if (index < 5) {
            const fd: b2FixtureDef = new b2FixtureDef();
            fd.shape = this.m_circle;
            fd.friction = 0.3;
            new_body.CreateFixture(fd);
        } else {
            const fd: b2FixtureDef = new b2FixtureDef();
            fd.shape = this.m_edge;
            fd.friction = 0.3;
            new_body.CreateFixture(fd);
        }

        this.m_bodyIndex = (this.m_bodyIndex + 1) % RayCast.e_maxBodies;
    }

    public DestroyBody(): void {
        for (let i = 0; i < RayCast.e_maxBodies; ++i) {
            const body = this.m_bodies[i];
            if (body !== null) {
                this.m_world.DestroyBody(body);
                this.m_bodies[i] = null;
                return;
            }
        }
    }

    getHotkeys(): HotKey[] {
        return [
            hotKeyPress([], "1", "Create Triangle", () => this.CreateBody(0)),
            hotKeyPress([], "2", "Create Flat Triangle", () => this.CreateBody(1)),
            hotKeyPress([], "3", "Create Octagon", () => this.CreateBody(2)),
            hotKeyPress([], "4", "Create Box", () => this.CreateBody(3)),
            hotKeyPress([], "5", "Create Circle", () => this.CreateBody(4)),
            hotKeyPress([], "6", "Create Edge", () => this.CreateBody(5)),
            hotKeyPress([], "d", "Destroy Body", () => this.DestroyBody()),
            hotKeyPress([], "m", "Change Raycast Mode", () => {
                if (this.m_mode === RayCastMode.e_closest) {
                    this.m_mode = RayCastMode.e_any;
                } else if (this.m_mode === RayCastMode.e_any) {
                    this.m_mode = RayCastMode.e_multiple;
                } else if (this.m_mode === RayCastMode.e_multiple) {
                    this.m_mode = RayCastMode.e_closest;
                }
            }),
        ];
    }

    public Step(settings: Settings, timeStep: number): void {
        const advanceRay: boolean = !settings.m_pause || settings.m_singleStep;

        super.Step(settings, timeStep);
        switch (this.m_mode) {
            case RayCastMode.e_closest:
                this.addDebug("Ray-Cast Mode", "Find closest fixture along the ray");
                break;

            case RayCastMode.e_any:
                this.addDebug("Ray-Cast Mode", "Check for obstruction");
                break;

            case RayCastMode.e_multiple:
                this.addDebug("Ray-Cast Mode", "Gather multiple fixtures");
                break;
        }

        const L = 11.0;
        const point1 = new b2Vec2(0.0, 10.0);
        const d = new b2Vec2(L * Math.cos(this.m_angle), L * Math.sin(this.m_angle));
        const point2 = b2Vec2.AddVV(point1, d, new b2Vec2());

        if (this.m_mode === RayCastMode.e_closest) {
            const callback = new RayCastClosestCallback();
            this.m_world.RayCast(point1, point2, callback);

            if (callback.m_hit) {
                g_debugDraw.DrawPoint(callback.m_point, 5.0, new b2Color(0.4, 0.9, 0.4));
                g_debugDraw.DrawSegment(point1, callback.m_point, new b2Color(0.8, 0.8, 0.8));
                const head = b2Vec2.AddVV(
                    callback.m_point,
                    b2Vec2.MulSV(0.5, callback.m_normal, b2Vec2.s_t0),
                    new b2Vec2(),
                );
                g_debugDraw.DrawSegment(callback.m_point, head, new b2Color(0.9, 0.9, 0.4));
            } else {
                g_debugDraw.DrawSegment(point1, point2, new b2Color(0.8, 0.8, 0.8));
            }
        } else if (this.m_mode === RayCastMode.e_any) {
            const callback = new RayCastAnyCallback();
            this.m_world.RayCast(point1, point2, callback);

            if (callback.m_hit) {
                g_debugDraw.DrawPoint(callback.m_point, 5.0, new b2Color(0.4, 0.9, 0.4));
                g_debugDraw.DrawSegment(point1, callback.m_point, new b2Color(0.8, 0.8, 0.8));
                const head = b2Vec2.AddVV(
                    callback.m_point,
                    b2Vec2.MulSV(0.5, callback.m_normal, b2Vec2.s_t0),
                    new b2Vec2(),
                );
                g_debugDraw.DrawSegment(callback.m_point, head, new b2Color(0.9, 0.9, 0.4));
            } else {
                g_debugDraw.DrawSegment(point1, point2, new b2Color(0.8, 0.8, 0.8));
            }
        } else if (this.m_mode === RayCastMode.e_multiple) {
            const callback = new RayCastMultipleCallback();
            this.m_world.RayCast(point1, point2, callback);
            g_debugDraw.DrawSegment(point1, point2, new b2Color(0.8, 0.8, 0.8));

            for (let i = 0; i < callback.m_count; ++i) {
                const p = callback.m_points[i];
                const n = callback.m_normals[i];
                g_debugDraw.DrawPoint(p, 5.0, new b2Color(0.4, 0.9, 0.4));
                g_debugDraw.DrawSegment(point1, p, new b2Color(0.8, 0.8, 0.8));
                const head = b2Vec2.AddVV(p, b2Vec2.MulSV(0.5, n, b2Vec2.s_t0), new b2Vec2());
                g_debugDraw.DrawSegment(p, head, new b2Color(0.9, 0.9, 0.4));
            }
        }

        if (advanceRay) {
            this.m_angle += (0.25 * Math.PI) / 180.0;
        }

        /*
    #if 0
      // This case was failing.
      {
        b2Vec2 vertices[4];
        //vertices[0].Set(-22.875f, -3.0f);
        //vertices[1].Set(22.875f, -3.0f);
        //vertices[2].Set(22.875f, 3.0f);
        //vertices[3].Set(-22.875f, 3.0f);

        b2PolygonShape shape;
        //shape.Set(vertices, 4);
        shape.SetAsBox(22.875f, 3.0f);

        b2RayCastInput input;
        input.p1.Set(10.2725f,1.71372f);
        input.p2.Set(10.2353f,2.21807f);
        //input.maxFraction = 0.567623f;
        input.maxFraction = 0.56762173f;

        b2Transform xf;
        xf.SetIdentity();
        xf.p.Set(23.0f, 5.0f);

        b2RayCastOutput output;
        bool hit;
        hit = shape.RayCast(&output, input, xf);
        hit = false;

        b2Color color(1.0f, 1.0f, 1.0f);
        b2Vec2 vs[4];
        for (int32 i = 0; i < 4; ++i)
        {
          vs[i] = b2Mul(xf, shape.m_vertices[i]);
        }

        g_debugDraw.DrawPolygon(vs, 4, color);
        g_debugDraw.DrawSegment(input.p1, input.p2, color);
      }
    #endif
    */
    }
}