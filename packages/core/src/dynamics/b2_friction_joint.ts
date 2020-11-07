/*
 * Copyright (c) 2006-2007 Erin Catto http://www.box2d.org
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

import { b2Clamp, b2Vec2, b2Mat22, b2Rot, XY } from "../common/b2_math";
import { b2Joint, b2JointDef, b2JointType, b2IJointDef } from "./b2_joint";
import { b2SolverData } from "./b2_time_step";
import { b2Body } from "./b2_body";

const temp = {
    qA: new b2Rot(),
    qB: new b2Rot(),
    lalcA: new b2Vec2(),
    lalcB: new b2Vec2(),
    Cdot: new b2Vec2(),
    impulse: new b2Vec2(),
    oldImpulse: new b2Vec2(),
};

export interface b2IFrictionJointDef extends b2IJointDef {
    localAnchorA: XY;

    localAnchorB: XY;

    maxForce?: number;

    maxTorque?: number;
}

/// Friction joint definition.
export class b2FrictionJointDef extends b2JointDef implements b2IFrictionJointDef {
    public readonly localAnchorA = new b2Vec2();

    public readonly localAnchorB = new b2Vec2();

    public maxForce = 0;

    public maxTorque = 0;

    constructor() {
        super(b2JointType.e_frictionJoint);
    }

    public Initialize(bA: b2Body, bB: b2Body, anchor: b2Vec2): void {
        this.bodyA = bA;
        this.bodyB = bB;
        this.bodyA.GetLocalPoint(anchor, this.localAnchorA);
        this.bodyB.GetLocalPoint(anchor, this.localAnchorB);
    }
}

export class b2FrictionJoint extends b2Joint {
    public readonly m_localAnchorA = new b2Vec2();

    public readonly m_localAnchorB = new b2Vec2();

    // Solver shared
    public readonly m_linearImpulse = new b2Vec2();

    public m_angularImpulse = 0;

    public m_maxForce = 0;

    public m_maxTorque = 0;

    // Solver temp
    public m_indexA = 0;

    public m_indexB = 0;

    public readonly m_rA = new b2Vec2();

    public readonly m_rB = new b2Vec2();

    public readonly m_localCenterA = new b2Vec2();

    public readonly m_localCenterB = new b2Vec2();

    public m_invMassA = 0;

    public m_invMassB = 0;

    public m_invIA = 0;

    public m_invIB = 0;

    public readonly m_linearMass = new b2Mat22();

    public m_angularMass = 0;

    constructor(def: b2IFrictionJointDef) {
        super(def);

        this.m_localAnchorA.Copy(def.localAnchorA);
        this.m_localAnchorB.Copy(def.localAnchorB);

        this.m_linearImpulse.SetZero();
        this.m_maxForce = def.maxForce ?? 0;
        this.m_maxTorque = def.maxTorque ?? 0;
    }

    public InitVelocityConstraints(data: b2SolverData): void {
        this.m_indexA = this.m_bodyA.m_islandIndex;
        this.m_indexB = this.m_bodyB.m_islandIndex;
        this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);
        this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);
        this.m_invMassA = this.m_bodyA.m_invMass;
        this.m_invMassB = this.m_bodyB.m_invMass;
        this.m_invIA = this.m_bodyA.m_invI;
        this.m_invIB = this.m_bodyB.m_invI;

        const aA = data.positions[this.m_indexA].a;
        const vA = data.velocities[this.m_indexA].v;
        let wA = data.velocities[this.m_indexA].w;

        const aB = data.positions[this.m_indexB].a;
        const vB = data.velocities[this.m_indexB].v;
        let wB = data.velocities[this.m_indexB].w;

        const { qA, qB, lalcA, lalcB } = temp;
        qA.Set(aA);
        qB.Set(aB);

        // Compute the effective mass matrix.
        const rA = b2Rot.MultiplyVec2(qA, b2Vec2.Subtract(this.m_localAnchorA, this.m_localCenterA, lalcA), this.m_rA);
        const rB = b2Rot.MultiplyVec2(qB, b2Vec2.Subtract(this.m_localAnchorB, this.m_localCenterB, lalcB), this.m_rB);

        // J = [-I -r1_skew I r2_skew]
        //     [ 0       -1 0       1]
        // r_skew = [-ry; rx]

        // Matlab
        // K = [ mA+r1y^2*iA+mB+r2y^2*iB,  -r1y*iA*r1x-r2y*iB*r2x,          -r1y*iA-r2y*iB]
        //     [  -r1y*iA*r1x-r2y*iB*r2x, mA+r1x^2*iA+mB+r2x^2*iB,           r1x*iA+r2x*iB]
        //     [          -r1y*iA-r2y*iB,           r1x*iA+r2x*iB,                   iA+iB]

        const mA = this.m_invMassA;
        const mB = this.m_invMassB;
        const iA = this.m_invIA;
        const iB = this.m_invIB;

        const K = this.m_linearMass;
        K.ex.x = mA + mB + iA * rA.y * rA.y + iB * rB.y * rB.y;
        K.ex.y = -iA * rA.x * rA.y - iB * rB.x * rB.y;
        K.ey.x = K.ex.y;
        K.ey.y = mA + mB + iA * rA.x * rA.x + iB * rB.x * rB.x;

        K.Inverse();

        this.m_angularMass = iA + iB;
        if (this.m_angularMass > 0) {
            this.m_angularMass = 1 / this.m_angularMass;
        }

        if (data.step.warmStarting) {
            // Scale impulses to support a variable time step.
            this.m_linearImpulse.Scale(data.step.dtRatio);
            this.m_angularImpulse *= data.step.dtRatio;

            const P = this.m_linearImpulse;
            vA.SubtractScaled(mA, P);
            wA -= iA * (b2Vec2.Cross(this.m_rA, P) + this.m_angularImpulse);
            vB.AddScaled(mB, P);
            wB += iB * (b2Vec2.Cross(this.m_rB, P) + this.m_angularImpulse);
        } else {
            this.m_linearImpulse.SetZero();
            this.m_angularImpulse = 0;
        }

        data.velocities[this.m_indexA].w = wA;
        data.velocities[this.m_indexB].w = wB;
    }

    public SolveVelocityConstraints(data: b2SolverData): void {
        const vA = data.velocities[this.m_indexA].v;
        let wA = data.velocities[this.m_indexA].w;
        const vB = data.velocities[this.m_indexB].v;
        let wB = data.velocities[this.m_indexB].w;

        const mA = this.m_invMassA;
        const mB = this.m_invMassB;
        const iA = this.m_invIA;
        const iB = this.m_invIB;

        const h = data.step.dt;

        // Solve angular friction
        {
            const Cdot = wB - wA;
            let impulse = -this.m_angularMass * Cdot;

            const oldImpulse = this.m_angularImpulse;
            const maxImpulse = h * this.m_maxTorque;
            this.m_angularImpulse = b2Clamp(this.m_angularImpulse + impulse, -maxImpulse, maxImpulse);
            impulse = this.m_angularImpulse - oldImpulse;

            wA -= iA * impulse;
            wB += iB * impulse;
        }

        // Solve linear friction
        {
            const { Cdot, impulse, oldImpulse } = temp;
            b2Vec2.Subtract(
                b2Vec2.AddCrossScalarVec2(vB, wB, this.m_rB, b2Vec2.s_t0),
                b2Vec2.AddCrossScalarVec2(vA, wA, this.m_rA, b2Vec2.s_t1),
                Cdot,
            );

            b2Mat22.MultiplyVec2(this.m_linearMass, Cdot, impulse).Negate();
            oldImpulse.Copy(this.m_linearImpulse);
            this.m_linearImpulse.Add(impulse);

            const maxImpulse = h * this.m_maxForce;

            if (this.m_linearImpulse.LengthSquared() > maxImpulse * maxImpulse) {
                this.m_linearImpulse.Normalize();
                this.m_linearImpulse.Scale(maxImpulse);
            }

            b2Vec2.Subtract(this.m_linearImpulse, oldImpulse, impulse);

            vA.SubtractScaled(mA, impulse);
            wA -= iA * b2Vec2.Cross(this.m_rA, impulse);

            vB.AddScaled(mB, impulse);
            wB += iB * b2Vec2.Cross(this.m_rB, impulse);
        }

        data.velocities[this.m_indexA].w = wA;
        data.velocities[this.m_indexB].w = wB;
    }

    public SolvePositionConstraints(_data: b2SolverData): boolean {
        return true;
    }

    public GetAnchorA<T extends XY>(out: T): T {
        return this.m_bodyA.GetWorldPoint(this.m_localAnchorA, out);
    }

    public GetAnchorB<T extends XY>(out: T): T {
        return this.m_bodyB.GetWorldPoint(this.m_localAnchorB, out);
    }

    public GetReactionForce<T extends XY>(inv_dt: number, out: T): T {
        out.x = inv_dt * this.m_linearImpulse.x;
        out.y = inv_dt * this.m_linearImpulse.y;
        return out;
    }

    public GetReactionTorque(inv_dt: number): number {
        return inv_dt * this.m_angularImpulse;
    }

    public GetLocalAnchorA(): Readonly<b2Vec2> {
        return this.m_localAnchorA;
    }

    public GetLocalAnchorB(): Readonly<b2Vec2> {
        return this.m_localAnchorB;
    }

    public SetMaxForce(force: number): void {
        this.m_maxForce = force;
    }

    public GetMaxForce(): number {
        return this.m_maxForce;
    }

    public SetMaxTorque(torque: number): void {
        this.m_maxTorque = torque;
    }

    public GetMaxTorque(): number {
        return this.m_maxTorque;
    }
}
