// MIT License

// Copyright (c) 2019 Erin Catto

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { Transform } from "../common/b2_math";
import { collideEdgeAndCircle } from "../collision/b2_collide_edge";
import { Manifold } from "../collision/b2_collision";
import { ChainShape } from "../collision/b2_chain_shape";
import { CircleShape } from "../collision/b2_circle_shape";
import { EdgeShape } from "../collision/b2_edge_shape";
import { Contact } from "./b2_contact";

/** @internal */
export class ChainAndCircleContact extends Contact<ChainShape, CircleShape> {
    private static Evaluate_s_edge = new EdgeShape();

    public evaluate(manifold: Manifold, xfA: Transform, xfB: Transform): void {
        const edge = ChainAndCircleContact.Evaluate_s_edge;
        this.getShapeA().getChildEdge(edge, this.indexA);
        collideEdgeAndCircle(manifold, edge, xfA, this.getShapeB(), xfB);
    }
}
