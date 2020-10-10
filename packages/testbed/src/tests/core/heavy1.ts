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

import * as b2 from "@box2d";
import * as testbed from "../testbed.js";

export class HeavyOnLight extends testbed.Test {
    constructor() {
        super();

        {
            /*b2.BodyDef*/
            const bd = new b2.BodyDef();
            /*b2.Body*/
            const ground = this.m_world.CreateBody(bd);

            /*b2.EdgeShape*/
            const shape = new b2.EdgeShape();
            shape.SetTwoSided(new b2.Vec2(-40.0, 0.0), new b2.Vec2(40.0, 0.0));
            ground.CreateFixture(shape, 0.0);
        }

        /*b2.BodyDef*/
        const bd = new b2.BodyDef();
        bd.type = b2.BodyType.b2_dynamicBody;
        bd.position.Set(0.0, 0.5);
        /*b2.Body*/
        let body = this.m_world.CreateBody(bd);

        /*b2.CircleShape*/
        const shape = new b2.CircleShape();
        shape.m_radius = 0.5;
        body.CreateFixture(shape, 10.0);

        bd.position.Set(0.0, 6.0);
        body = this.m_world.CreateBody(bd);
        shape.m_radius = 5.0;
        body.CreateFixture(shape, 10.0);
    }

    public static Create() {
        return new HeavyOnLight();
    }
}
