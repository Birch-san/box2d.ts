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
    Vec2,
    Body,
    RevoluteJoint,
    PolygonShape,
    BodyType,
    DistanceJointDef,
    linearStiffness,
    RevoluteJointDef,
    EdgeShape,
    CircleShape,
} from "@box2d/core";

import { registerTest, Test } from "../../test";
import { HotKey, hotKeyPress } from "../../utils/hotkeys";

// Inspired by a contribution by roman_m
// Dimensions scooped from APE (http://www.cove.org/ape/index.htm)

class TheoJansenTest extends Test {
    public offset = new Vec2();

    public chassis!: Body;

    public wheel!: Body;

    public motorJoint!: RevoluteJoint;

    public motorOn = true;

    public motorSpeed = 2;

    public constructor() {
        super();

        this.offset.set(0, 8);
        const pivot = new Vec2(0, 0.8);

        // Ground
        {
            const ground = this.world.createBody();

            const shape = new EdgeShape();
            shape.setTwoSided(new Vec2(-50, 0), new Vec2(50, 0));
            ground.createFixture({ shape });

            shape.setTwoSided(new Vec2(-50, 0), new Vec2(-50, 10));
            ground.createFixture({ shape });

            shape.setTwoSided(new Vec2(50, 0), new Vec2(50, 10));
            ground.createFixture({ shape });
        }

        // Balls
        for (let i = 0; i < 40; ++i) {
            const shape = new CircleShape();
            shape.radius = 0.25;

            const body = this.world.createBody({
                type: BodyType.Dynamic,
                position: { x: -40 + 2 * i, y: 0.5 },
            });
            body.createFixture({ shape, density: 1 });
        }

        // Chassis
        {
            const shape = new PolygonShape();
            shape.setAsBox(2.5, 1);

            this.chassis = this.world.createBody({
                type: BodyType.Dynamic,
                position: {
                    x: pivot.x + this.offset.x,
                    y: pivot.y + this.offset.y,
                },
            });
            this.chassis.createFixture({
                density: 1,
                shape,
                filter: {
                    groupIndex: -1,
                },
            });
        }

        {
            const shape = new CircleShape();
            shape.radius = 1.6;

            this.wheel = this.world.createBody({
                type: BodyType.Dynamic,
                position: {
                    x: pivot.x + this.offset.x,
                    y: pivot.y + this.offset.y,
                },
            });
            this.wheel.createFixture({
                density: 1,
                shape,
                filter: {
                    groupIndex: -1,
                },
            });
        }

        {
            const jd = new RevoluteJointDef();
            jd.initialize(this.wheel, this.chassis, Vec2.add(pivot, this.offset, new Vec2()));
            jd.collideConnected = false;
            jd.motorSpeed = this.motorSpeed;
            jd.maxMotorTorque = 400;
            jd.enableMotor = this.motorOn;
            this.motorJoint = this.world.createJoint(jd);
        }

        const wheelAnchor = Vec2.add(pivot, new Vec2(0, -0.8), new Vec2());

        this.createLeg(-1, wheelAnchor);
        this.createLeg(1, wheelAnchor);

        this.wheel.setTransformVec(this.wheel.getPosition(), (120 * Math.PI) / 180);
        this.createLeg(-1, wheelAnchor);
        this.createLeg(1, wheelAnchor);

        this.wheel.setTransformVec(this.wheel.getPosition(), (-120 * Math.PI) / 180);
        this.createLeg(-1, wheelAnchor);
        this.createLeg(1, wheelAnchor);
    }

    public createLeg(s: number, wheelAnchor: Vec2) {
        const p1 = new Vec2(5.4 * s, -6.1);
        const p2 = new Vec2(7.2 * s, -1.2);
        const p3 = new Vec2(4.3 * s, -1.9);
        const p4 = new Vec2(3.1 * s, 0.8);
        const p5 = new Vec2(6 * s, 1.5);
        const p6 = new Vec2(2.5 * s, 3.7);

        const poly1 = new PolygonShape();
        const poly2 = new PolygonShape();

        if (s > 0) {
            const vertices = [];

            vertices[0] = p1;
            vertices[1] = p2;
            vertices[2] = p3;
            poly1.set(vertices);

            vertices[0] = Vec2.ZERO;
            vertices[1] = Vec2.subtract(p5, p4, new Vec2());
            vertices[2] = Vec2.subtract(p6, p4, new Vec2());
            poly2.set(vertices);
        } else {
            const vertices = [];

            vertices[0] = p1;
            vertices[1] = p3;
            vertices[2] = p2;
            poly1.set(vertices);

            vertices[0] = Vec2.ZERO;
            vertices[1] = Vec2.subtract(p6, p4, new Vec2());
            vertices[2] = Vec2.subtract(p5, p4, new Vec2());
            poly2.set(vertices);
        }

        const body1 = this.world.createBody({
            type: BodyType.Dynamic,
            position: this.offset,
            angularDamping: 10,
        });
        const body2 = this.world.createBody({
            type: BodyType.Dynamic,
            position: Vec2.add(p4, this.offset, new Vec2()),
            angularDamping: 10,
        });

        body1.createFixture({
            filter: { groupIndex: -1 },
            shape: poly1,
            density: 1,
        });
        body2.createFixture({
            filter: { groupIndex: -1 },
            density: 1,
            shape: poly2,
        });

        {
            const jd = new DistanceJointDef();

            // Using a soft distance constraint can reduce some jitter.
            // It also makes the structure seem a bit more fluid by
            // acting like a suspension system.
            const dampingRatio = 0.5;
            const frequencyHz = 10;

            jd.initialize(body1, body2, Vec2.add(p2, this.offset, new Vec2()), Vec2.add(p5, this.offset, new Vec2()));
            linearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
            this.world.createJoint(jd);

            jd.initialize(body1, body2, Vec2.add(p3, this.offset, new Vec2()), Vec2.add(p4, this.offset, new Vec2()));
            linearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
            this.world.createJoint(jd);

            jd.initialize(
                body1,
                this.wheel,
                Vec2.add(p3, this.offset, new Vec2()),
                Vec2.add(wheelAnchor, this.offset, new Vec2()),
            );
            linearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
            this.world.createJoint(jd);

            jd.initialize(
                body2,
                this.wheel,
                Vec2.add(p6, this.offset, new Vec2()),
                Vec2.add(wheelAnchor, this.offset, new Vec2()),
            );
            linearStiffness(jd, frequencyHz, dampingRatio, jd.bodyA, jd.bodyB);
            this.world.createJoint(jd);
        }

        {
            const jd = new RevoluteJointDef();

            jd.initialize(body2, this.chassis, Vec2.add(p4, this.offset, new Vec2()));
            this.world.createJoint(jd);
        }
    }

    public getHotkeys(): HotKey[] {
        return [
            hotKeyPress("a", "Left", () => this.motorJoint.setMotorSpeed(-this.motorSpeed)),
            hotKeyPress("s", "Brake", () => this.motorJoint.setMotorSpeed(0)),
            hotKeyPress("d", "Right", () => this.motorJoint.setMotorSpeed(this.motorSpeed)),
            hotKeyPress("m", "Toggle Enabled", () => this.motorJoint.enableMotor(!this.motorJoint.isMotorEnabled())),
        ];
    }
}

registerTest("Examples", "Theo Jansen's Walker", TheoJansenTest);
