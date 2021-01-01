/*
 * Copyright (c) 2006-2009 Erin Catto http://www.box2d.org
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

import { Body, EdgeShape, Vec2, BodyType, CircleShape } from "@box2d/core";

import { HotKey, hotKeyPress } from "../../utils/hotkeys";
import { registerTest, Test } from "../../test";

class Heavy2Test extends Test {
    public m_heavy: Body | null = null;

    public constructor() {
        super();

        {
            const ground = this.m_world.createBody();

            const shape = new EdgeShape();
            shape.setTwoSided(new Vec2(-40, 0), new Vec2(40, 0));
            ground.createFixture({ shape });
        }

        let body = this.m_world.createBody({
            type: BodyType.Dynamic,
            position: { x: 0, y: 2.5 },
        });

        const shape = new CircleShape();
        shape.m_radius = 0.5;
        body.createFixture({ shape, density: 10 });

        body = this.m_world.createBody({
            type: BodyType.Dynamic,
            position: { x: 0, y: 3.5 },
        });
        body.createFixture({ shape, density: 10 });
    }

    public toggleHeavy() {
        if (this.m_heavy !== null) {
            this.m_world.destroyBody(this.m_heavy);
            this.m_heavy = null;
        } else {
            this.m_heavy = this.m_world.createBody({
                type: BodyType.Dynamic,
                position: { x: 0, y: 9 },
            });

            const shape = new CircleShape();
            shape.m_radius = 5;
            this.m_heavy.createFixture({ shape, density: 10 });
        }
    }

    public getHotkeys(): HotKey[] {
        return [hotKeyPress("h", "Toggle Heavy", () => this.toggleHeavy())];
    }
}

registerTest("Solver", "Heavy 2", Heavy2Test);
