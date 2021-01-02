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
    Body,
    Vec2,
    EdgeShape,
    FixtureDef,
    Transform,
    Rot,
    PolygonShape,
    BodyType,
    FrictionJointDef,
    XY,
} from "@box2d/core";

import { registerTest, Test } from "../../test";
import { HotKey, hotKeyStep } from "../../utils/hotkeys";

// This test shows how to apply forces and torques to a body.
// It also shows how to use the friction joint that can be useful
// for overhead games.
class ApplyForceTest extends Test {
    public body: Body;

    public positiveForce = false;

    public negativeForce = false;

    public cwTorque = false;

    public ccwTorque = false;

    public constructor() {
        super(Vec2.ZERO);

        const k_restitution = 0.4;

        const ground = this.world.createBody({
            position: {
                x: 0,
                y: 20,
            },
        });
        {
            const shape = new EdgeShape();

            const sd: FixtureDef = {
                shape,
                density: 0,
                restitution: k_restitution,
            };

            // Left vertical
            shape.setTwoSided(new Vec2(-20, -20), new Vec2(-20, 20));
            ground.createFixture(sd);

            // Right vertical
            shape.setTwoSided(new Vec2(20, -20), new Vec2(20, 20));
            ground.createFixture(sd);

            // Top horizontal
            shape.setTwoSided(new Vec2(-20, 20), new Vec2(20, 20));
            ground.createFixture(sd);

            // Bottom horizontal
            shape.setTwoSided(new Vec2(-20, -20), new Vec2(20, -20));
            ground.createFixture(sd);
        }

        {
            const xf1 = new Transform();
            xf1.q.set(0.3524 * Math.PI);
            xf1.q.getXAxis(xf1.p);

            const vertices = [];
            vertices[0] = Transform.multiplyVec2(xf1, new Vec2(-1, 0), new Vec2());
            vertices[1] = Transform.multiplyVec2(xf1, new Vec2(1, 0), new Vec2());
            vertices[2] = Transform.multiplyVec2(xf1, new Vec2(0, 0.5), new Vec2());

            const poly1 = new PolygonShape();
            poly1.set(vertices, 3);

            const xf2 = new Transform();
            xf2.q.set(-0.3524 * Math.PI);
            xf2.q.getXAxis(xf2.p).negate();
            xf2.p.copy(Rot.multiplyVec2(xf2.q, new Vec2(-1, 0), new Vec2()));

            vertices[0] = Transform.multiplyVec2(xf2, new Vec2(-1, 0), new Vec2());
            vertices[1] = Transform.multiplyVec2(xf2, new Vec2(1, 0), new Vec2());
            vertices[2] = Transform.multiplyVec2(xf2, new Vec2(0, 0.5), new Vec2());

            const poly2 = new PolygonShape();
            poly2.set(vertices, 3);

            this.body = this.world.createBody({
                type: BodyType.Dynamic,
                position: { x: 0, y: 3 },
                angle: Math.PI,
                allowSleep: false,
            });
            this.body.createFixture({
                shape: poly1,
                density: 2,
            });
            this.body.createFixture({
                shape: poly2,
                density: 2,
            });

            const gravity = 10;
            const I = this.body.getInertia();
            const mass = this.body.getMass();

            // Compute an effective radius that can be used to
            // set the max torque for a friction joint
            // For a circle = 0.5 * m * r * r ==> r = sqrt(2 * I / m)
            const radius = Math.sqrt((2 * I) / mass);

            const jd = new FrictionJointDef();
            jd.bodyA = ground;
            jd.bodyB = this.body;
            jd.localAnchorA.setZero();
            jd.localAnchorB.copy(this.body.getLocalCenter());
            jd.collideConnected = true;
            jd.maxForce = 0.5 * mass * gravity;
            jd.maxTorque = 0.2 * mass * radius * gravity;

            this.world.createJoint(jd);
        }

        {
            const shape = new PolygonShape();
            shape.setAsBox(0.5, 0.5);

            const fd: FixtureDef = {
                shape,
                density: 1,
                friction: 0.3,
            };

            for (let i = 0; i < 10; ++i) {
                const body = this.world.createBody({
                    type: BodyType.Dynamic,

                    position: {
                        x: 0,
                        y: 7 + 1.54 * i,
                    },
                });

                body.createFixture(fd);

                const gravity = 10;
                const I = body.getInertia();
                const mass = body.getMass();

                // For a circle: I = 0.5 * m * r * r ==> r = sqrt(2 * I / m)
                const radius = Math.sqrt((2 * I) / mass);

                const jd = new FrictionJointDef();
                jd.localAnchorA.setZero();
                jd.localAnchorB.setZero();
                jd.bodyA = ground;
                jd.bodyB = body;
                jd.collideConnected = true;
                jd.maxForce = mass * gravity;
                jd.maxTorque = 0.1 * mass * radius * gravity;

                this.world.createJoint(jd);
            }
        }
    }

    public getHotkeys(): HotKey[] {
        return [
            hotKeyStep("w", "Apply Force", () => this.applyForce(-50)),
            hotKeyStep("s", "Apply Backward Force", () => this.applyForce(50)),
            hotKeyStep("a", "Apply Torque Counter-Clockwise", () => this.body.applyTorque(10)),
            hotKeyStep("d", "Apply Torque Clockwise", () => this.body.applyTorque(-10)),
        ];
    }

    private applyForce(value: number) {
        const f = this.body.getWorldVector(new Vec2(0, value), new Vec2());
        const p = this.body.getWorldPoint(new Vec2(0, 3), new Vec2());
        this.body.applyForce(f, p);
    }

    public getCenter(): XY {
        return {
            x: 0,
            y: 15,
        };
    }
}

registerTest("Forces", "Apply Force", ApplyForceTest);
