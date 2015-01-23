/*
* Copyright (c) 2006-2011 Erin Catto http://www.box2d.org
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

///<reference path='../../../../Box2D/Box2D/Dynamics/Joints/b2Joint.ts' />
///<reference path='../../../../Box2D/Box2D/Dynamics/b2Body.ts' />
///<reference path='../../../../Box2D/Box2D/Dynamics/b2TimeStep.ts' />

module box2d {

/// Revolute joint definition. This requires defining an
/// anchor point where the bodies are joined. The definition
/// uses local anchor points so that the initial configuration
/// can violate the constraint slightly. You also need to
/// specify the initial relative angle for joint limits. This
/// helps when saving and loading a game.
/// The local anchor points are measured from the body's origin
/// rather than the center of mass because:
/// 1. you might not know where the center of mass will be.
/// 2. if you add/remove shapes from a body and recompute the mass,
///    the joints will be broken.
export class b2RevoluteJointDef extends b2JointDef
{
	public localAnchorA: b2Vec2 = new b2Vec2(0, 0);

	public localAnchorB: b2Vec2 = new b2Vec2(0, 0);

	public referenceAngle: number = 0;

	public enableLimit = false;

	public lowerAngle: number = 0;

	public upperAngle: number = 0;

	public enableMotor = false;

	public motorSpeed: number = 0;

	public maxMotorTorque: number = 0;

	constructor()
	{
		super(b2JointType.e_revoluteJoint); // base class constructor
	}

	public Initialize(bA, bB, anchor)
	{
		this.bodyA = bA;
		this.bodyB = bB;
		this.bodyA.GetLocalPoint(anchor, this.localAnchorA);
		this.bodyB.GetLocalPoint(anchor, this.localAnchorB);
		this.referenceAngle = this.bodyB.GetAngleRadians() - this.bodyA.GetAngleRadians();
	}
}


export class b2RevoluteJoint extends b2Joint
{
	// Solver shared
	public m_localAnchorA: b2Vec2 = new b2Vec2();
	public m_localAnchorB: b2Vec2 = new b2Vec2();
	public m_impulse: b2Vec3 = new b2Vec3();
	public m_motorImpulse: number = 0;

	public m_enableMotor: boolean = false;
	public m_maxMotorTorque: number = 0;
	public m_motorSpeed: number = 0;

	public m_enableLimit: boolean = false;
	public m_referenceAngle: number = 0;
	public m_lowerAngle: number = 0;
	public m_upperAngle: number = 0;

	// Solver temp
	public m_indexA: number = 0;
	public m_indexB: number = 0;
	public m_rA: b2Vec2 = new b2Vec2();
	public m_rB: b2Vec2 = new b2Vec2();
	public m_localCenterA: b2Vec2 = new b2Vec2();
	public m_localCenterB: b2Vec2 = new b2Vec2();
	public m_invMassA: number = 0;
	public m_invMassB: number = 0;
	public m_invIA: number = 0;
	public m_invIB: number = 0;
	public m_mass: b2Mat33 = new b2Mat33(); // effective mass for point-to-point constraint.
	public m_motorMass: number = 0; // effective mass for motor/limit angular constraint.
	public m_limitState: b2LimitState = b2LimitState.e_inactiveLimit;

	public m_qA: b2Rot = new b2Rot();
	public m_qB: b2Rot = new b2Rot();
	public m_lalcA: b2Vec2 = new b2Vec2();
	public m_lalcB: b2Vec2 = new b2Vec2();
	public m_K: b2Mat22 = new b2Mat22();

	constructor(def)
	{
		super(def); // base class constructor

		this.m_localAnchorA.Copy(def.localAnchorA);
		this.m_localAnchorB.Copy(def.localAnchorB);
		this.m_referenceAngle = def.referenceAngle;

		this.m_impulse.SetZero();
		this.m_motorImpulse = 0;

		this.m_lowerAngle = def.lowerAngle;
		this.m_upperAngle = def.upperAngle;
		this.m_maxMotorTorque = def.maxMotorTorque;
		this.m_motorSpeed = def.motorSpeed;
		this.m_enableLimit = def.enableLimit;
		this.m_enableMotor = def.enableMotor;
		this.m_limitState = b2LimitState.e_inactiveLimit;
	}

	private static InitVelocityConstraints_s_P = new b2Vec2();
	public InitVelocityConstraints(data)
	{
		this.m_indexA = this.m_bodyA.m_islandIndex;
		this.m_indexB = this.m_bodyB.m_islandIndex;
		this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);
		this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);
		this.m_invMassA = this.m_bodyA.m_invMass;
		this.m_invMassB = this.m_bodyB.m_invMass;
		this.m_invIA = this.m_bodyA.m_invI;
		this.m_invIB = this.m_bodyB.m_invI;

		var aA: number = data.positions[this.m_indexA].a;
		var vA: b2Vec2 = data.velocities[this.m_indexA].v;
		var wA: number = data.velocities[this.m_indexA].w;

		var aB: number = data.positions[this.m_indexB].a;
		var vB: b2Vec2 = data.velocities[this.m_indexB].v;
		var wB: number = data.velocities[this.m_indexB].w;

		//b2Rot qA(aA), qB(aB);
		var qA: b2Rot = this.m_qA.SetAngleRadians(aA), qB: b2Rot = this.m_qB.SetAngleRadians(aB);

		//m_rA = b2Mul(qA, m_localAnchorA - m_localCenterA);
		b2SubVV(this.m_localAnchorA, this.m_localCenterA, this.m_lalcA);
		b2MulRV(qA, this.m_lalcA, this.m_rA);
		//m_rB = b2Mul(qB, m_localAnchorB - m_localCenterB);
		b2SubVV(this.m_localAnchorB, this.m_localCenterB, this.m_lalcB);
		b2MulRV(qB, this.m_lalcB, this.m_rB);

		// J = [-I -r1_skew I r2_skew]
		//     [ 0       -1 0       1]
		// r_skew = [-ry; rx]

		// Matlab
		// K = [ mA+r1y^2*iA+mB+r2y^2*iB,  -r1y*iA*r1x-r2y*iB*r2x,          -r1y*iA-r2y*iB]
		//     [  -r1y*iA*r1x-r2y*iB*r2x, mA+r1x^2*iA+mB+r2x^2*iB,           r1x*iA+r2x*iB]
		//     [          -r1y*iA-r2y*iB,           r1x*iA+r2x*iB,                   iA+iB]

		var mA: number = this.m_invMassA, mB: number = this.m_invMassB;
		var iA: number = this.m_invIA, iB: number = this.m_invIB;

		var fixedRotation: boolean = (iA + iB == 0);

		this.m_mass.ex.x = mA + mB + this.m_rA.y * this.m_rA.y * iA + this.m_rB.y * this.m_rB.y * iB;
		this.m_mass.ey.x = -this.m_rA.y * this.m_rA.x * iA - this.m_rB.y * this.m_rB.x * iB;
		this.m_mass.ez.x = -this.m_rA.y * iA - this.m_rB.y * iB;
		this.m_mass.ex.y = this.m_mass.ey.x;
		this.m_mass.ey.y = mA + mB + this.m_rA.x * this.m_rA.x * iA + this.m_rB.x * this.m_rB.x * iB;
		this.m_mass.ez.y = this.m_rA.x * iA + this.m_rB.x * iB;
		this.m_mass.ex.z = this.m_mass.ez.x;
		this.m_mass.ey.z = this.m_mass.ez.y;
		this.m_mass.ez.z = iA + iB;

		this.m_motorMass = iA + iB;
		if (this.m_motorMass > 0)
		{
			this.m_motorMass = 1 / this.m_motorMass;
		}

		if (this.m_enableMotor == false || fixedRotation)
		{
			this.m_motorImpulse = 0;
		}

		if (this.m_enableLimit && fixedRotation == false)
		{
			var jointAngle: number = aB - aA - this.m_referenceAngle;
			if (b2Abs(this.m_upperAngle - this.m_lowerAngle) < 2 * b2_angularSlop)
			{
				this.m_limitState = b2LimitState.e_equalLimits;
			}
			else if (jointAngle <= this.m_lowerAngle)
			{
				if (this.m_limitState != b2LimitState.e_atLowerLimit)
				{
					this.m_impulse.z = 0;
				}
				this.m_limitState = b2LimitState.e_atLowerLimit;
			}
			else if (jointAngle >= this.m_upperAngle)
			{
				if (this.m_limitState != b2LimitState.e_atUpperLimit)
				{
					this.m_impulse.z = 0;
				}
				this.m_limitState = b2LimitState.e_atUpperLimit;
			}
			else
			{
				this.m_limitState = b2LimitState.e_inactiveLimit;
				this.m_impulse.z = 0;
			}
		}
		else
		{
			this.m_limitState = b2LimitState.e_inactiveLimit;
		}

		if (data.step.warmStarting)
		{
			// Scale impulses to support a variable time step.
			this.m_impulse.SelfMul(data.step.dtRatio);
			this.m_motorImpulse *= data.step.dtRatio;

			//b2Vec2 P(m_impulse.x, m_impulse.y);
			var P: b2Vec2 = b2RevoluteJoint.InitVelocityConstraints_s_P.SetXY(this.m_impulse.x, this.m_impulse.y);

			//vA -= mA * P;
			vA.SelfMulSub(mA, P);
			wA -= iA * (b2CrossVV(this.m_rA, P) + this.m_motorImpulse + this.m_impulse.z);

			//vB += mB * P;
			vB.SelfMulAdd(mB, P);
			wB += iB * (b2CrossVV(this.m_rB, P) + this.m_motorImpulse + this.m_impulse.z);
		}
		else
		{
			this.m_impulse.SetZero();
			this.m_motorImpulse = 0;
		}

		//data.velocities[this.m_indexA].v = vA;
		data.velocities[this.m_indexA].w = wA;
		//data.velocities[this.m_indexB].v = vB;
		data.velocities[this.m_indexB].w = wB;
	}

	private static SolveVelocityConstraints_s_P: b2Vec2 = new b2Vec2();
	private static SolveVelocityConstraints_s_Cdot_v2: b2Vec2 = new b2Vec2();
	private static SolveVelocityConstraints_s_Cdot1: b2Vec2 = new b2Vec2();
	private static SolveVelocityConstraints_s_impulse_v3: b2Vec3 = new b2Vec3();
	private static SolveVelocityConstraints_s_reduced_v2: b2Vec2 = new b2Vec2();
	private static SolveVelocityConstraints_s_impulse_v2: b2Vec2 = new b2Vec2();
	public SolveVelocityConstraints(data)
	{
		var vA: b2Vec2 = data.velocities[this.m_indexA].v;
		var wA: number = data.velocities[this.m_indexA].w;
		var vB: b2Vec2 = data.velocities[this.m_indexB].v;
		var wB: number = data.velocities[this.m_indexB].w;

		var mA: number = this.m_invMassA, mB: number = this.m_invMassB;
		var iA: number = this.m_invIA, iB: number = this.m_invIB;

		var fixedRotation: boolean = (iA + iB == 0);

		// Solve motor constraint.
		if (this.m_enableMotor && this.m_limitState != b2LimitState.e_equalLimits && fixedRotation == false)
		{
			var Cdot: number = wB - wA - this.m_motorSpeed;
			var impulse: number = -this.m_motorMass * Cdot;
			var oldImpulse: number = this.m_motorImpulse;
			var maxImpulse: number = data.step.dt * this.m_maxMotorTorque;
			this.m_motorImpulse = b2Clamp(this.m_motorImpulse + impulse, -maxImpulse, maxImpulse);
			impulse = this.m_motorImpulse - oldImpulse;

			wA -= iA * impulse;
			wB += iB * impulse;
		}

		// Solve limit constraint.
		if (this.m_enableLimit && this.m_limitState != b2LimitState.e_inactiveLimit && fixedRotation == false)
		{
			//b2Vec2 Cdot1 = vB + b2Cross(wB, m_rB) - vA - b2Cross(wA, m_rA);
			var Cdot1: b2Vec2 = b2SubVV(
				b2AddVCrossSV(vB, wB, this.m_rB, b2Vec2.s_t0),
				b2AddVCrossSV(vA, wA, this.m_rA, b2Vec2.s_t1),
				b2RevoluteJoint.SolveVelocityConstraints_s_Cdot1)
			var Cdot2: number = wB - wA;
			//b2Vec3 Cdot(Cdot1.x, Cdot1.y, Cdot2);

			//b2Vec3 impulse = -this.m_mass.Solve33(Cdot);
			var impulse_v3: b2Vec3 = this.m_mass.Solve33(Cdot1.x, Cdot1.y, Cdot2, b2RevoluteJoint.SolveVelocityConstraints_s_impulse_v3).SelfNeg();

			if (this.m_limitState == b2LimitState.e_equalLimits)
			{
				this.m_impulse.SelfAdd(impulse_v3);
			}
			else if (this.m_limitState == b2LimitState.e_atLowerLimit)
			{
				var newImpulse: number = this.m_impulse.z + impulse_v3.z;
				if (newImpulse < 0)
				{
					//b2Vec2 rhs = -Cdot1 + m_impulse.z * b2Vec2(m_mass.ez.x, m_mass.ez.y);
					var rhs_x = -Cdot1.x + this.m_impulse.z * this.m_mass.ez.x;
					var rhs_y = -Cdot1.y + this.m_impulse.z * this.m_mass.ez.y;
					var reduced_v2: b2Vec2 = this.m_mass.Solve22(rhs_x, rhs_y, b2RevoluteJoint.SolveVelocityConstraints_s_reduced_v2);
					impulse_v3.x = reduced_v2.x;
					impulse_v3.y = reduced_v2.y;
					impulse_v3.z = -this.m_impulse.z;
					this.m_impulse.x += reduced_v2.x;
					this.m_impulse.y += reduced_v2.y;
					this.m_impulse.z = 0;
				}
				else
				{
					this.m_impulse.SelfAdd(impulse_v3);
				}
			}
			else if (this.m_limitState == b2LimitState.e_atUpperLimit)
			{
				var newImpulse: number = this.m_impulse.z + impulse_v3.z;
				if (newImpulse > 0)
				{
					//b2Vec2 rhs = -Cdot1 + m_impulse.z * b2Vec2(m_mass.ez.x, m_mass.ez.y);
					var rhs_x = -Cdot1.x + this.m_impulse.z * this.m_mass.ez.x;
					var rhs_y = -Cdot1.y + this.m_impulse.z * this.m_mass.ez.y;
					var reduced_v2: b2Vec2 = this.m_mass.Solve22(rhs_x, rhs_y, b2RevoluteJoint.SolveVelocityConstraints_s_reduced_v2);
					impulse_v3.x = reduced_v2.x;
					impulse_v3.y = reduced_v2.y;
					impulse_v3.z = -this.m_impulse.z;
					this.m_impulse.x += reduced_v2.x;
					this.m_impulse.y += reduced_v2.y;
					this.m_impulse.z = 0;
				}
				else
				{
					this.m_impulse.SelfAdd(impulse_v3);
				}
			}

			//b2Vec2 P(impulse.x, impulse.y);
			var P: b2Vec2 = b2RevoluteJoint.SolveVelocityConstraints_s_P.SetXY(impulse_v3.x, impulse_v3.y);

			//vA -= mA * P;
			vA.SelfMulSub(mA, P);
			wA -= iA * (b2CrossVV(this.m_rA, P) + impulse_v3.z);

			//vB += mB * P;
			vB.SelfMulAdd(mB, P);
			wB += iB * (b2CrossVV(this.m_rB, P) + impulse_v3.z);
		}
		else
		{
			// Solve point-to-point constraint
			//b2Vec2 Cdot = vB + b2Cross(wB, m_rB) - vA - b2Cross(wA, m_rA);
			var Cdot_v2: b2Vec2 = b2SubVV(
				b2AddVCrossSV(vB, wB, this.m_rB, b2Vec2.s_t0),
				b2AddVCrossSV(vA, wA, this.m_rA, b2Vec2.s_t1),
				b2RevoluteJoint.SolveVelocityConstraints_s_Cdot_v2)
			//b2Vec2 impulse = m_mass.Solve22(-Cdot);
			var impulse_v2: b2Vec2 = this.m_mass.Solve22(-Cdot_v2.x, -Cdot_v2.y, b2RevoluteJoint.SolveVelocityConstraints_s_impulse_v2);

			this.m_impulse.x += impulse_v2.x;
			this.m_impulse.y += impulse_v2.y;

			//vA -= mA * impulse;
			vA.SelfMulSub(mA, impulse_v2);
			wA -= iA * b2CrossVV(this.m_rA, impulse_v2);

			//vB += mB * impulse;
			vB.SelfMulAdd(mB, impulse_v2);
			wB += iB * b2CrossVV(this.m_rB, impulse_v2);
		}

		//data.velocities[this.m_indexA].v = vA;
		data.velocities[this.m_indexA].w = wA;
		//data.velocities[this.m_indexB].v = vB;
		data.velocities[this.m_indexB].w = wB;
	}

	private static SolvePositionConstraints_s_C_v2 = new b2Vec2();
	private static SolvePositionConstraints_s_impulse = new b2Vec2();
	public SolvePositionConstraints(data)
	{
		var cA: b2Vec2 = data.positions[this.m_indexA].c;
		var aA: number = data.positions[this.m_indexA].a;
		var cB: b2Vec2 = data.positions[this.m_indexB].c;
		var aB: number = data.positions[this.m_indexB].a;

		//b2Rot qA(aA), qB(aB);
		var qA: b2Rot = this.m_qA.SetAngleRadians(aA), qB: b2Rot = this.m_qB.SetAngleRadians(aB);

		var angularError: number = 0;
		var positionError: number = 0;

		var fixedRotation: boolean = (this.m_invIA + this.m_invIB == 0);

		// Solve angular limit constraint.
		if (this.m_enableLimit && this.m_limitState != b2LimitState.e_inactiveLimit && fixedRotation == false)
		{
			var angle: number = aB - aA - this.m_referenceAngle;
			var limitImpulse: number = 0;

			if (this.m_limitState == b2LimitState.e_equalLimits)
			{
				// Prevent large angular corrections
				var C: number = b2Clamp(angle - this.m_lowerAngle, -b2_maxAngularCorrection, b2_maxAngularCorrection);
				limitImpulse = -this.m_motorMass * C;
				angularError = b2Abs(C);
			}
			else if (this.m_limitState == b2LimitState.e_atLowerLimit)
			{
				var C: number = angle - this.m_lowerAngle;
				angularError = -C;

				// Prevent large angular corrections and allow some slop.
				C = b2Clamp(C + b2_angularSlop, -b2_maxAngularCorrection, 0);
				limitImpulse = -this.m_motorMass * C;
			}
			else if (this.m_limitState == b2LimitState.e_atUpperLimit)
			{
				var C: number = angle - this.m_upperAngle;
				angularError = C;

				// Prevent large angular corrections and allow some slop.
				C = b2Clamp(C - b2_angularSlop, 0, b2_maxAngularCorrection);
				limitImpulse = -this.m_motorMass * C;
			}

			aA -= this.m_invIA * limitImpulse;
			aB += this.m_invIB * limitImpulse;
		}

		// Solve point-to-point constraint.
		{
			qA.SetAngleRadians(aA);
			qB.SetAngleRadians(aB);
			//b2Vec2 rA = b2Mul(qA, m_localAnchorA - m_localCenterA);
			b2SubVV(this.m_localAnchorA, this.m_localCenterA, this.m_lalcA);
			var rA: b2Vec2 = b2MulRV(qA, this.m_lalcA, this.m_rA);
			//b2Vec2 rB = b2Mul(qB, m_localAnchorB - m_localCenterB);
			b2SubVV(this.m_localAnchorB, this.m_localCenterB, this.m_lalcB);
			var rB: b2Vec2 = b2MulRV(qB, this.m_lalcB, this.m_rB);

			//b2Vec2 C = cB + rB - cA - rA;
			var C_v2 = 
				b2SubVV(
					b2AddVV(cB, rB, b2Vec2.s_t0), 
					b2AddVV(cA, rA, b2Vec2.s_t1), 
					b2RevoluteJoint.SolvePositionConstraints_s_C_v2);
			//positionError = C.Length();
			positionError = C_v2.GetLength();

			var mA: number = this.m_invMassA, mB: number = this.m_invMassB;
			var iA: number = this.m_invIA, iB: number = this.m_invIB;

			var K: b2Mat22 = this.m_K;
			K.ex.x = mA + mB + iA * rA.y * rA.y + iB * rB.y * rB.y;
			K.ex.y = -iA * rA.x * rA.y - iB * rB.x * rB.y;
			K.ey.x = K.ex.y;
			K.ey.y = mA + mB + iA * rA.x * rA.x + iB * rB.x * rB.x;

			//b2Vec2 impulse = -K.Solve(C);
			var impulse: b2Vec2 = K.Solve(C_v2.x, C_v2.y, b2RevoluteJoint.SolvePositionConstraints_s_impulse).SelfNeg();

			//cA -= mA * impulse;
			cA.SelfMulSub(mA, impulse);
			aA -= iA * b2CrossVV(rA, impulse);

			//cB += mB * impulse;
			cB.SelfMulAdd(mB, impulse);
			aB += iB * b2CrossVV(rB, impulse);
		}

		//data.positions[this.m_indexA].c = cA;
		data.positions[this.m_indexA].a = aA;
		//data.positions[this.m_indexB].c = cB;
		data.positions[this.m_indexB].a = aB;
		
		return positionError <= b2_linearSlop && angularError <= b2_angularSlop;
	}

	public GetAnchorA(out: b2Vec2): b2Vec2
	{
		return this.m_bodyA.GetWorldPoint(this.m_localAnchorA, out);
	}

	public GetAnchorB(out: b2Vec2): b2Vec2
	{
		return this.m_bodyB.GetWorldPoint(this.m_localAnchorB, out);
	}

	public GetReactionForce(inv_dt: number, out: b2Vec2): b2Vec2
	{
		//b2Vec2 P(this.m_impulse.x, this.m_impulse.y);
		//return inv_dt * P;
		return out.SetXY(inv_dt * this.m_impulse.x, inv_dt * this.m_impulse.y);
	}

	public GetReactionTorque(inv_dt: number): number
	{
		return inv_dt * this.m_impulse.z;
	}

	public GetLocalAnchorA(): b2Vec2 { return this.m_localAnchorA; }

	public GetLocalAnchorB(): b2Vec2 { return this.m_localAnchorB; }

	public GetReferenceAngle() { return this.m_referenceAngle; }

	public GetJointAngleRadians()
	{
		//b2Body* bA = this.m_bodyA;
		//b2Body* bB = this.m_bodyB;
		//return bB->this.m_sweep.a - bA->this.m_sweep.a - this.m_referenceAngle;
		return this.m_bodyB.m_sweep.a - this.m_bodyA.m_sweep.a - this.m_referenceAngle;
	}

	public GetJointSpeed(): number
	{
		//b2Body* bA = this.m_bodyA;
		//b2Body* bB = this.m_bodyB;
		//return bB->this.m_angularVelocity - bA->this.m_angularVelocity;
		return this.m_bodyB.m_angularVelocity - this.m_bodyA.m_angularVelocity;
	}

	public IsMotorEnabled()
	{
		return this.m_enableMotor;
	}

	public EnableMotor(flag)
	{
		if (this.m_enableMotor != flag)
		{
			this.m_bodyA.SetAwake(true);
			this.m_bodyB.SetAwake(true);
			this.m_enableMotor = flag;
		}
	}

	public GetMotorTorque(inv_dt)
	{
		return inv_dt * this.m_motorImpulse;
	}

	public GetMotorSpeed()
	{
		return this.m_motorSpeed;
	}

	public SetMaxMotorTorque(torque)
	{
		this.m_maxMotorTorque = torque;
	}

	public GetMaxMotorTorque() { return this.m_maxMotorTorque; }

	public IsLimitEnabled()
	{
		return this.m_enableLimit;
	}

	public EnableLimit(flag)
	{
		if (flag != this.m_enableLimit)
		{
			this.m_bodyA.SetAwake(true);
			this.m_bodyB.SetAwake(true);
			this.m_enableLimit = flag;
			this.m_impulse.z = 0;
		}
	}

	public GetLowerLimit()
	{
		return this.m_lowerAngle;
	}

	public GetUpperLimit()
	{
		return this.m_upperAngle;
	}

	public SetLimits(lower, upper)
	{
		
		if (lower != this.m_lowerAngle || upper != this.m_upperAngle)
		{
			this.m_bodyA.SetAwake(true);
			this.m_bodyB.SetAwake(true);
			this.m_impulse.z = 0;
			this.m_lowerAngle = lower;
			this.m_upperAngle = upper;
		}
	}

	public SetMotorSpeed(speed)
	{
		if (this.m_motorSpeed != speed)
		{
			this.m_bodyA.SetAwake(true);
			this.m_bodyB.SetAwake(true);
			this.m_motorSpeed = speed;
		}
	}

	public Dump()
	{
		if (DEBUG)
		{
			var indexA = this.m_bodyA.m_islandIndex;
			var indexB = this.m_bodyB.m_islandIndex;
		
			b2Log("  var jd: b2RevoluteJointDef = new b2RevoluteJointDef();\n");
			b2Log("  jd.bodyA = bodies[%d];\n", indexA);
			b2Log("  jd.bodyB = bodies[%d];\n", indexB);
			b2Log("  jd.collideConnected = %s;\n", (this.m_collideConnected)?('true'):('false'));
			b2Log("  jd.localAnchorA.SetXY(%.15f, %.15f);\n", this.m_localAnchorA.x, this.m_localAnchorA.y);
			b2Log("  jd.localAnchorB.SetXY(%.15f, %.15f);\n", this.m_localAnchorB.x, this.m_localAnchorB.y);
			b2Log("  jd.referenceAngle = %.15f;\n", this.m_referenceAngle);
			b2Log("  jd.enableLimit = %s;\n", (this.m_enableLimit)?('true'):('false'));
			b2Log("  jd.lowerAngle = %.15f;\n", this.m_lowerAngle);
			b2Log("  jd.upperAngle = %.15f;\n", this.m_upperAngle);
			b2Log("  jd.enableMotor = %s;\n", (this.m_enableMotor)?('true'):('false'));
			b2Log("  jd.motorSpeed = %.15f;\n", this.m_motorSpeed);
			b2Log("  jd.maxMotorTorque = %.15f;\n", this.m_maxMotorTorque);
			b2Log("  joints[%d] = this.m_world.CreateJoint(jd);\n", this.m_index);
		}
	}
}

} // module box2d

